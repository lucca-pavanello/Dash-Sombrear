import { useMemo } from 'react'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, FileDown, AlertCircle } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import {
  filterOrcamentosPorMes,
  calcFaturamentoPorMes,
  getMonthlyDataSeries,
} from '@/lib/analytics'

interface Props { data: Orcamento[]; isLoading?: boolean; error?: boolean }

function getDailyTrend(data: Orcamento[]) {
  const now = new Date()
  const today = now.getDate()
  const counts: Record<number, number> = {}
  data
    .filter((o) => {
      const d = new Date(o.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .forEach((o) => {
      const day = new Date(o.created_at).getDate()
      counts[day] = (counts[day] ?? 0) + 1
    })
  return Array.from({ length: today }, (_, i) => ({ dia: i + 1, orcamentos: counts[i + 1] ?? 0 }))
}

function generateInsights(data: Orcamento[]): string[] {
  const insights: string[] = []
  const now = new Date()
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const thisMonth = filterOrcamentosPorMes(data, now.getFullYear(), now.getMonth())
  const lastMonth = filterOrcamentosPorMes(data, lastMonthDate.getFullYear(), lastMonthDate.getMonth())
  const fechados = data.filter((o) => o.fechado === true)
  const thisFat = calcFaturamentoPorMes(data, now.getFullYear(), now.getMonth())
  const lastFat = calcFaturamentoPorMes(data, lastMonthDate.getFullYear(), lastMonthDate.getMonth())
  const thisFechados = thisMonth.filter((o) => o.fechado === true)

  // 1. Faturamento vs mês anterior com valores reais
  if (lastFat > 0 && thisFat > 0) {
    const pct = ((thisFat - lastFat) / lastFat) * 100
    if (pct > 5) insights.push(`Faturamento este mês está ${pct.toFixed(0)}% acima do mês anterior — ${formatCurrency(thisFat)} vs ${formatCurrency(lastFat)}. Bom ritmo de vendas.`)
    else if (pct < -5) insights.push(`Faturamento caiu ${Math.abs(pct).toFixed(0)}% em relação ao mês passado — ${formatCurrency(thisFat)} vs ${formatCurrency(lastFat)}. Vale reativar leads em aberto.`)
    else insights.push(`Faturamento estável: ${formatCurrency(thisFat)} este mês vs ${formatCurrency(lastFat)} no mês anterior.`)
  }

  // 2. Projeção para o fim do mês com base no ritmo atual
  const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const diasDecorridos = now.getDate()
  if (diasDecorridos >= 5 && thisFat > 0) {
    const projecao = (thisFat / diasDecorridos) * diasNoMes
    const diffPct = lastFat > 0 ? ((projecao - lastFat) / lastFat) * 100 : null
    const diffTxt = diffPct !== null ? ` (${diffPct > 0 ? '+' : ''}${diffPct.toFixed(0)}% vs mês anterior)` : ''
    insights.push(`Projeção para o fim de ${now.toLocaleDateString('pt-BR', { month: 'long' })}: ${formatCurrency(projecao)}${diffTxt} — com base no ritmo dos últimos ${diasDecorridos} dias.`)
  }

  // 3. Modelo mais e menos lucrativo (requer dados de margem)
  const modelosMargem = Object.entries(
    data.filter((o) => o.fechado === true && o.margem != null && o.margem > 0)
      .reduce<Record<string, { soma: number; count: number }>>((acc, o) => {
        if (!acc[o.modelo]) acc[o.modelo] = { soma: 0, count: 0 }
        acc[o.modelo].soma += o.margem ?? 0
        acc[o.modelo].count += 1
        return acc
      }, {})
  )
    .map(([modelo, s]) => ({ modelo, margem: s.soma / s.count, count: s.count }))
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.margem - a.margem)

  if (modelosMargem.length >= 2) {
    const best = modelosMargem[0]
    const worst = modelosMargem[modelosMargem.length - 1]
    insights.push(`Modelo mais lucrativo: ${best.modelo} com margem média de ${best.margem.toFixed(1)}%. ${worst.modelo} tem a menor margem (${worst.margem.toFixed(1)}%) — revise o preço ou negocie o custo do material.`)
  } else if (modelosMargem.length === 1) {
    insights.push(`${modelosMargem[0].modelo} tem margem média de ${modelosMargem[0].margem.toFixed(1)}% nos pedidos fechados com custo registrado.`)
  }

  // 4. Melhor vendedor com faturamento gerado
  const vendedores = Object.entries(
    data.reduce<Record<string, { total: number; feitos: number; fat: number }>>((acc, o) => {
      if (!acc[o.responsavel]) acc[o.responsavel] = { total: 0, feitos: 0, fat: 0 }
      acc[o.responsavel].total++
      if (o.fechado === true) {
        acc[o.responsavel].feitos++
        acc[o.responsavel].fat += (o.valor_venda ?? 0) + (o.instacao ?? 0)
      }
      return acc
    }, {})
  )
    .map(([name, s]) => ({ name, ...s, taxa: s.total > 0 ? s.feitos / s.total : 0 }))
    .filter((r) => r.total >= 3)
    .sort((a, b) => b.taxa - a.taxa)

  if (vendedores.length >= 2) {
    const best = vendedores[0]
    insights.push(`${best.name} lidera em conversão: ${(best.taxa * 100).toFixed(0)}% (${best.feitos}/${best.total} fechados) e ${formatCurrency(best.fat)} em faturamento total.`)
  } else if (vendedores.length === 1) {
    insights.push(`${vendedores[0].name}: ${(vendedores[0].taxa * 100).toFixed(0)}% de conversão e ${formatCurrency(vendedores[0].fat)} em faturamento.`)
  }

  // 5. Ticket médio este mês vs histórico geral
  const fatGeral = fechados.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)
  const ticketGeral = fechados.length > 0 ? fatGeral / fechados.length : 0
  const ticketMes = thisFechados.length > 0 ? thisFat / thisFechados.length : 0
  if (ticketGeral > 0 && ticketMes > 0 && thisFechados.length >= 2) {
    const diff = ((ticketMes - ticketGeral) / ticketGeral) * 100
    if (diff > 5) insights.push(`Ticket médio este mês (${formatCurrency(ticketMes)}) está ${diff.toFixed(0)}% acima da média histórica (${formatCurrency(ticketGeral)}) — clientes comprando mais.`)
    else if (diff < -5) insights.push(`Ticket médio este mês (${formatCurrency(ticketMes)}) está ${Math.abs(diff).toFixed(0)}% abaixo da média histórica (${formatCurrency(ticketGeral)}) — oportunidade para oferecer upgrades de produto.`)
  }

  // 6. Volume de orçamentos vs mês anterior
  if (thisMonth.length > 0 && lastMonth.length > 0) {
    const pct = ((thisMonth.length - lastMonth.length) / lastMonth.length) * 100
    if (pct > 15) insights.push(`Pipeline aquecido: ${thisMonth.length} orçamentos este mês vs ${lastMonth.length} no anterior (+${pct.toFixed(0)}%). Mais leads entrando no funil.`)
    else if (pct < -15) insights.push(`Volume de orçamentos caiu ${Math.abs(pct).toFixed(0)}% — ${thisMonth.length} este mês vs ${lastMonth.length} no anterior. Intensifique a prospecção.`)
  }

  // 7. Taxa de conversão geral com contexto
  if (data.length >= 10) {
    const conv = (fechados.length / data.length) * 100
    if (conv < 25) insights.push(`Taxa de conversão geral de ${conv.toFixed(0)}% (${fechados.length}/${data.length}) está abaixo do ideal — qualificar melhor os leads antes de orçar pode aumentar esse número.`)
    else if (conv >= 50) insights.push(`Taxa de conversão de ${conv.toFixed(0)}% (${fechados.length}/${data.length}) — excelente aproveitamento do pipeline. Acima da média do setor.`)
  }

  if (insights.length === 0) insights.push('Continue registrando orçamentos para ver os insights automáticos.')

  return insights
}

function Delta({ pct, suffix = '%' }: { pct: number | null; suffix?: string }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus
  const color = pct > 0 ? 'text-primary' : pct < 0 ? 'text-destructive' : 'text-muted-foreground'
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(0)}{suffix} vs mês ant.
    </span>
  )
}

const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' },
  labelStyle: { fontWeight: 600, color: 'hsl(var(--foreground))' },
}

function exportPDF(data: Orcamento[]) {
  const doc = new jsPDF()
  const now = new Date()
  const orange: [number, number, number] = [232, 112, 26]

  // Header
  doc.setFillColor(...orange)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Loja Sombrear', 14, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Relatório de Orçamentos', 14, 20)
  doc.text(`Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 210 - 14, 20, { align: 'right' })

  const thisFat = calcFaturamentoPorMes(data, now.getFullYear(), now.getMonth())
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastFat = calcFaturamentoPorMes(data, lastMonthDate.getFullYear(), lastMonthDate.getMonth())
  const thisMonth = filterOrcamentosPorMes(data, now.getFullYear(), now.getMonth())
  const thisConv = thisMonth.length > 0 ? (thisMonth.filter((o) => o.fechado === true).length / thisMonth.length) * 100 : 0
  const fechados = data.filter((o) => o.fechado === true)
  const faturamentoTotal = fechados.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)

  doc.setTextColor(40, 40, 40)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo do Período', 14, 38)

  const kpis = [
    ['Total de orçamentos', String(data.length)],
    ['Orçamentos fechados', String(fechados.length)],
    ['Taxa de conversão', `${data.length > 0 ? ((fechados.length / data.length) * 100).toFixed(0) : 0}%`],
    ['Faturamento total', formatCurrency(faturamentoTotal)],
    ['Faturamento mês atual', formatCurrency(thisFat)],
    ['Faturamento mês anterior', formatCurrency(lastFat)],
    ['Orçamentos este mês', String(thisMonth.length)],
    ['Conversão mês atual', `${thisConv.toFixed(0)}%`],
  ]

  autoTable(doc, {
    startY: 42,
    head: [['Indicador', 'Valor']],
    body: kpis,
    theme: 'grid',
    headStyles: { fillColor: orange, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { fontStyle: 'bold', halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  // Ranking responsáveis
  const byResp = Object.entries(
    data.reduce<Record<string, { total: number; feitos: number; fat: number }>>((acc, o) => {
      if (!acc[o.responsavel]) acc[o.responsavel] = { total: 0, feitos: 0, fat: 0 }
      acc[o.responsavel].total++
      if (o.fechado === true) { acc[o.responsavel].feitos++; acc[o.responsavel].fat += (o.valor_venda ?? 0) + (o.instacao ?? 0) }
      return acc
    }, {})
  )
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.fat - a.fat)
    .map(({ name, total, feitos, fat }) => [name, String(total), String(feitos), `${total > 0 ? ((feitos / total) * 100).toFixed(0) : 0}%`, formatCurrency(fat)])

  const afterKpi = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Ranking de Responsáveis', 14, afterKpi)

  autoTable(doc, {
    startY: afterKpi + 4,
    head: [['Responsável', 'Orçamentos', 'Fechados', 'Conversão', 'Faturamento']],
    body: byResp,
    theme: 'striped',
    headStyles: { fillColor: orange, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 4: { fontStyle: 'bold', halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  // Tabela de orçamentos fechados
  const afterRanking = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  const fechadosRows = fechados
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((o) => [
      new Date(o.created_at).toLocaleDateString('pt-BR'),
      o.cliente ?? '—',
      o.responsavel,
      o.modelo,
      o.tecido,
      o.valor_venda ? formatCurrency(o.valor_venda) : '—',
    ])

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Orçamentos Fechados', 14, afterRanking)

  autoTable(doc, {
    startY: afterRanking + 4,
    head: [['Data', 'Cliente', 'Responsável', 'Modelo', 'Tecido', 'Valor']],
    body: fechadosRows,
    theme: 'striped',
    headStyles: { fillColor: orange, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 5: { fontStyle: 'bold', halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  // Footer on each page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    doc.text(`Loja Sombrear · Página ${i} de ${pageCount}`, 105, 290, { align: 'center' })
  }

  doc.save(`relatorio-sombrear-${now.toISOString().slice(0, 10)}.pdf`)
}

function ConversaoPorModelo({ data }: { data: Orcamento[] }) {
  const byModelo = useMemo(() => Object.entries(
    data.reduce<Record<string, { total: number; fechados: number }>>((acc, o) => {
      if (!acc[o.modelo]) acc[o.modelo] = { total: 0, fechados: 0 }
      acc[o.modelo].total++
      if (o.fechado === true) acc[o.modelo].fechados++
      return acc
    }, {})
  )
    .map(([modelo, s]) => ({
      modelo,
      total: s.total,
      fechados: s.fechados,
      taxa: s.total > 0 ? (s.fechados / s.total) * 100 : 0,
    }))
    .sort((a, b) => b.taxa - a.taxa), [data])

  if (byModelo.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sem dados suficientes</p>
  }

  return (
    <div className="space-y-2.5">
      {byModelo.map(({ modelo, total, fechados, taxa }) => (
        <div key={modelo} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs font-medium truncate">{modelo}</span>
          <div className="flex-1 relative h-5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/70 transition-all duration-700"
              style={{ width: `${taxa}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-primary">
            {taxa.toFixed(0)}%
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {fechados}/{total}
          </span>
        </div>
      ))}
    </div>
  )
}

function ConversaoPorResponsavel({ data }: { data: Orcamento[] }) {
  const byResp = useMemo(() => Object.entries(
    data.reduce<Record<string, { total: number; fechados: number; fat: number }>>((acc, o) => {
      if (!acc[o.responsavel]) acc[o.responsavel] = { total: 0, fechados: 0, fat: 0 }
      acc[o.responsavel].total++
      if (o.fechado === true) {
        acc[o.responsavel].fechados++
        acc[o.responsavel].fat += (o.valor_venda ?? 0) + (o.instacao ?? 0)
      }
      return acc
    }, {})
  )
    .map(([resp, s]) => ({ resp, total: s.total, fechados: s.fechados, fat: s.fat, taxa: s.total > 0 ? (s.fechados / s.total) * 100 : 0 }))
    .sort((a, b) => b.taxa - a.taxa), [data])

  if (byResp.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Sem dados suficientes</p>

  return (
    <div className="space-y-2.5">
      {byResp.map(({ resp, total, fechados, taxa, fat }) => (
        <div key={resp} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs font-medium truncate">{resp}</span>
          <div className="flex-1 relative h-5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary/70 transition-all duration-700" style={{ width: `${taxa}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-primary">{taxa.toFixed(0)}%</span>
          <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{fechados}/{total}</span>
          <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums hidden sm:block">{formatCurrency(fat)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── TabAnalises ────────────────────────────────────────────────────────────

export default function TabAnalises({ data, isLoading, error }: Props) {
  // useMemo deve ficar antes dos early returns para não violar Rules of Hooks
  const { monthly, daily, insights, now, fechados, faturamentoGeral, fechadosComMargem, margemMedia, thisFat, lastFat, fatPct, thisConv, convPct, volPct, thisMonth } = useMemo(() => {
    const now = new Date()
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const monthly = getMonthlyDataSeries(data)
    const daily = getDailyTrend(data)
    const insights = generateInsights(data)
    const fechados = data.filter((o) => o.fechado === true)
    const faturamentoGeral = fechados.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)
    const fechadosComMargem = fechados.filter((o) => o.margem != null)
    const margemMedia = fechadosComMargem.length > 0
      ? fechadosComMargem.reduce((s, o) => s + (o.margem ?? 0), 0) / fechadosComMargem.length
      : null
    const thisMonth = filterOrcamentosPorMes(data, now.getFullYear(), now.getMonth())
    const lastMonth = filterOrcamentosPorMes(data, lastMonthDate.getFullYear(), lastMonthDate.getMonth())
    const thisFat = calcFaturamentoPorMes(data, now.getFullYear(), now.getMonth())
    const lastFat = calcFaturamentoPorMes(data, lastMonthDate.getFullYear(), lastMonthDate.getMonth())
    const fatPct = lastFat > 0 ? ((thisFat - lastFat) / lastFat) * 100 : null
    const thisConv = thisMonth.length > 0 ? (thisMonth.filter((o) => o.fechado === true).length / thisMonth.length) * 100 : 0
    const lastConv = lastMonth.length > 0 ? (lastMonth.filter((o) => o.fechado === true).length / lastMonth.length) * 100 : 0
    const convPct = lastConv > 0 ? thisConv - lastConv : null
    const volPct = lastMonth.length > 0 ? ((thisMonth.length - lastMonth.length) / lastMonth.length) * 100 : null
    return { monthly, daily, insights, now, fechados, faturamentoGeral, fechadosComMargem, margemMedia, thisFat, lastFat, fatPct, thisConv, convPct, volPct, thisMonth }
  }, [data])

  const comCusto = useMemo(() => data.filter((o) => o.custo_tecido != null && o.custo_tecido > 0), [data])
  const comCustoMes = useMemo(() => filterByPeriod(comCusto, 'mes', (o) => o.created_at), [comCusto])
  const totalMesCusto = useMemo(() => comCustoMes.reduce((s, o) => s + (o.custo_tecido ?? 0), 0), [comCustoMes])
  const usosSemana = useMemo(() => filterByPeriod(comCusto, 'semana', (o) => o.created_at).length, [comCusto])
  const diasDecorridosCusto = now.getDate()
  const mediaDiaria = diasDecorridosCusto > 0 ? totalMesCusto / diasDecorridosCusto : 0

  const rentabilidadePorModelo = useMemo(() => {
    const map: Record<string, { count: number; fat: number; custo: number; fechados: number; tecidos: Record<string, number> }> = {}
    for (const o of data) {
      if (!map[o.modelo]) map[o.modelo] = { count: 0, fat: 0, custo: 0, fechados: 0, tecidos: {} }
      map[o.modelo].count++
      if (o.fechado === true) {
        map[o.modelo].fat += (o.valor_venda ?? 0) + (o.instacao ?? 0)
        map[o.modelo].fechados++
      }
      if (o.custo_tecido != null && o.custo_tecido > 0) map[o.modelo].custo += o.custo_tecido
      if (o.tecido) map[o.modelo].tecidos[o.tecido] = (map[o.modelo].tecidos[o.tecido] ?? 0) + 1
    }
    return Object.entries(map)
      .map(([modelo, s]) => ({
        modelo,
        count: s.count,
        fechados: s.fechados,
        fat: s.fat,
        custo: s.custo,
        margem: s.fat > 0 && s.custo > 0 ? ((s.fat - s.custo) / s.fat) * 100 : null,
        conv: s.count > 0 ? (s.fechados / s.count) * 100 : 0,
        topTecido: Object.entries(s.tecidos).sort(([, a], [, b]) => b - a)[0] ?? null,
      }))
      .sort((a, b) => b.fat - a.fat)
  }, [data])

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse bg-muted rounded-xl h-20" />)}
        </div>
        <div className="animate-pulse bg-muted rounded-xl h-48" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="animate-pulse bg-muted rounded-xl h-48" />
          <div className="animate-pulse bg-muted rounded-xl h-48" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-8 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        <p className="text-sm font-medium text-destructive">Erro ao carregar análises. Tente recarregar a página.</p>
      </div>
    )
  }

  const ticketMedio = fechados.length > 0 ? faturamentoGeral / fechados.length : 0
  const custoTotal = rentabilidadePorModelo.reduce((s, r) => s + r.custo, 0)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 shrink-0 rounded-full bg-primary" />
        <h2 className="font-display text-base font-semibold tracking-wide">Análises</h2>
        <div className="flex-1 h-px bg-border" />
        <button
          onClick={() => exportPDF(data)}
          title="Exportar relatório em PDF"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-150"
        >
          <FileDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Exportar PDF</span>
        </button>
      </div>

      {/* 1 — Hero KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Faturamento Total', value: formatCurrency(faturamentoGeral), sub: `${fechados.length} pedido${fechados.length !== 1 ? 's' : ''} fechado${fechados.length !== 1 ? 's' : ''}` },
          { label: 'Margem Média', value: margemMedia !== null ? `${margemMedia.toFixed(1)}%` : '—', sub: fechadosComMargem.length > 0 ? `${fechadosComMargem.length} pedidos com custo calculado` : 'registre custos para ver a margem' },
          { label: 'Ticket Médio', value: ticketMedio > 0 ? formatCurrency(ticketMedio) : '—', sub: 'por pedido fechado' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border-2 border-primary/20 bg-primary/[0.04] p-5 shadow-sm transition-all duration-200 hover:shadow-elevated hover:-translate-y-px cursor-default">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/60">{label}</p>
            <p className="font-display mt-1.5 text-3xl font-bold tracking-tight text-primary">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* 2 — KPIs do mês */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Faturamento este mês', value: formatCurrency(thisFat), delta: <Delta pct={fatPct} suffix="%" /> },
          { label: 'Mês anterior', value: formatCurrency(lastFat), delta: null },
          { label: 'Orçamentos este mês', value: String(thisMonth.length), delta: <Delta pct={volPct} suffix="%" /> },
          { label: 'Conversão este mês', value: `${thisConv.toFixed(0)}%`, delta: <Delta pct={convPct} suffix="pp" /> },
        ].map(({ label, value, delta }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-px cursor-default">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
            <p className="font-display mt-1.5 text-2xl font-bold tracking-tight truncate">{value}</p>
            <div className="mt-1">{delta ?? <span className="text-[11px] text-muted-foreground/50">base de comparação</span>}</div>
          </div>
        ))}
      </div>

      {/* 3 — Análise Automática */}
      {insights.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="rounded-md bg-primary/10 p-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="font-display text-sm font-semibold tracking-wide">Análise Automática</h3>
            <span className="ml-auto text-[11px] text-muted-foreground">baseado nos dados atuais</span>
          </div>
          <div className="space-y-2.5">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-4 rounded-lg bg-muted/40 px-4 py-3.5 hover:bg-muted/60 transition-colors">
                <span className="font-display text-2xl font-bold text-primary/25 leading-none tabular-nums select-none shrink-0 w-7 mt-0.5">{i + 1}</span>
                <p className="text-sm leading-relaxed text-foreground/85">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 — Gráficos lado a lado */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="font-display text-sm font-medium tracking-wide">Faturamento mensal</h3>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Últimos 6 meses — pedidos fechados</p>
          {monthly.every((m) => m.faturamento === 0) ? (
            <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">Sem dados ainda</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthly} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [formatCurrency(v), 'Faturamento']} />
                <Bar dataKey="faturamento" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" fillOpacity={0.85} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="font-display text-sm font-medium tracking-wide">Volume de orçamentos</h3>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Últimos 6 meses — todos os registros</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthly} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'Orçamentos']} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" fillOpacity={0.5} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4 — Rentabilidade por Modelo */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b px-5 py-4">
          <h3 className="font-display text-sm font-medium tracking-wide">Rentabilidade por Modelo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Faturamento, custo, margem e top tecido por tipo de produto</p>
        </div>
        {rentabilidadePorModelo.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum dado registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-6 py-3.5 text-left font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[22%]">Modelo</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[8%]">Orç.</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[12%]">Conversão</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[17%]">Faturamento</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[17%]">Custo</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[12%]">Margem</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[12%]">Top Tecido</th>
                </tr>
              </thead>
              <tbody>
                {rentabilidadePorModelo.map(({ modelo, count, fat, custo, margem, conv, topTecido }) => (
                  <tr key={modelo} className="border-b last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 font-semibold whitespace-nowrap">{modelo}</td>
                    <td className="px-4 py-4 text-center tabular-nums text-muted-foreground">{count}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                        conv >= 50 ? 'bg-primary/10 text-primary' : conv >= 25 ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {conv.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums font-medium whitespace-nowrap">{fat > 0 ? formatCurrency(fat) : <span className="text-muted-foreground/30">—</span>}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-muted-foreground whitespace-nowrap">{custo > 0 ? formatCurrency(custo) : <span className="text-muted-foreground/30">—</span>}</td>
                    <td className="px-6 py-4 text-center">
                      {margem !== null
                        ? <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                            margem >= 40 ? 'bg-primary/10 text-primary' : margem >= 20 ? 'bg-muted text-foreground' : 'bg-destructive/10 text-destructive'
                          }`}>{margem.toFixed(1)}%</span>
                        : <span className="text-muted-foreground/30">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {topTecido
                        ? <span className="inline-flex items-center gap-1.5"><span className="text-xs whitespace-nowrap">{topTecido[0]}</span><span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground leading-none">{topTecido[1]}×</span></span>
                        : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td className="px-6 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-widest">Total</td>
                  <td className="px-4 py-3.5 text-center tabular-nums font-semibold">{data.length}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary tabular-nums">
                      {data.length > 0 ? ((fechados.length / data.length) * 100).toFixed(0) : 0}%
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right tabular-nums font-bold text-primary whitespace-nowrap">{formatCurrency(faturamentoGeral)}</td>
                  <td className="px-6 py-3.5 text-right tabular-nums font-semibold text-muted-foreground whitespace-nowrap">{custoTotal > 0 ? formatCurrency(custoTotal) : '—'}</td>
                  <td className="px-6 py-3.5 text-center">
                    {margemMedia !== null
                      ? <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                          margemMedia >= 40 ? 'bg-primary/10 text-primary' : margemMedia >= 20 ? 'bg-muted text-foreground' : 'bg-destructive/10 text-destructive'
                        }`}>{margemMedia.toFixed(1)}%</span>
                      : <span className="text-muted-foreground/30">—</span>}
                  </td>
                  <td className="px-6 py-3.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 5 — Custos do mês */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Custo Total no Mês', value: formatCurrency(totalMesCusto), sub: `${comCustoMes.length} orçamento${comCustoMes.length !== 1 ? 's' : ''} com custo calculado` },
          { label: 'Usos na Semana', value: String(usosSemana), sub: 'cálculos realizados esta semana' },
          { label: 'Média Diária de Custo', value: formatCurrency(mediaDiaria), sub: `referente a ${diasDecorridosCusto} dia${diasDecorridosCusto !== 1 ? 's' : ''} do mês` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md cursor-default">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="font-display mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* 6 — Performance por Vendedor + Conversão por Modelo */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="font-display text-sm font-medium tracking-wide">Performance por Vendedor</h3>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Conversão e faturamento por responsável</p>
          <ConversaoPorResponsavel data={data} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="font-display text-sm font-medium tracking-wide">Conversão por Modelo</h3>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">% de orçamentos fechados por modelo</p>
          <ConversaoPorModelo data={data} />
        </div>
      </div>

      {/* 7 — Tendência diária */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
        <div className="flex items-baseline justify-between mb-0.5">
          <h3 className="font-display text-sm font-medium tracking-wide">Tendência diária</h3>
          <span className="text-xs text-muted-foreground capitalize">
            {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">Orçamentos criados por dia no mês atual</p>
        {daily.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">Sem dados este mês</div>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={daily} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb923c" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#fb923c" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'Orçamentos']} />
              <Area type="monotone" dataKey="orcamentos" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#areaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}
