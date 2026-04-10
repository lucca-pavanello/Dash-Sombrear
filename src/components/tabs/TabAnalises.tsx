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

  const thisMonth = filterOrcamentosPorMes(data, now.getFullYear(), now.getMonth())
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = filterOrcamentosPorMes(data, lastMonthDate.getFullYear(), lastMonthDate.getMonth())

  const thisFat = calcFaturamentoPorMes(data, now.getFullYear(), now.getMonth())
  const lastFat = calcFaturamentoPorMes(data, lastMonthDate.getFullYear(), lastMonthDate.getMonth())

  if (lastFat > 0 && thisFat > 0) {
    const pct = ((thisFat - lastFat) / lastFat) * 100
    if (pct > 5) insights.push(`Faturamento cresceu ${pct.toFixed(0)}% em relação ao mês anterior — bom ritmo de vendas.`)
    else if (pct < -5) insights.push(`Faturamento caiu ${Math.abs(pct).toFixed(0)}% em relação ao mês anterior — vale reforçar o acompanhamento dos leads.`)
    else insights.push(`Faturamento estável em relação ao mês anterior.`)
  }

  const byResp = Object.entries(
    data.reduce<Record<string, { total: number; feitos: number }>>((acc, o) => {
      if (!acc[o.responsavel]) acc[o.responsavel] = { total: 0, feitos: 0 }
      acc[o.responsavel].total++
      if (o.fechado === true) acc[o.responsavel].feitos++
      return acc
    }, {})
  )
    .map(([name, s]) => ({ name, ...s, taxa: s.total > 0 ? s.feitos / s.total : 0 }))
    .filter((r) => r.total >= 3)
    .sort((a, b) => b.taxa - a.taxa)

  if (byResp.length > 0) {
    const best = byResp[0]
    insights.push(`${best.name} tem a melhor taxa de conversão: ${(best.taxa * 100).toFixed(0)}% (${best.feitos} de ${best.total} fechados).`)
  }

  const byModelo = Object.entries(
    data.reduce<Record<string, number>>((acc, o) => { acc[o.modelo] = (acc[o.modelo] ?? 0) + 1; return acc }, {})
  ).sort((a, b) => b[1] - a[1])

  if (byModelo.length > 0 && data.length > 0) {
    const [modelo, count] = byModelo[0]
    insights.push(`Modelo mais solicitado: ${modelo} (${((count / data.length) * 100).toFixed(0)}% dos orçamentos).`)
  }

  const thisFechados = thisMonth.filter((o) => o.fechado === true)
  const lastFechados = lastMonth.filter((o) => o.fechado === true)
  if (thisFechados.length > 0 && lastFechados.length > 0 && thisFat > 0 && lastFat > 0) {
    const thisAvg = thisFat / thisFechados.length
    const lastAvg = lastFat / lastFechados.length
    const pct = ((thisAvg - lastAvg) / lastAvg) * 100
    if (Math.abs(pct) > 5) {
      insights.push(`Ticket médio ${pct > 0 ? 'subiu' : 'caiu'} ${Math.abs(pct).toFixed(0)}% — de ${formatCurrency(lastAvg)} para ${formatCurrency(thisAvg)}.`)
    }
  }

  if (thisMonth.length > 0 && lastMonth.length > 0) {
    const pct = ((thisMonth.length - lastMonth.length) / lastMonth.length) * 100
    if (pct > 15) insights.push(`Volume de orçamentos cresceu ${pct.toFixed(0)}% vs mês anterior — pipeline aquecido.`)
    else if (pct < -15) insights.push(`Volume de orçamentos caiu ${Math.abs(pct).toFixed(0)}% vs mês anterior — vale prospectar mais ativamente.`)
  }

  if (insights.length === 0) {
    insights.push('Dados insuficientes para análise. Continue registrando orçamentos para ver os insights.')
  }

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

// ─── TabAnalises ────────────────────────────────────────────────────────────

export default function TabAnalises({ data, isLoading, error }: Props) {
  // useMemo deve ficar antes dos early returns para não violar Rules of Hooks
  const { monthly, daily, insights, now, fechados, valorVendaTotal, faturamentoGeral, fechadosComMargem, margemMedia, thisFat, lastFat, fatPct, thisConv, convPct, volPct, thisMonth } = useMemo(() => {
    const now = new Date()
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const monthly = getMonthlyDataSeries(data)
    const daily = getDailyTrend(data)
    const insights = generateInsights(data)
    const fechados = data.filter((o) => o.fechado === true)
    const valorVendaTotal = fechados.reduce((s, o) => s + (o.valor_venda ?? 0), 0)
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
    return { monthly, daily, insights, now, fechados, valorVendaTotal, faturamentoGeral, fechadosComMargem, margemMedia, thisFat, lastFat, fatPct, thisConv, convPct, volPct, thisMonth }
  }, [data])

  // ── Memos Planilha Custos ──
  const comCusto = useMemo(() => data.filter((o) => o.custo_tecido != null && o.custo_tecido > 0), [data])
  const comCustoMes = useMemo(() => filterByPeriod(comCusto, 'mes', (o) => o.created_at), [comCusto])
  const totalMesCusto = useMemo(() => comCustoMes.reduce((s, o) => s + (o.custo_tecido ?? 0), 0), [comCustoMes])
  const usosSemana = useMemo(() => filterByPeriod(comCusto, 'semana', (o) => o.created_at).length, [comCusto])
  const diasDecorridos = now.getDate()
  const mediaDiaria = diasDecorridos > 0 ? totalMesCusto / diasDecorridos : 0

  const custoPorModelo = useMemo(() =>
    comCusto.reduce<Record<string, { total: number; count: number }>>((acc, o) => {
      if (!acc[o.modelo]) acc[o.modelo] = { total: 0, count: 0 }
      acc[o.modelo].total += o.custo_tecido ?? 0
      acc[o.modelo].count += 1
      return acc
    }, {}), [comCusto])

  const tecidosPorModelo = useMemo(() =>
    comCusto.reduce<Record<string, Record<string, number>>>((acc, o) => {
      if (!o.tecido) return acc
      if (!acc[o.modelo]) acc[o.modelo] = {}
      acc[o.modelo][o.tecido] = (acc[o.modelo][o.tecido] ?? 0) + 1
      return acc
    }, {}), [comCusto])

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

  const comparisons = [
    { label: 'Faturamento este mês', value: formatCurrency(thisFat), delta: <Delta pct={fatPct} suffix="%" /> },
    { label: 'Mês anterior', value: formatCurrency(lastFat), delta: null },
    { label: 'Orçamentos este mês', value: String(thisMonth.length), delta: <Delta pct={volPct} suffix="%" /> },
    { label: 'Conversão este mês', value: `${thisConv.toFixed(0)}%`, delta: <Delta pct={convPct} suffix="pp" /> },
  ]

  return (
    <div className="space-y-10">

      {/* ════════ Seção 1: Planilha Orçamentos ════════ */}
      <section className="space-y-5">

        {/* Header da seção */}
        <div className="flex items-center gap-3">
          <div className="h-5 w-1 shrink-0 rounded-full bg-primary" />
          <h2 className="font-display text-base font-semibold tracking-wide">Planilha Orçamentos</h2>
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

        {/* 1 — Totais gerais (hero metrics) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Valor de Venda', value: formatCurrency(valorVendaTotal), sub: `${fechados.length} pedido${fechados.length !== 1 ? 's' : ''} fechado${fechados.length !== 1 ? 's' : ''}` },
            { label: 'Faturamento Total', value: formatCurrency(faturamentoGeral), sub: 'venda + instalação' },
            { label: 'Margem Média', value: margemMedia !== null ? `${margemMedia.toFixed(1)}%` : '—', sub: fechadosComMargem.length > 0 ? `${fechadosComMargem.length} pedidos com margem calculada` : 'sem dados de custo' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border-2 border-primary/20 bg-primary/[0.04] p-5 shadow-sm transition-all duration-200 hover:shadow-elevated hover:-translate-y-px cursor-default">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/60">{label}</p>
              <p className="font-display mt-1.5 text-3xl font-bold tracking-tight text-primary">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>

        {/* 2 — Análise Automática (contextualiza os totais) */}
        {insights.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="rounded-md bg-primary/10 p-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="font-display text-sm font-semibold tracking-wide">Análise Automática</h3>
              <span className="ml-auto text-[11px] text-muted-foreground">baseado nos dados atuais</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {insights.map((insight, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-px">
                  <span className="block font-display text-3xl font-bold text-primary/15 leading-none mb-2 tabular-nums select-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm leading-relaxed text-foreground/80">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3 — KPIs do mês atual */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {comparisons.map(({ label, value, delta }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-px cursor-default">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
              <p className="font-display mt-1.5 text-2xl font-bold tracking-tight truncate">{value}</p>
              <div className="mt-1">{delta ?? <span className="text-[11px] text-muted-foreground/50">base de comparação</span>}</div>
            </div>
          ))}
        </div>

        {/* 3 — Gráficos lado a lado: Faturamento | Volume */}
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

        {/* 4 — Tendência diária (full width) */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <div className="flex items-baseline justify-between mb-0.5">
            <h3 className="font-display text-sm font-medium tracking-wide">Tendência diária</h3>
            <span className="text-xs text-muted-foreground capitalize">
              {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">Orçamentos criados por dia no mês atual</p>
          {daily.length === 0 ? (
            <div className="flex h-[140px] items-center justify-center text-sm text-muted-foreground">Sem dados este mês</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
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

        {/* 5 — Conversão por Modelo (full width) */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="font-display text-sm font-medium tracking-wide">Taxa de Conversão por Modelo</h3>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">% de orçamentos fechados por modelo</p>
          <ConversaoPorModelo data={data} />
        </div>

      </section>

      {/* ════════ Seção 2: Planilha Custos ════════ */}
      <section className="space-y-5">

        {/* Header da seção */}
        <div className="flex items-center gap-3">
          <div className="h-5 w-1 shrink-0 rounded-full bg-muted-foreground/30" />
          <h2 className="font-display text-base font-semibold tracking-wide">Planilha Custos</h2>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* KPIs — horizontal, com sub-label */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Custo Total no Mês', value: formatCurrency(totalMesCusto), sub: `${comCustoMes.length} orçamento${comCustoMes.length !== 1 ? 's' : ''} calculado${comCustoMes.length !== 1 ? 's' : ''}` },
            { label: 'Usos na Semana', value: String(usosSemana), sub: 'orçamentos esta semana' },
            { label: 'Média Diária', value: formatCurrency(mediaDiaria), sub: `referente a ${diasDecorridos} dia${diasDecorridos !== 1 ? 's' : ''} do mês` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md cursor-default">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="font-display mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>

        {/* Custo por Modelo */}
        {Object.keys(custoPorModelo).length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum custo registrado ainda.</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Use a aba Calcular Orçamento para registrar custos.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="border-b px-5 py-4">
              <h3 className="font-display text-sm font-medium tracking-wide">Custo por Modelo</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {comCusto.length} orçamento{comCusto.length !== 1 ? 's' : ''} com custo registrado
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Modelo</th>
                    <th className="px-5 py-3 text-center font-medium text-muted-foreground">Qtd.</th>
                    <th className="px-5 py-3 text-right font-medium text-muted-foreground">Custo Total</th>
                    <th className="px-5 py-3 text-right font-medium text-muted-foreground">Custo Médio</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Top Tecido</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(custoPorModelo)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([modelo, { total, count }]) => {
                      const tecidos = tecidosPorModelo[modelo] ?? {}
                      const topTecido = Object.entries(tecidos).sort(([, a], [, b]) => b - a)[0]
                      return (
                        <tr key={modelo} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5 font-medium">{modelo}</td>
                          <td className="px-5 py-3.5 text-center tabular-nums">{count}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums">{formatCurrency(total)}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums">{formatCurrency(count > 0 ? total / count : 0)}</td>
                          <td className="px-5 py-3.5">
                            {topTecido ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span>{topTecido[0]}</span>
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary leading-none">{topTecido[1]}×</span>
                              </span>
                            ) : <span className="text-muted-foreground/50">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wide">Total</td>
                    <td className="px-5 py-3 text-center tabular-nums">{comCusto.length}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-primary">
                      {formatCurrency(comCusto.reduce((s, o) => s + (o.custo_tecido ?? 0), 0))}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatCurrency(comCusto.length > 0 ? comCusto.reduce((s, o) => s + (o.custo_tecido ?? 0), 0) / comCusto.length : 0)}
                    </td>
                    <td className="px-5 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

      </section>
    </div>
  )
}
