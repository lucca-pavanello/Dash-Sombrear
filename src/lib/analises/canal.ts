/**
 * De onde vêm — a primeira pergunta de quem investe em mídia.
 *
 * O que dá pra medir hoje com honestidade e o que não dá:
 *  - **Qualidade do lead por canal: dá.** Quantos chegaram, quantos pediram orçamento e
 *    com que score. Esse lado vive inteiro no CRM e está preenchido.
 *  - **Receita por canal: só em parte.** `orcamentos.origem` está vazia, então a venda só
 *    encontra o canal quando o telefone dela casa com uma conversa. Hoje isso fecha para
 *    uma fração das vendas, e a tela diz exatamente qual.
 *
 * Por isso a taxa de orçamento é a medida principal desta seção, e não a receita: é a
 * única comparável entre canais sem depender do rastro que ainda não fecha.
 */

import type { Orcamento } from '@/lib/supabase'
import { type CrmLead, isLeadHistorico } from '@/hooks/useAgenteIA'
import { acharOrigem, SEM_ORIGEM } from '@/components/agente/SeloOrigem'
import { valorNumerico } from '@/lib/utils'
import type { Intervalo } from '@/lib/periodos'
import { dataAtividade, dataVenda, ehVenda, noPeriodo, receita } from './base'

export type LinhaCanal = {
  id: string
  rotulo: string
  leads: number
  /** conversas em que a Amanda chegou a passar preço */
  cotados: number
  /** cotados / leads — a medida comparável entre canais */
  taxaOrcamento: number
  scoreMedio: number | null
  pedidos: number
  receita: number
}

export type Canais = {
  linhas: LinhaCanal[]
  /** o balde dos que chegaram sem canal — serve de régua, não some da conta */
  semCanal: LinhaCanal
  identificados: number
  total: number
  pctCobertura: number
  /** vendas do período que encontraram um canal, e o total com telefone */
  vendasAtribuidas: number
  vendasComTelefone: number
  receitaAtribuida: number
  receitaTotal: number
  temCampanha: boolean
}

/** Uma origem só conta se for texto de verdade — `''` não é canal. */
function temOrigem(v: string | null | undefined): boolean {
  return !!v && v.trim() !== ''
}

type Acumulador = LinhaCanal & { somaScore: number; comScore: number; pedidosVistos: Set<string> }

function novo(id: string, rotulo: string): Acumulador {
  return {
    id, rotulo, leads: 0, cotados: 0, taxaOrcamento: 0, scoreMedio: null,
    pedidos: 0, receita: 0, somaScore: 0, comScore: 0, pedidosVistos: new Set(),
  }
}

function fechar(a: Acumulador): LinhaCanal {
  return {
    id: a.id, rotulo: a.rotulo, leads: a.leads, cotados: a.cotados,
    taxaOrcamento: a.leads ? (a.cotados / a.leads) * 100 : 0,
    scoreMedio: a.comScore ? a.somaScore / a.comScore : null,
    pedidos: a.pedidosVistos.size, receita: a.receita,
  }
}

export function analiseDeCanal(
  leads: CrmLead[],
  orcamentos: Orcamento[],
  faixa: Intervalo | null,
  acharLead: (telefone: string | null | undefined) => CrmLead | undefined,
): Canais {
  // sem o histórico importado da loja, como no funil e na aba Por canal
  const doPeriodo = leads.filter((l) => !isLeadHistorico(l) && noPeriodo(dataAtividade(l), faixa))
  const identificados = doPeriodo.filter((l) => temOrigem(l.origem))

  const mapa = new Map<string, Acumulador>()
  const semCanal = novo(SEM_ORIGEM.id, 'Chegou sem canal marcado')

  const registrar = (alvo: Acumulador, l: CrmLead) => {
    alvo.leads++
    if (valorNumerico(l.ultimo_valor_cotado) > 0) alvo.cotados++
    if (l.lead_score != null) { alvo.somaScore += l.lead_score; alvo.comScore++ }
  }

  for (const l of doPeriodo) {
    if (!temOrigem(l.origem)) { registrar(semCanal, l); continue }
    const canal = acharOrigem(l.origem)
    if (!mapa.has(canal.id)) mapa.set(canal.id, novo(canal.id, canal.rotulo))
    registrar(mapa.get(canal.id)!, l)
  }

  // A venda herda o canal do próprio orçamento; sem ele, do lead que a originou, achado
  // pelo telefone. Itens do mesmo pedido contam como um pedido só.
  let vendasAtribuidas = 0
  let vendasComTelefone = 0
  let receitaAtribuida = 0
  let receitaTotal = 0
  const pedidosComTelefone = new Set<string>()
  const pedidosAtribuidos = new Set<string>()

  for (const o of orcamentos) {
    if (!ehVenda(o) || !noPeriodo(dataVenda(o), faixa)) continue
    receitaTotal += receita(o)
    const chavePedido = o.pedido_id ?? o.id
    if (o.telefone && o.telefone.trim() !== '') pedidosComTelefone.add(chavePedido)

    const bruta = temOrigem(o.origem) ? o.origem : acharLead(o.telefone)?.origem
    if (!temOrigem(bruta)) { semCanal.receita += receita(o); semCanal.pedidosVistos.add(chavePedido); continue }

    const canal = acharOrigem(bruta)
    if (!mapa.has(canal.id)) mapa.set(canal.id, novo(canal.id, canal.rotulo))
    const linha = mapa.get(canal.id)!
    linha.receita += receita(o)
    linha.pedidosVistos.add(chavePedido)
    receitaAtribuida += receita(o)
    pedidosAtribuidos.add(chavePedido)
  }
  vendasAtribuidas = pedidosAtribuidos.size
  vendasComTelefone = pedidosComTelefone.size

  const linhas = [...mapa.values()]
    .map(fechar)
    .sort((a, b) => b.receita - a.receita || b.cotados - a.cotados || b.leads - a.leads)

  return {
    linhas,
    semCanal: fechar(semCanal),
    identificados: identificados.length,
    total: doPeriodo.length,
    pctCobertura: doPeriodo.length ? (identificados.length / doPeriodo.length) * 100 : 0,
    vendasAtribuidas,
    vendasComTelefone,
    receitaAtribuida,
    receitaTotal,
    temCampanha: doPeriodo.some((l) => temOrigem(l.origem_campanha)),
  }
}

/**
 * A frase que vale a seção: o canal cujo lead mais pede orçamento, comparado com quem
 * chegou sem marcação. É a comparação que sobrevive à falta de rastro até a venda — e
 * costuma ser a única boa notícia mensurável de quem investe em mídia.
 */
export function destaqueDeCanal(c: Canais): { linha: LinhaCanal; vezes: number } | null {
  const candidatos = c.linhas.filter((l) => l.leads >= 5)
  if (candidatos.length === 0) return null
  const melhor = [...candidatos].sort((a, b) => b.taxaOrcamento - a.taxaOrcamento)[0]
  const regua = c.semCanal.taxaOrcamento
  if (melhor.taxaOrcamento <= 0 || regua <= 0) return null
  return { linha: melhor, vezes: melhor.taxaOrcamento / regua }
}
