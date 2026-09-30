/**
 * As contas da aba "Por canal", fora do componente para ter teste.
 *
 * Mesmas regras de venda da aba Análises: a venda vale pela data do pedido
 * (`dataVenda`) e itens do mesmo pedido são uma venda só (`chavePedido`). Antes
 * esta aba filtrava por `created_at` e contava item, e as duas abas davam números
 * diferentes para o mesmo mês.
 */

import type { Orcamento } from '@/lib/supabase'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { ultimosMeses, mesDaCasa } from '@/lib/fusoCasa'
import { chavePedido, dataVenda, ehTeste, ehVenda, receita } from '@/lib/analises/venda'
import { ehConvertido, recebeuPreco } from '@/lib/analises/conversao'

export type LinhaCanal = {
  id: string
  /** leads que chegaram no período */
  leads: number
  /** desses, quantos receberam preço */
  orcados: number
  /** desses, quantos compraram (marcados ou venda com o telefone deles) */
  convertidos: number
  /** PEDIDOS fechados no período atribuídos ao canal, inclusive balcão marcado na mão */
  fechamentos: number
  faturamento: number
  /** faturamento por pedido; 0 sem venda */
  ticket: number
  /** convertidos ÷ leads, em %; nunca passa de 100. null sem lead no período */
  conversao: number | null
}

type Entrada = {
  /** leads vivos (sem histórico) que chegaram no período */
  leads: CrmLead[]
  /** vendas do período (já filtradas por `dataVenda`) */
  vendas: Orcamento[]
  canalDoLead: (l: CrmLead) => string
  canalDaVenda: (o: Orcamento) => string
  compraram: Set<string>
}

export function linhasPorCanal({ leads, vendas, canalDoLead, canalDaVenda, compraram }: Entrada): LinhaCanal[] {
  const vazio = () => ({ leads: 0, orcados: 0, convertidos: 0, pedidos: new Set<string>(), faturamento: 0 })
  const mapa = new Map<string, ReturnType<typeof vazio>>()
  const pega = (id: string) => {
    const atual = mapa.get(id) ?? vazio()
    mapa.set(id, atual)
    return atual
  }

  for (const l of leads) {
    const linha = pega(canalDoLead(l))
    linha.leads++
    if (recebeuPreco(l.ultimo_valor_cotado)) linha.orcados++
    if (ehConvertido(l, compraram)) linha.convertidos++
  }

  // o pedido fica no canal do primeiro item visto; a receita soma todos os itens
  const canalDoPedido = new Map<string, string>()
  for (const o of vendas) {
    if (!ehVenda(o) || ehTeste(o)) continue
    const chave = chavePedido(o)
    const canal = canalDoPedido.get(chave) ?? canalDaVenda(o)
    canalDoPedido.set(chave, canal)
    const linha = pega(canal)
    linha.pedidos.add(chave)
    linha.faturamento += receita(o)
  }

  return [...mapa.entries()].map(([id, v]) => ({
    id,
    leads: v.leads,
    orcados: v.orcados,
    convertidos: v.convertidos,
    fechamentos: v.pedidos.size,
    faturamento: v.faturamento,
    ticket: v.pedidos.size > 0 ? v.faturamento / v.pedidos.size : 0,
    conversao: v.leads > 0 ? (v.convertidos / v.leads) * 100 : null,
  }))
}

export type Totais = Omit<LinhaCanal, 'id'>

export function somarCanais(linhas: LinhaCanal[]): Totais {
  const t = linhas.reduce((s, c) => ({
    leads: s.leads + c.leads,
    orcados: s.orcados + c.orcados,
    convertidos: s.convertidos + c.convertidos,
    fechamentos: s.fechamentos + c.fechamentos,
    faturamento: s.faturamento + c.faturamento,
  }), { leads: 0, orcados: 0, convertidos: 0, fechamentos: 0, faturamento: 0 })
  return {
    ...t,
    ticket: t.fechamentos > 0 ? t.faturamento / t.fechamentos : 0,
    conversao: t.leads > 0 ? (t.convertidos / t.leads) * 100 : null,
  }
}

export type MesAMes = {
  /** os 6 últimos meses do calendário de São Paulo, com os vazios */
  meses: string[]
  canais: string[]
  valor: (mes: string, canal: string) => { n: number; total: number }
}

/**
 * Mês a mês por canal. Não segue o filtro de período, de propósito: é a trajetória
 * dos últimos meses. Mês sem venda aparece zerado em vez de sumir da tabela.
 */
export function mesAMes(
  orcamentos: Orcamento[],
  canalDaVenda: (o: Orcamento) => string,
  meses = 6,
  agora: Date = new Date(),
): MesAMes {
  const lista = ultimosMeses(meses, agora)
  const dentro = new Set(lista)
  const celulas = new Map<string, { pedidos: Set<string>; total: number }>()
  const canais = new Set<string>()
  for (const o of orcamentos) {
    if (!ehVenda(o) || ehTeste(o)) continue
    const mes = mesDaCasa(dataVenda(o))
    if (!mes || !dentro.has(mes)) continue
    const canal = canalDaVenda(o)
    canais.add(canal)
    const k = `${mes}|${canal}`
    const c = celulas.get(k) ?? { pedidos: new Set<string>(), total: 0 }
    c.pedidos.add(chavePedido(o))
    c.total += receita(o)
    celulas.set(k, c)
  }
  return {
    meses: lista,
    canais: [...canais],
    valor: (mes, canal) => {
      const c = celulas.get(`${mes}|${canal}`)
      return { n: c?.pedidos.size ?? 0, total: c?.total ?? 0 }
    },
  }
}
