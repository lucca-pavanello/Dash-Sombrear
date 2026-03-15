import type { Orcamento } from './supabase'

export function filterOrcamentosPorMes(data: Orcamento[], year: number, month: number): Orcamento[] {
  return data.filter(o => {
    if (!o.created_at) return false
    const d = new Date(o.created_at)
    return d.getMonth() === month && d.getFullYear() === year
  })
}

export function calcFaturamentoPorMes(data: Orcamento[], year: number, month: number): number {
  return filterOrcamentosPorMes(data, year, month)
    .filter(o => o.fechado === true)
    .reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)
}

export function getMonthlyDataSeries(
  data: Orcamento[],
  months = 6
): Array<{ mes: string; faturamento: number; total: number }> {
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const monthData = filterOrcamentosPorMes(data, date.getFullYear(), date.getMonth())
    return {
      mes: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      faturamento: monthData
        .filter(o => o.fechado === true)
        .reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0),
      total: monthData.length,
    }
  })
}
