/**
 * O dinheiro — com duas correções que o painel antigo não fazia.
 *
 * 1. Receita usa `valor_cobrado` quando existe (ver `base.ts`). O painel antigo somava
 *    `valor_venda + instalacao` e mostrava um faturamento diferente do da aba "Por canal"
 *    para o mesmo mês.
 * 2. Ticket médio é por PEDIDO, não por item. Um pedido de três persianas são três
 *    linhas em `orcamentos`; dividir a receita pelas linhas dá um ticket que não existe
 *    em nenhuma nota fiscal.
 */

import type { Orcamento } from '@/lib/supabase'
import type { Intervalo } from '@/lib/periodos'
import { dataVenda, ehVenda, noPeriodo, receita } from './base'
import { mesDaCasa } from '@/lib/fusoCasa'

export type ResumoDinheiro = {
  receita: number
  itens: number
  pedidos: number
  ticketPorPedido: number | null
  margemMedia: number | null
  comMargem: number
  cotacoes: number
}

/** Itens do mesmo pedido contam como um só; item solto é o próprio pedido. */
function contarPedidos(vendas: Orcamento[]): number {
  const comPedido = new Set<string>()
  let avulsos = 0
  for (const o of vendas) {
    if (o.pedido_id) comPedido.add(o.pedido_id)
    else avulsos++
  }
  return comPedido.size + avulsos
}

export function resumoDinheiro(orcamentos: Orcamento[], faixa: Intervalo | null): ResumoDinheiro {
  const doPeriodo = orcamentos.filter((o) => noPeriodo(dataVenda(o), faixa))
  const vendas = doPeriodo.filter(ehVenda)
  const total = vendas.reduce((s, o) => s + receita(o), 0)
  const pedidos = contarPedidos(vendas)
  const comMargem = vendas.filter((o) => o.margem != null)

  return {
    receita: total,
    itens: vendas.length,
    pedidos,
    ticketPorPedido: pedidos > 0 ? total / pedidos : null,
    margemMedia: comMargem.length
      ? comMargem.reduce((s, o) => s + (o.margem ?? 0), 0) / comMargem.length
      : null,
    comMargem: comMargem.length,
    cotacoes: doPeriodo.length - vendas.length,
  }
}

export type MesReceita = { mes: string; rotulo: string; receita: number; vendas: number }

/**
 * Receita por mês civil. Mês sem fechamento entra com zero de propósito — a barra
 * vazia de abril a julho é informação (o Semanário só começou em agosto), não bug.
 */
export function receitaPorMes(orcamentos: Orcamento[], meses = 6, agora = new Date()): MesReceita[] {
  const saida: MesReceita[] = []
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    const doMes = orcamentos.filter((o) => {
      if (!ehVenda(o)) return false
      // mês de São Paulo, não o do relógio de quem abriu a tela
      return mesDaCasa(dataVenda(o)) === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    saida.push({
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      rotulo: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      receita: doMes.reduce((s, o) => s + receita(o), 0),
      vendas: doMes.length,
    })
  }
  return saida
}

export type LinhaModelo = {
  modelo: string
  cotacoes: number
  vendas: number
  receita: number
  custo: number
  margem: number | null
}

/**
 * Faturamento, custo e margem saem SÓ das vendas fechadas — misturar o custo das
 * cotações da calculadora com a receita das vendas já produziu margem de -1851% nesta
 * tela. Cotação entra como coluna própria (demanda), nada mais.
 */
export function rentabilidadePorModelo(orcamentos: Orcamento[], faixa: Intervalo | null): LinhaModelo[] {
  const mapa = new Map<string, LinhaModelo>()
  for (const o of orcamentos) {
    if (!noPeriodo(dataVenda(o), faixa)) continue
    if (!mapa.has(o.modelo)) {
      mapa.set(o.modelo, { modelo: o.modelo, cotacoes: 0, vendas: 0, receita: 0, custo: 0, margem: null })
    }
    const linha = mapa.get(o.modelo)!
    if (ehVenda(o)) {
      linha.vendas++
      linha.receita += receita(o)
      if (o.custo_tecido != null && o.custo_tecido > 0) linha.custo += o.custo_tecido
    } else {
      linha.cotacoes++
    }
  }
  return [...mapa.values()]
    .map((l) => ({
      ...l,
      margem: l.receita > 0 && l.custo > 0 ? ((l.receita - l.custo) / l.receita) * 100 : null,
    }))
    .sort((a, b) => b.receita - a.receita || b.cotacoes - a.cotacoes)
}
