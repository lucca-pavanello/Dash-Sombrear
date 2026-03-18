import { useState, useEffect, useMemo } from 'react'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Bot, TrendingUp, TrendingDown, Minus, FileDown, AlertCircle, Users, DollarSign, CheckCircle2, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { useCrmLeads, type CrmLead } from '@/hooks/useAgenteIA'
import { META_KEY, HORA_INICIO, HORA_FIM } from '@/lib/constants'
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

function parseBRL(v: string): number {
  const s = v.trim()
  if (!s) return 0
  // BRL format: has R$ symbol, or ends with comma followed by 1-2 digits (decimal separator)
  const isBRL = s.includes('R$') || /,\d{1,2}$/.test(s.replace(/[R$\s]/g, ''))
  if (isBRL) {
    return parseFloat(s.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
  }
  return parseFloat(s) || 0
}

function FunilAgenteIA({ leads, isLoading }: { leads: CrmLead[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted" />)}</div>
  }

  const totalLeads = leads.length
  const cotados = leads.filter((l) => l.ultimo_valor_cotado && l.ultimo_valor_cotado.trim()).length
  const convertidos = leads.filter((l) => {
    const s = l.status_lead?.toLowerCase().trim() ?? ''
    return s === 'convertido' || s === 'fechado'
  })
  const convertidosCount = convertidos.length
  const faturamentoGerado = convertidos.reduce((s, l) => {
    const v = parseBRL(l.ultimo_valor_cotado ?? '')
    return s + v
  }, 0)

  const etapas = [
    {
      label: 'Total de Leads',
      value: totalLeads,
      display: String(totalLeads),
      pct: 100,
      icon: Users,
      color: 'bg-primary',
      textColor: 'text-primary',
    },
    {
      label: 'Leads Cotados',
      value: cotados,
      display: String(cotados),
      pct: totalLeads > 0 ? (cotados / totalLeads) * 100 : 0,
      icon: FileText,
      color: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Convertidos',
      value: convertidosCount,
      display: String(convertidosCount),
      pct: totalLeads > 0 ? (convertidosCount / totalLeads) * 100 : 0,
      icon: CheckCircle2,
      color: 'bg-green-500',
      textColor: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Faturamento Gerado',
      value: faturamentoGerado,
      display: faturamentoGerado > 0 ? formatCurrency(faturamentoGerado) : '—',
      pct: null,
      icon: DollarSign,
      color: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div className="space-y-3">
      {etapas.map(({ label, display, pct, icon: Icon, color, textColor }, i) => (
        <div key={label} className="flex items-center gap-3">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${color}/15`}>
            <Icon className={`h-3.5 w-3.5 ${textColor}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-medium">{label}</span>
              <span className={`text-sm font-bold tabular-nums ${textColor}`}>{display}</span>
            </div>
            {pct !== null && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
          {pct !== null && i > 0 && (
            <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {pct.toFixed(0)}%
            </span>
          )}
          {(pct === null || i === 0) && <span className="w-12" />}
        </div>
      ))}
    </div>
  )
}

function PerformancePorCanal({ data }: { data: Orcamento[] }) {
  const byCanal = useMemo(() => {
    const map = data
      .filter(o => o.fonte?.trim())
      .reduce<Record<string, { total: number; fechados: number; faturamento: number }>>((acc, o) => {
        const canal = o.fonte!.trim()
        if (!acc[canal]) acc[canal] = { total: 0, fechados: 0, faturamento: 0 }
        acc[canal].total++
        if (o.fechado === true) {
          acc[canal].fechados++
          acc[canal].faturamento += (o.valor_venda ?? 0) + (o.instacao ?? 0)
        }
        return acc
      }, {})
    return Object.entries(map)
      .map(([canal, s]) => ({
        canal,
        total: s.total,
        fechados: s.fechados,
        taxa: s.total > 0 ? (s.fechados / s.total) * 100 : 0,
        faturamento: s.faturamento,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)
  }, [data])

  if (byCanal.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
      <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Performance por Canal</h3>
      {byCanal.length >= 3 ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byCanal} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
            <XAxis dataKey="canal" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [formatCurrency(v), 'Faturamento']} />
            <Bar dataKey="faturamento" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" fillOpacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      ) : null}
      <div className="mt-4 space-y-2.5">
        {byCanal.map(({ canal, total, fechados, taxa, faturamento }) => (
          <div key={canal}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-medium truncate">{canal}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {fechados}/{total} · {taxa.toFixed(0)}% · <span className="font-semibold text-primary">{formatCurrency(faturamento)}</span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div className="h-full rounded-full bg-primary/70 transition-all duration-500" style={{ width: `${taxa}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Desempenho do Agente IA — novos componentes ───────────────────────────

const STATUS_LABEL_MAP: Record<string, { label: string; color: string }> = {
  novo: { label: 'Novo', color: '#94a3b8' },
  em_atendimento: { label: 'Em atendimento', color: '#3b82f6' },
  aguardando_atendimento: { label: 'Aguardando', color: '#f97316' },
  convertido: { label: 'Convertido', color: '#22c55e' },
  fechado: { label: 'Fechado', color: '#16a34a' },
  perdido: { label: 'Perdido', color: '#ef4444' },
}

function StatusLeadDonut({ leads, isLoading }: { leads: CrmLead[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted" />)}
      </div>
    )
  }

  const grouped = leads.reduce<Record<string, number>>((acc, l) => {
    const key = l.status_lead?.trim() ?? 'desconhecido'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const pieData = Object.entries(grouped).map(([key, count]) => {
    const meta = STATUS_LABEL_MAP[key]
    return {
      key,
      name: meta?.label ?? key,
      value: count,
      color: meta?.color ?? '#cbd5e1',
    }
  })

  if (pieData.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        Sem dados de status
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            dataKey="value"
            paddingAngle={2}
          >
            {pieData.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number, name: string) => [v, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {pieData.map((entry) => (
          <div key={entry.key} className="flex items-center gap-1.5 min-w-0">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="truncate text-xs text-muted-foreground">{entry.name}</span>
            <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function VolumeLeadsIA({ leads, isLoading }: { leads: CrmLead[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted" />)}
      </div>
    )
  }

  const now = new Date()
  const last6: { mes: string; leads: number; year: number; month: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    last6.push({ mes: MESES_PT[d.getMonth()], leads: 0, year: d.getFullYear(), month: d.getMonth() })
  }

  leads.forEach((l) => {
    const d = new Date(l.created_at)
    const entry = last6.find((e) => e.year === d.getFullYear() && e.month === d.getMonth())
    if (entry) entry.leads++
  })

  const total = leads.length

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">{total} lead{total !== 1 ? 's' : ''} no total</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={last6} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
          <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'Leads']} />
          <Bar dataKey="leads" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const QUALIDADE_FIELDS: { key: keyof CrmLead; label: string }[] = [
  { key: 'medidas_coletadas', label: 'Medidas coletadas' },
  { key: 'quantidade', label: 'Quantidade' },
  { key: 'tecido_cor', label: 'Tecido / Cor' },
  { key: 'acabamento_desejado', label: 'Acabamento' },
  { key: 'precisa_instalacao', label: 'Precisa instalação' },
  { key: 'modelo_interesse', label: 'Modelo de interesse' },
]

function QualidadeLeads({ leads, isLoading }: { leads: CrmLead[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted" />)}
      </div>
    )
  }

  const total = leads.length

  const fields = QUALIDADE_FIELDS.map(({ key, label }) => {
    const filled = total > 0
      ? leads.filter((l) => {
          const v = l[key]
          return v !== null && v !== undefined && String(v).trim() !== ''
        }).length
      : 0
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0
    return { label, pct }
  })

  const score = fields.length > 0
    ? Math.round(fields.reduce((s, f) => s + f.pct, 0) / fields.length)
    : 0

  if (total === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Sem leads para analisar
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-primary tabular-nums">{score}%</span>
        <span className="text-xs text-muted-foreground">score médio de qualificação</span>
      </div>
      <div className="space-y-2">
        {fields.map(({ label, pct }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-36 shrink-0 text-xs text-muted-foreground truncate">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-primary">
              {pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const PERIODOS = [
  { label: 'Madrugada', range: [0, 5], outOfHours: true },
  { label: 'Manhã', range: [6, 11], outOfHours: false },
  { label: 'Tarde', range: [12, 17], outOfHours: false },
  { label: 'Noite', range: [18, 23], outOfHours: true },
]

function HorarioPico({ leads, isLoading }: { leads: CrmLead[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted" />)}
      </div>
    )
  }

  const counts = PERIODOS.map((p) => ({ ...p, count: 0 }))

  leads.forEach((l) => {
    const raw = l.inicio_atendimento ?? l.created_at
    if (!raw) return
    const h = new Date(raw).getHours()
    const p = counts.find((c) => h >= c.range[0] && h <= c.range[1])
    if (p) p.count++
  })

  const maxCount = Math.max(...counts.map((c) => c.count), 1)
  const total = leads.length

  const foraHorario = leads.filter((l) => {
    const raw = l.inicio_atendimento ?? l.created_at
    if (!raw) return false
    const h = new Date(raw).getHours()
    return h < HORA_INICIO || h >= HORA_FIM
  }).length

  const foraPct = total > 0 ? Math.round((foraHorario / total) * 100) : 0

  return (
    <div className="space-y-3">
      {counts.map(({ label, count, outOfHours }) => (
        <div key={label} className="flex items-center gap-3">
          <span className={`w-20 shrink-0 text-xs font-medium ${outOfHours ? 'text-primary' : 'text-foreground'}`}>
            {label}
          </span>
          <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${outOfHours ? 'bg-primary' : 'bg-primary/40'}`}
              style={{ width: `${(count / maxCount) * 100}%` }}
            />
          </div>
          <span className={`w-8 shrink-0 text-right text-xs font-bold tabular-nums ${outOfHours ? 'text-primary' : 'text-muted-foreground'}`}>
            {count}
          </span>
        </div>
      ))}
      {total > 0 && (
        <p className="pt-1 text-xs text-muted-foreground">
          <span className="font-semibold text-primary">{foraHorario}</span> lead{foraHorario !== 1 ? 's' : ''} fora do horário comercial
          {' '}(<span className="font-semibold">{foraPct}%</span>)
        </p>
      )}
    </div>
  )
}

function InsightsAgenteIA({ leads, isLoading }: { leads: CrmLead[]; isLoading: boolean }) {
  const insights = useMemo(() => {
    if (leads.length === 0) return []
    const total = leads.length
    const result: string[] = []

    // 1. After-hours leads
    const foraHorario = leads.filter((l) => {
      const raw = l.inicio_atendimento ?? l.created_at
      if (!raw) return false
      const h = new Date(raw).getHours()
      return h < HORA_INICIO || h >= HORA_FIM
    }).length
    if (foraHorario > 0) {
      const pct = Math.round((foraHorario / total) * 100)
      result.push(`O agente atendeu ${foraHorario} lead${foraHorario !== 1 ? 's' : ''} fora do horário comercial — ${pct}% do total, receita que a equipe não capturaria manualmente.`)
    }

    // 2. Leads with measurement scheduled
    const comMedicao = leads.filter((l) => l.data_medicao_instalacao && l.data_medicao_instalacao.trim()).length
    if (comMedicao > 0) {
      result.push(`${comMedicao} lead${comMedicao !== 1 ? 's' : ''} tem medição agendada — pipeline de conversão aquecido.`)
    }

    // 3. Most requested model
    const byModelo = leads
      .filter((l) => l.modelo_interesse?.trim())
      .reduce<Record<string, number>>((acc, l) => {
        const m = l.modelo_interesse!.trim()
        acc[m] = (acc[m] ?? 0) + 1
        return acc
      }, {})
    const topModelo = Object.entries(byModelo).sort((a, b) => b[1] - a[1])[0]
    if (topModelo) {
      result.push(`Modelo mais solicitado via IA: ${topModelo[0]} (${topModelo[1]} pedido${topModelo[1] !== 1 ? 's' : ''}).`)
    }

    // 4. Auto-quoted leads
    const cotados = leads.filter((l) => l.ultimo_valor_cotado && l.ultimo_valor_cotado.trim()).length
    if (cotados > 0) {
      result.push(`${cotados} lead${cotados !== 1 ? 's' : ''} recebeu orçamento automaticamente — sem esforço da equipe.`)
    }

    // 5. Average quality score
    const qualFields: (keyof CrmLead)[] = ['medidas_coletadas', 'quantidade', 'tecido_cor', 'acabamento_desejado', 'precisa_instalacao', 'modelo_interesse']
    const avgScore = total > 0
      ? Math.round(
          qualFields.reduce((sum, key) => {
            const filled = leads.filter((l) => {
              const v = l[key]
              return v !== null && v !== undefined && String(v).trim() !== ''
            }).length
            return sum + (filled / total) * 100
          }, 0) / qualFields.length
        )
      : 0
    if (avgScore > 0) {
      result.push(`Taxa de coleta de informações: ${avgScore}% — leads bem qualificados para a equipe comercial.`)
    }

    // 6. Converted/closed leads
    const convertidos = leads.filter((l) => {
      const s = l.status_lead?.toLowerCase().trim() ?? ''
      return s === 'convertido' || s === 'fechado'
    }).length
    if (convertidos > 0) {
      result.push(`${convertidos} lead${convertidos !== 1 ? 's' : ''} convertido${convertidos !== 1 ? 's' : ''} pelo agente IA até o momento.`)
    }

    return result
  }, [leads])

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm animate-pulse space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted" />)}
      </div>
    )
  }

  if (insights.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
      <div className="flex items-center gap-2 mb-4">
        <div className="rounded-lg bg-primary/10 p-1.5">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-display text-sm font-medium tracking-wide">Insights do Agente IA</h3>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          foco em performance
        </span>
      </div>
      <ul className="space-y-2.5">
        {insights.map((insight, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {insight}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── TabAnalises ────────────────────────────────────────────────────────────

export default function TabAnalises({ data, isLoading, error }: Props) {
  const [meta, setMeta] = useState(() => {
    const s = localStorage.getItem(META_KEY)
    return s ? Number(s) : 0
  })

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === META_KEY) setMeta(e.newValue ? Number(e.newValue) : 0)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Fetch CRM leads at the top level (before any early returns)
  const { data: leads = [], isLoading: leadsLoading } = useCrmLeads()

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
    <div className="space-y-5">
      {/* Header com botão PDF */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={() => exportPDF(data)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-150"
        >
          <FileDown className="h-3.5 w-3.5" />
          Exportar PDF
        </button>
      </div>

      {/* Destaques financeiros */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border-2 border-primary/25 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm transition-all duration-200 hover:shadow-elevated hover:-translate-y-px cursor-default">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">Valor de Venda</p>
          <p className="font-display mt-1.5 text-3xl font-bold tracking-tight text-primary">{formatCurrency(valorVendaTotal)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{fechados.length} pedido{fechados.length !== 1 ? 's' : ''} fechado{fechados.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border-2 border-primary/25 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm transition-all duration-200 hover:shadow-elevated hover:-translate-y-px cursor-default">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">Faturamento Total</p>
          <p className="font-display mt-1.5 text-3xl font-bold tracking-tight text-primary">{formatCurrency(faturamentoGeral)}</p>
          <p className="mt-1 text-xs text-muted-foreground">venda + instalação</p>
        </div>
        <div className="rounded-xl border-2 border-primary/25 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm transition-all duration-200 hover:shadow-elevated hover:-translate-y-px cursor-default">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">Margem Média</p>
          <p className="font-display mt-1.5 text-3xl font-bold tracking-tight text-primary">
            {margemMedia !== null ? `${margemMedia.toFixed(1)}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {fechadosComMargem.length > 0 ? `${fechadosComMargem.length} pedidos com margem` : 'sem dados de custo'}
          </p>
        </div>
      </div>

      {/* Comparativo mês a mês */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {comparisons.map(({ label, value, delta }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-px cursor-default">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">{label}</p>
            <p className="font-display mt-1.5 text-2xl font-bold tracking-tight truncate">{value}</p>
            <div className="mt-0.5">{delta ?? <span className="text-xs text-muted-foreground/60">base de comparação</span>}</div>
          </div>
        ))}
      </div>

      {/* Meta do Mês */}
      {meta > 0 && (
        <div className="rounded-xl border-2 border-primary/25 bg-primary/5 dark:bg-primary/10 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">Meta do Mês</p>
          <p className="font-display mt-1.5 text-2xl font-bold tracking-tight text-primary">{formatCurrency(thisFat)}</p>
          <div className="mt-2 h-2 w-full rounded-full bg-primary/20 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min((thisFat / meta) * 100, 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{Math.round((thisFat / meta) * 100)}% de {formatCurrency(meta)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/60">Configure a meta na aba Orçamentos</p>
        </div>
      )}

      {/* Faturamento mensal */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
        <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Faturamento mensal (últimos 6 meses)</h3>
        {monthly.every((m) => m.faturamento === 0) ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sem dados de faturamento</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [formatCurrency(v), 'Faturamento']} />
              <Bar dataKey="faturamento" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" fillOpacity={0.85} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Volume mensal */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Volume de orçamentos (últimos 6 meses)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthly} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'Orçamentos']} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" fillOpacity={0.85} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tendência diária */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Tendência diária — {now.toLocaleDateString('pt-BR', { month: 'long' })}</h3>
          {daily.length === 0 ? (
            <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">Sem dados este mês</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={daily} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fb923c" stopOpacity={0.04} />
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

      {/* Taxa de Conversão por Modelo */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
        <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Taxa de Conversão por Modelo</h3>
        <ConversaoPorModelo data={data} />
      </div>

      {/* Performance por Canal */}
      <PerformancePorCanal data={data} />

      {/* ─── Desempenho do Agente IA ─── */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-1.5">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <h2 className="font-display text-base font-semibold tracking-wide">Desempenho do Agente IA</h2>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
          {leadsLoading ? '…' : `${leads.length} lead${leads.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Row 1: Funil + Status Donut */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Funil IA → Venda</h3>
          <FunilAgenteIA leads={leads} isLoading={leadsLoading} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Status dos Leads</h3>
          <StatusLeadDonut leads={leads} isLoading={leadsLoading} />
        </div>
      </div>

      {/* Row 2: Volume de Leads por Mês */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
        <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Volume de Leads por Mês</h3>
        <VolumeLeadsIA leads={leads} isLoading={leadsLoading} />
      </div>

      {/* Row 3: Qualidade + Horário de Pico */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Qualidade dos Leads</h3>
          <QualidadeLeads leads={leads} isLoading={leadsLoading} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Horário de Pico</h3>
          <HorarioPico leads={leads} isLoading={leadsLoading} />
        </div>
      </div>

      {/* Row 4: Insights do Agente IA */}
      <InsightsAgenteIA leads={leads} isLoading={leadsLoading} />

      {/* Insights IA (análise de orçamentos) */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
        <div className="flex items-center gap-2 mb-4">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-display text-sm font-medium tracking-wide">Análise Automática</h3>
          <span className="ml-auto text-xs text-muted-foreground">baseado nos dados atuais</span>
        </div>
        <ul className="space-y-2.5">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {insight}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
