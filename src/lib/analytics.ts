import type { Orcamento } from './supabase'

export function calcPropensityScore(o: Orcamento, allData: Orcamento[]): number {
  if (o.fechado) return -1
  let score = 55

  const dias = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400000)
  score -= Math.max(0, (dias - 2)) * 4

  const doResp = allData.filter(x => x.responsavel === o.responsavel)
  const taxa = doResp.length >= 3 ? doResp.filter(x => x.fechado === true).length / doResp.length : 0.45
  score += Math.round((taxa - 0.45) * 40)

  const receita = (o.valor_venda ?? 0) + (o.instacao ?? 0)
  if (receita > 30000) score -= 12
  else if (receita > 10000) score -= 6

  const diasUpdate = Math.floor((Date.now() - new Date(o.updated_at ?? o.created_at).getTime()) / 86400000)
  if (diasUpdate <= 2) score += 10

  if (o.telefone) score += 5

  return Math.max(5, Math.min(99, Math.round(score)))
}

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
