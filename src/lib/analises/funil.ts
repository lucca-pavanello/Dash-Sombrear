/**
 * De conversa a venda — onde o dinheiro escorre.
 *
 * Os dois lados vêm de fontes diferentes e é preciso dizer isso na tela: conversa e
 * orçamento cotado saem do CRM da Amanda; venda e receita saem do Semanário. Nem toda
 * venda passou pela Amanda (balcão, telefone, indicação), então a última etapa pode ser
 * MAIOR que a do meio. Não é erro de conta — é venda que entrou por fora.
 */

import type { Orcamento } from '@/lib/supabase'
import { type CrmLead, isLeadHistorico } from '@/hooks/useAgenteIA'
import { valorNumerico } from '@/lib/utils'
import type { Intervalo } from '@/lib/periodos'
import { chavePedido, dataAtividade, dataVenda, ehVenda, noPeriodo, receita } from './base'

export type EtapaFunil = {
  id: string
  rotulo: string
  valor: number
  /** 0-1 para a largura da barra, sempre relativo à maior etapa */
  fatia: number
  /** conversão em relação à etapa anterior; null na primeira */
  passagem: number | null
  nota: string
}

export type Funil = {
  etapas: EtapaFunil[]
  receitaFechada: number
  /** vendas com telefone que casam com algum lead — mede o quanto dá pra atribuir */
  vendasCasadas: number
  vendasComTelefone: number
}

export function calcularFunil(
  leads: CrmLead[],
  orcamentos: Orcamento[],
  faixa: Intervalo | null,
  mapaTelefone: Map<string, CrmLead>,
  normalizar: (v: string | null | undefined) => string,
): Funil {
  const conversas = leads.filter((l) => !isLeadHistorico(l) && noPeriodo(dataAtividade(l), faixa))
  const orcadas = conversas.filter((l) => valorNumerico(l.ultimo_valor_cotado) > 0)

  const doPeriodo = orcamentos.filter((o) => noPeriodo(dataVenda(o), faixa))
  const vendas = doPeriodo.filter(ehVenda)
  const receitaFechada = vendas.reduce((s, o) => s + receita(o), 0)
  // itens do mesmo pedido são uma venda só, como no número de abertura da aba
  const pedidos = new Set(vendas.map(chavePedido)).size

  const comTelefone = vendas.filter((o) => !!o.telefone && o.telefone.trim() !== '')
  const casadas = comTelefone.filter((o) => mapaTelefone.has(normalizar(o.telefone)))

  const bruto = [
    { id: 'conversas', rotulo: 'Conversas atendidas', valor: conversas.length, nota: 'gente que chamou no WhatsApp' },
    { id: 'orcadas', rotulo: 'Receberam orçamento', valor: orcadas.length, nota: 'a Amanda passou preço na conversa' },
    { id: 'vendas', rotulo: 'Fecharam', valor: pedidos, nota: 'pedidos registrados no Semanário' },
  ]

  // a base da barra é a MAIOR etapa, não a primeira: quando entram vendas de balcão o
  // fim pode passar o meio, e ancorar no topo estouraria a barra pra fora do card
  const maior = Math.max(1, ...bruto.map((e) => e.valor))

  return {
    etapas: bruto.map((e, i) => ({
      ...e,
      fatia: e.valor / maior,
      passagem: i === 0 || bruto[i - 1].valor === 0 ? null : (e.valor / bruto[i - 1].valor) * 100,
    })),
    receitaFechada,
    vendasCasadas: casadas.length,
    vendasComTelefone: comTelefone.length,
  }
}
