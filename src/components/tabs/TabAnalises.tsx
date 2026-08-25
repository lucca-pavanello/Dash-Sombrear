import { useMemo, useState, useEffect } from 'react'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { TEMA_TABELA, faixaMarca, rodapeMarca } from '@/lib/pdfMarca'
import { TrendingUp, TrendingDown, Minus, FileDown, AlertCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts'
import ChartTooltip from '@/components/shared/ChartTooltip'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import {
  filterOrcamentosPorMes,
  calcFaturamentoPorMes,
  getMonthlyDataSeries,
} from '@/lib/analytics'

interface Props { data: Orcamento[]; isLoading?: boolean; error?: boolean; resetKey?: number }

function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    const start = setTimeout(() => {
      let i = 0
      const tick = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        if (i >= text.length) {
          clearInterval(tick)
          setDone(true)
        }
      }, 16)
      return () => clearInterval(tick)
    }, delay)
    return () => clearTimeout(start)
  }, [text, delay])

  return (
    <p className="text-sm leading-relaxed text-foreground/85">
      {displayed}
      {!done && <span className="typewriter-cursor">|</span>}
    </p>
  )
}

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

  // 4. Melhor vendedor por vendas registradas (a "taxa de conversão" antiga
  // dividia vendas por uso da calculadora — número sem significado)
  const vendedores = Object.entries(
    fechados.reduce<Record<string, { feitos: number; fat: number }>>((acc, o) => {
      if (!acc[o.responsavel]) acc[o.responsavel] = { feitos: 0, fat: 0 }
      acc[o.responsavel].feitos++
      acc[o.responsavel].fat += (o.valor_venda ?? 0) + (o.instalacao ?? 0)
      return acc
    }, {})
  )
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.fat - a.fat)

  if (vendedores.length >= 2) {
    const best = vendedores[0]
    insights.push(`${best.name} lidera em vendas registradas: ${best.feitos} venda${best.feitos !== 1 ? 's' : ''} somando ${formatCurrency(best.fat)}.`)
  } else if (vendedores.length === 1) {
    insights.push(`${vendedores[0].name}: ${vendedores[0].feitos} venda${vendedores[0].feitos !== 1 ? 's' : ''} registrada${vendedores[0].feitos !== 1 ? 's' : ''} somando ${formatCurrency(vendedores[0].fat)}.`)
  }

  // 5. Ticket médio este mês vs histórico geral
  const fatGeral = fechados.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)
  const ticketGeral = fechados.length > 0 ? fatGeral / fechados.length : 0
  const ticketMes = thisFechados.length > 0 ? thisFat / thisFechados.length : 0
  if (ticketGeral > 0 && ticketMes > 0 && thisFechados.length >= 2) {
    const diff = ((ticketMes - ticketGeral) / ticketGeral) * 100
    if (diff > 5) insights.push(`Ticket médio este mês (${formatCurrency(ticketMes)}) está ${diff.toFixed(0)}% acima da média histórica (${formatCurrency(ticketGeral)}) — clientes comprando mais.`)
    else if (diff < -5) insights.push(`Ticket médio este mês (${formatCurrency(ticketMes)}) está ${Math.abs(diff).toFixed(0)}% abaixo da média histórica (${formatCurrency(ticketGeral)}) — oportunidade para oferecer upgrades de produto.`)
  }

  // 6. Ritmo de cotações (uso da calculadora) vs mês anterior — sinal de
  // movimento no balcão, não de funil de vendas
  if (thisMonth.length > 0 && lastMonth.length > 0) {
    const pct = ((thisMonth.length - lastMonth.length) / lastMonth.length) * 100
    if (pct > 15) insights.push(`Movimento aquecido: ${thisMonth.length} cotações calculadas este mês vs ${lastMonth.length} no anterior (+${pct.toFixed(0)}%).`)
    else if (pct < -15) insights.push(`Cotações calculadas caíram ${Math.abs(pct).toFixed(0)}% — ${thisMonth.length} este mês vs ${lastMonth.length} no anterior.`)
  }

  // 7. Poucas vendas registradas = estatística frágil; avisar em vez de fingir precisão
  if (fechados.length > 0 && fechados.length < 15) {
    insights.push(`Só ${fechados.length} venda${fechados.length !== 1 ? 's' : ''} registrada${fechados.length !== 1 ? 's' : ''} no sistema até agora — registre cada fechamento (inclusive os de loja) na aba Semanário para os números acima ganharem força.`)
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


async function exportPDF(data: Orcamento[]) {
  // Import dinâmico: vendor-pdf só baixa quando o usuário exporta
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF()
  const now = new Date()
  faixaMarca(doc, 'Relatório de análises')

  const thisFat = calcFaturamentoPorMes(data, now.getFullYear(), now.getMonth())
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastFat = calcFaturamentoPorMes(data, lastMonthDate.getFullYear(), lastMonthDate.getMonth())
  const thisMonth = filterOrcamentosPorMes(data, now.getFullYear(), now.getMonth())
  const fechados = data.filter((o) => o.fechado === true)
  const faturamentoTotal = fechados.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)

  doc.setTextColor(40, 40, 40)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo do Período', 14, 38)

  const kpis = [
    ['Cotações calculadas (total)', String(data.length)],
    ['Vendas registradas', String(fechados.length)],
    ['Faturamento total', formatCurrency(faturamentoTotal)],
    ['Faturamento mês atual', formatCurrency(thisFat)],
    ['Faturamento mês anterior', formatCurrency(lastFat)],
    ['Cotações este mês', String(thisMonth.length)],
    ['Vendas este mês', String(thisMonth.filter((o) => o.fechado === true).length)],
  ]

  autoTable(doc, {
    startY: 42,
    head: [['Indicador', 'Valor']],
    body: kpis,
    ...TEMA_TABELA,
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { fontStyle: 'bold', halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  // Ranking responsáveis — cotações e vendas lado a lado, sem "conversão"
  // (dividir vendas por uso da calculadora punia quem mais calcula)
  const byResp = Object.entries(
    data.reduce<Record<string, { total: number; feitos: number; fat: number }>>((acc, o) => {
      if (!acc[o.responsavel]) acc[o.responsavel] = { total: 0, feitos: 0, fat: 0 }
      acc[o.responsavel].total++
      if (o.fechado === true) { acc[o.responsavel].feitos++; acc[o.responsavel].fat += (o.valor_venda ?? 0) + (o.instalacao ?? 0) }
      return acc
    }, {})
  )
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.fat - a.fat)
    .map(({ name, total, feitos, fat }) => [name, String(total), String(feitos), formatCurrency(fat)])

  const afterKpi = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Ranking de Responsáveis', 14, afterKpi)

  autoTable(doc, {
    startY: afterKpi + 4,
    head: [['Responsável', 'Cotações', 'Vendas', 'Faturamento']],
    body: byResp,
    ...TEMA_TABELA,
    bodyStyles: { fontSize: 9 },
    columnStyles: { 3: { fontStyle: 'bold', halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  // Tabela de orçamentos fechados
  const afterRanking = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
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
    ...TEMA_TABELA,
    headStyles: { ...TEMA_TABELA.headStyles, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 5: { fontStyle: 'bold', halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  rodapeMarca(doc)

  doc.save(`relatorio-sombrear-${now.toISOString().slice(0, 10)}.pdf`)
}

function DemandaPorModelo({ data }: { data: Orcamento[] }) {
  // Volume de cotações = o que o balcão mais calcula. Não é conversão:
  // cotação aqui é uso interno da calculadora, não proposta enviada.
  const byModelo = useMemo(() => {
    const rows = Object.entries(
      data.reduce<Record<string, { total: number; vendas: number }>>((acc, o) => {
        if (!acc[o.modelo]) acc[o.modelo] = { total: 0, vendas: 0 }
        acc[o.modelo].total++
        if (o.fechado === true) acc[o.modelo].vendas++
        return acc
      }, {})
    )
      .map(([modelo, s]) => ({ modelo, total: s.total, vendas: s.vendas }))
      .sort((a, b) => b.total - a.total)
    const max = Math.max(...rows.map(r => r.total), 1)
    return rows.map(r => ({ ...r, pct: (r.total / max) * 100 }))
  }, [data])

  if (byModelo.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sem dados suficientes</p>
  }

  return (
    <div className="space-y-2.5">
      {byModelo.map(({ modelo, total, vendas, pct }) => (
        <div key={modelo} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs font-medium truncate">{modelo}</span>
          <div className="flex-1 relative h-5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/70 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-primary">
            {total}
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {vendas > 0 ? `${vendas} venda${vendas !== 1 ? 's' : ''}` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function VendasPorResponsavel({ data }: { data: Orcamento[] }) {
  // Só vendas registradas. A "taxa de conversão" antiga dividia vendas pelo
  // total de cálculos que a pessoa fez na calculadora — punia quem mais usa.
  const byResp = useMemo(() => {
    const rows = Object.entries(
      data.filter((o) => o.fechado === true)
        .reduce<Record<string, { vendas: number; fat: number }>>((acc, o) => {
          if (!acc[o.responsavel]) acc[o.responsavel] = { vendas: 0, fat: 0 }
          acc[o.responsavel].vendas++
          acc[o.responsavel].fat += (o.valor_venda ?? 0) + (o.instalacao ?? 0)
          return acc
        }, {})
    )
      .map(([resp, s]) => ({ resp, vendas: s.vendas, fat: s.fat }))
      .sort((a, b) => b.fat - a.fat)
    const max = Math.max(...rows.map(r => r.fat), 1)
    return rows.map(r => ({ ...r, pct: (r.fat / max) * 100 }))
  }, [data])

  if (byResp.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Nenhuma venda registrada ainda</p>

  return (
    <div className="space-y-2.5">
      {byResp.map(({ resp, vendas, fat, pct }) => (
        <div key={resp} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs font-medium truncate">{resp}</span>
          <div className="flex-1 relative h-5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary/70 transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-14 shrink-0 text-right text-xs font-bold tabular-nums text-primary">{vendas} vd</span>
          <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{formatCurrency(fat)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Activity Heatmap ───────────────────────────────────────────────────────

const HEAT_LEVELS = [
  'bg-muted/50',
  'bg-primary/20',
  'bg-primary/40',
  'bg-primary/65',
  'bg-primary',
]

// ── Predictive Chart ───────────────────────────────────────────────
type HistPt = { mes: string; faturamento: number; x: number; projetado: false }
type ProjPt = { mes: string; faturamento: number; x: number; projetado: true; baixo: number; alto: number }

function FaturamentoPreditivo({ data }: { data: Orcamento[] }) {
  const { historico, projecoes } = useMemo(() => {
    const now = new Date()
    const months = 6

    // Build historical monthly series
    const historico: HistPt[] = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
      const fat = filterOrcamentosPorMes(data, d.getFullYear(), d.getMonth())
        .filter(o => o.fechado === true)
        .reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)
      return {
        mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        faturamento: fat,
        x: i,
        projetado: false as const,
      }
    })

    // Linear regression on historical points (only non-zero months)
    const pts = historico.filter(p => p.faturamento > 0)
    let slope = 0, intercept = 0
    if (pts.length >= 2) {
      const n = pts.length
      const sumX = pts.reduce((s, p) => s + p.x, 0)
      const sumY = pts.reduce((s, p) => s + p.faturamento, 0)
      const sumXY = pts.reduce((s, p) => s + p.x * p.faturamento, 0)
      const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0)
      slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      intercept = (sumY - slope * sumX) / n
    }

    // Project next 3 months
    const projecoes: ProjPt[] = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1)
      const x = months + i
      const predicted = Math.max(0, Math.round(slope * x + intercept))
      // Stddev for confidence band (simple: use residuals from regression)
      const residuals = pts.map(p => p.faturamento - (slope * p.x + intercept))
      const stddev = pts.length > 1
        ? Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length)
        : predicted * 0.2
      return {
        mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        faturamento: predicted,
        baixo: Math.max(0, Math.round(predicted - stddev * 0.8)),
        alto: Math.round(predicted + stddev * 0.8),
        x,
        projetado: true as const,
      }
    })

    return { historico, projecoes }
  }, [data])

  const allPoints: (HistPt | ProjPt)[] = [...historico, ...projecoes]
  const maxVal = Math.max(...allPoints.map(p => (p.projetado ? (p as ProjPt).alto : p.faturamento)), 1)

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-elevated transition-all duration-200 col-span-1 lg:col-span-2">
      <div className="flex items-baseline justify-between mb-0.5">
        <h3 className="font-display text-sm font-medium tracking-wide">Previsão de Faturamento</h3>
        <span className="text-xs text-muted-foreground">Regressão linear sobre últimos 6 meses</span>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">Histórico (sólido) + projeção para os próximos 3 meses (tracejado)</p>

      <div className="flex items-end gap-1.5 h-44 w-full">
        {allPoints.map((p, i) => {
          const isProj = p.projetado
          const height = p.faturamento > 0 ? (p.faturamento / maxVal) * 100 : 2
          const proj = isProj ? (p as ProjPt) : null
          const bandH = proj ? ((proj.alto - proj.baixo) / maxVal) * 100 : 0
          const bandBottom = proj ? (proj.baixo / maxVal) * 100 : 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 group">
              <div className="relative w-full flex flex-col items-center justify-end" style={{ height: '148px' }}>
                {/* Confidence band */}
                {isProj && bandH > 0 && (
                  <div
                    className="absolute w-3/4 rounded bg-primary/10"
                    style={{
                      bottom: `${bandBottom}%`,
                      height: `${bandH}%`,
                    }}
                  />
                )}
                {/* Bar */}
                <div
                  className={cn(
                    'w-full rounded-t transition-all duration-500 relative',
                    isProj
                      ? 'border-2 border-dashed border-primary/50 bg-primary/10'
                      : 'bg-primary/80 hover:bg-primary'
                  )}
                  style={{ height: `${height}%`, minHeight: '3px' }}
                  title={p.faturamento > 0 ? formatCurrency(p.faturamento) : 'Sem dados'}
                >
                  {p.faturamento > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold tabular-nums whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity text-foreground">
                      {formatCurrency(p.faturamento)}
                    </span>
                  )}
                </div>
              </div>
              <span className={cn(
                'text-[10px] tabular-nums truncate w-full text-center',
                isProj ? 'text-primary/60 font-semibold' : 'text-muted-foreground'
              )}>
                {p.mes}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-end">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-5 rounded-sm bg-primary/80" />
          <span className="text-[11px] text-muted-foreground">Realizado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-5 rounded-sm border-2 border-dashed border-primary/50 bg-primary/10" />
          <span className="text-[11px] text-muted-foreground">Projetado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-5 rounded-sm bg-primary/10" />
          <span className="text-[11px] text-muted-foreground">Intervalo</span>
        </div>
      </div>
    </div>
  )
}

type HeatCell = { date: Date; count: number; iso: string }

function PeakHourClock({ data }: { data: Orcamento[] }) {
  const now = new Date()

  const { counts, peakHour, maxCount, total } = useMemo(() => {
    const counts = new Array(24).fill(0) as number[]
    data.forEach(o => {
      if (!o.created_at) return
      const h = new Date(o.created_at).getHours()
      counts[h]++
    })
    const maxCount = Math.max(...counts, 1)
    const peakHour = counts.indexOf(maxCount)
    const total = counts.reduce((s, c) => s + c, 0)
    return { counts, peakHour, maxCount, total }
  }, [data])

  const SIZE = 220
  const CX = SIZE / 2
  const CY = SIZE / 2
  const R_INNER = 58
  const R_MAX_ADD = 44
  const GAP_DEG = 2

  function arcPath(hour: number): string {
    const norm = counts[hour] / maxCount
    const rOuter = R_INNER + norm * R_MAX_ADD + 4
    const startAngle = (hour / 24) * 360 - 90
    const endAngle = startAngle + (360 / 24) - GAP_DEG
    const toRad = (d: number) => (d * Math.PI) / 180
    const x1 = CX + R_INNER * Math.cos(toRad(startAngle))
    const y1 = CY + R_INNER * Math.sin(toRad(startAngle))
    const x2 = CX + rOuter * Math.cos(toRad(startAngle))
    const y2 = CY + rOuter * Math.sin(toRad(startAngle))
    const x3 = CX + rOuter * Math.cos(toRad(endAngle))
    const y3 = CY + rOuter * Math.sin(toRad(endAngle))
    const x4 = CX + R_INNER * Math.cos(toRad(endAngle))
    const y4 = CY + R_INNER * Math.sin(toRad(endAngle))
    return `M ${x1} ${y1} L ${x2} ${y2} A ${rOuter} ${rOuter} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${R_INNER} ${R_INNER} 0 0 0 ${x1} ${y1} Z`
  }

  const currentHour = now.getHours()
  const handAngle = (currentHour / 24) * 360 - 90
  const toRad = (d: number) => (d * Math.PI) / 180
  const handX = CX + (R_INNER + R_MAX_ADD + 12) * Math.cos(toRad(handAngle))
  const handY = CY + (R_INNER + R_MAX_ADD + 12) * Math.sin(toRad(handAngle))

  const labelHours = [0, 6, 12, 18]
  const labelRadius = R_INNER + R_MAX_ADD + 20

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-elevated transition-all duration-200">
      <div className="flex items-baseline justify-between mb-0.5">
        <h3 className="font-display text-sm font-medium tracking-wide">Peak Hour Sensor</h3>
        <span className="text-xs text-muted-foreground">Hora com mais orçamentos criados</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Distribuição de orçamentos por hora do dia</p>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0 overflow-visible">
          {/* background ring */}
          <circle cx={CX} cy={CY} r={R_INNER + R_MAX_ADD / 2 + 2} fill="none" stroke="hsl(var(--border))" strokeWidth={R_MAX_ADD + 8} opacity={0.18} />

          {/* arcs */}
          {counts.map((count, hour) => {
            const norm = count / maxCount
            const isPeak = hour === peakHour && count > 0
            return (
              <path
                key={hour}
                d={arcPath(hour)}
                fill={isPeak
                  ? 'hsl(var(--primary))'
                  : `hsl(var(--primary) / ${0.15 + norm * 0.55})`}
                style={isPeak ? { filter: 'drop-shadow(0 0 6px hsl(var(--primary) / 0.7))' } : undefined}
              />
            )
          })}

          {/* peak pulse ring */}
          {counts[peakHour] > 0 && (() => {
            const peakAngleMid = ((peakHour + 0.5) / 24) * 360 - 90
            const pr = R_INNER + (counts[peakHour] / maxCount) * R_MAX_ADD + 4
            const px = CX + pr * Math.cos(toRad(peakAngleMid))
            const py = CY + pr * Math.sin(toRad(peakAngleMid))
            return (
              <circle cx={px} cy={py} r={5} fill="hsl(var(--primary))" opacity={0.6}>
                <animate attributeName="r" values="5;10;5" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
              </circle>
            )
          })()}

          {/* current hour hand */}
          <line
            x1={CX} y1={CY}
            x2={handX} y2={handY}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            opacity={0.5}
          />
          <circle cx={CX} cy={CY} r={3} fill="hsl(var(--muted-foreground))" opacity={0.5} />

          {/* hour labels */}
          {labelHours.map(h => {
            const angle = (h / 24) * 360 - 90
            const lx = CX + labelRadius * Math.cos(toRad(angle))
            const ly = CY + labelRadius * Math.sin(toRad(angle))
            return (
              <text key={h} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fill="hsl(var(--muted-foreground))" fontWeight={500}>
                {h}h
              </text>
            )
          })}

          {/* center text */}
          <text x={CX} y={CY - 10} textAnchor="middle" fontSize={22} fontWeight={700} fill="hsl(var(--foreground))">
            {peakHour}h
          </text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
            pico
          </text>
          <text x={CX} y={CY + 24} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
            {total} total
          </text>
        </svg>

        <div className="flex flex-col gap-2 min-w-0 w-full">
          <p className="text-xs text-muted-foreground">Top 5 horários</p>
          {[...Array(24).keys()]
            .sort((a, b) => counts[b] - counts[a])
            .slice(0, 5)
            .map(h => (
              <div key={h} className="flex items-center gap-2">
                <span className="w-8 text-right text-xs font-mono text-muted-foreground shrink-0">{String(h).padStart(2, '0')}h</span>
                <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${(counts[h] / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-5 text-xs font-semibold tabular-nums text-foreground/70">{counts[h]}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function ActivityHeatmap({ data }: { data: Orcamento[] }) {
  const { weeks, totalOrcs, activeDays, months } = useMemo(() => {
    const now = new Date()
    const days: HeatCell[] = []
    for (let i = 364; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      days.push({ date: d, count: 0, iso: d.toISOString().slice(0, 10) })
    }
    data.forEach((o) => {
      const iso = o.created_at.slice(0, 10)
      const cell = days.find((d) => d.iso === iso)
      if (cell) cell.count++
    })
    const firstDow = (days[0].date.getDay() + 6) % 7
    const padded: HeatCell[] = Array.from({ length: firstDow }, (_, i) => ({ date: new Date(0), count: -1, iso: `pad-${i}` }))
    const all: HeatCell[] = [...padded, ...days]
    const ws: HeatCell[][] = []
    for (let i = 0; i < all.length; i += 7) ws.push(all.slice(i, i + 7))
    const monthLabels: { week: number; label: string }[] = []
    let lastMonth = -1
    ws.forEach((week, wi) => {
      const real = week.find(d => d.count >= 0)
      if (real) {
        const m = real.date.getMonth()
        if (m !== lastMonth) { monthLabels.push({ week: wi, label: real.date.toLocaleDateString('pt-BR', { month: 'short' }) }); lastMonth = m }
      }
    })
    return {
      weeks: ws,
      totalOrcs: days.reduce((s, d) => s + Math.max(d.count, 0), 0),
      activeDays: days.filter(d => d.count > 0).length,
      months: monthLabels,
    }
  }, [data])

  function level(count: number) {
    if (count < 0) return 'bg-transparent'
    if (count === 0) return HEAT_LEVELS[0]
    if (count === 1) return HEAT_LEVELS[1]
    if (count <= 3) return HEAT_LEVELS[2]
    if (count <= 6) return HEAT_LEVELS[3]
    return HEAT_LEVELS[4]
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display text-sm font-medium tracking-wide">Atividade — últimos 12 meses</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{totalOrcs} orçamentos em {activeDays} dia{activeDays !== 1 ? 's' : ''} ativo{activeDays !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>menos</span>
          {HEAT_LEVELS.map((c, i) => <div key={i} className={`h-3 w-3 rounded-sm ${c}`} />)}
          <span>mais</span>
        </div>
      </div>
      {/* Month labels */}
      <div className="relative mb-0.5">
        <div className="flex gap-[3px]">
          {weeks.map((_, wi) => {
            const ml = months.find(m => m.week === wi)
            return (
              <div key={wi} className="w-3 shrink-0 text-[9px] text-muted-foreground/60 truncate">
                {ml ? ml.label : ''}
              </div>
            )
          })}
        </div>
      </div>
      {/* Grid */}
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell) => (
              <div
                key={cell.iso}
                title={cell.count >= 0 ? `${cell.date.toLocaleDateString('pt-BR')}: ${cell.count} orçamento${cell.count !== 1 ? 's' : ''}` : ''}
                className={`h-3 w-3 rounded-sm transition-transform duration-100 ${level(cell.count)} ${cell.count > 0 ? 'hover:scale-125 hover:ring-1 hover:ring-primary/50 cursor-default' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Day labels */}
      <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/50">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
          <span key={d} className="w-3 text-center shrink-0 mr-[3px]">{d.slice(0,1)}</span>
        ))}
      </div>
    </div>
  )
}

// ─── TabAnalises ────────────────────────────────────────────────────────────

export default function TabAnalises({ data, isLoading, error, resetKey }: Props) {
  // useMemo deve ficar antes dos early returns para não violar Rules of Hooks
  const { monthly, daily, insights, now, fechados, faturamentoGeral, fechadosComMargem, margemMedia, thisFat, lastFat, fatPct, vendasMes, vendasPct, volPct, thisMonth } = useMemo(() => {
    const now = new Date()
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const monthly = getMonthlyDataSeries(data)
    const daily = getDailyTrend(data)
    const insights = generateInsights(data)
    const fechados = data.filter((o) => o.fechado === true)
    const faturamentoGeral = fechados.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)
    const fechadosComMargem = fechados.filter((o) => o.margem != null)
    const margemMedia = fechadosComMargem.length > 0
      ? fechadosComMargem.reduce((s, o) => s + (o.margem ?? 0), 0) / fechadosComMargem.length
      : null
    const thisMonth = filterOrcamentosPorMes(data, now.getFullYear(), now.getMonth())
    const lastMonth = filterOrcamentosPorMes(data, lastMonthDate.getFullYear(), lastMonthDate.getMonth())
    const thisFat = calcFaturamentoPorMes(data, now.getFullYear(), now.getMonth())
    const lastFat = calcFaturamentoPorMes(data, lastMonthDate.getFullYear(), lastMonthDate.getMonth())
    const fatPct = lastFat > 0 ? ((thisFat - lastFat) / lastFat) * 100 : null
    const vendasMes = thisMonth.filter((o) => o.fechado === true).length
    const vendasMesAnt = lastMonth.filter((o) => o.fechado === true).length
    const vendasPct = vendasMesAnt > 0 ? ((vendasMes - vendasMesAnt) / vendasMesAnt) * 100 : null
    const volPct = lastMonth.length > 0 ? ((thisMonth.length - lastMonth.length) / lastMonth.length) * 100 : null
    return { monthly, daily, insights, now, fechados, faturamentoGeral, fechadosComMargem, margemMedia, thisFat, lastFat, fatPct, vendasMes, vendasPct, volPct, thisMonth }
  }, [data])

  const comCusto = useMemo(() => data.filter((o) => o.custo_tecido != null && o.custo_tecido > 0), [data])
  const comCustoMes = useMemo(() => filterByPeriod(comCusto, 'mes', (o) => o.created_at), [comCusto])
  const totalMesCusto = useMemo(() => comCustoMes.reduce((s, o) => s + (o.custo_tecido ?? 0), 0), [comCustoMes])
  const usosSemana = useMemo(() => filterByPeriod(comCusto, 'semana', (o) => o.created_at).length, [comCusto])
  const diasDecorridosCusto = now.getDate()
  const mediaDiaria = diasDecorridosCusto > 0 ? totalMesCusto / diasDecorridosCusto : 0

  const rentabilidadePorModelo = useMemo(() => {
    // Faturamento, custo e margem saem SÓ das vendas fechadas — misturar o
    // custo das cotações da calculadora com a receita das vendas dava margem
    // de -1851%. Cotações entram como coluna própria (demanda), nada mais.
    const map: Record<string, { cotacoes: number; fat: number; custo: number; fechados: number; tecidos: Record<string, number> }> = {}
    for (const o of data) {
      if (!map[o.modelo]) map[o.modelo] = { cotacoes: 0, fat: 0, custo: 0, fechados: 0, tecidos: {} }
      if (o.fechado === true) {
        map[o.modelo].fat += (o.valor_venda ?? 0) + (o.instalacao ?? 0)
        map[o.modelo].fechados++
        if (o.custo_tecido != null && o.custo_tecido > 0) map[o.modelo].custo += o.custo_tecido
      } else {
        map[o.modelo].cotacoes++
      }
      if (o.tecido) map[o.modelo].tecidos[o.tecido] = (map[o.modelo].tecidos[o.tecido] ?? 0) + 1
    }
    return Object.entries(map)
      .map(([modelo, s]) => ({
        modelo,
        cotacoes: s.cotacoes,
        fechados: s.fechados,
        fat: s.fat,
        custo: s.custo,
        margem: s.fat > 0 && s.custo > 0 ? ((s.fat - s.custo) / s.fat) * 100 : null,
        topTecido: Object.entries(s.tecidos).sort(([, a], [, b]) => b - a)[0] ?? null,
      }))
      .sort((a, b) => b.fat - a.fat || b.cotacoes - a.cotacoes)
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

  const containerRef = useScrollReveal([data])

  return (
    <div className="space-y-6" ref={containerRef}>

      {/* Header — título ao centro, exportar ancorado à direita */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span aria-hidden="true" />
        <h2 className="text-center font-display text-base font-semibold tracking-wide">Análises</h2>
        <div className="flex justify-end">
          <button
            onClick={() => exportPDF(data)}
            title="Exportar relatório em PDF"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
        </div>
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
          { label: 'Vendas este mês', value: String(vendasMes), delta: <Delta pct={vendasPct} suffix="%" /> },
          { label: 'Cotações este mês', value: String(thisMonth.length), delta: <Delta pct={volPct} suffix="%" /> },
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
                <TypewriterText text={insight} delay={i * 400} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 — Gráficos lado a lado */}
      <div className="reveal grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="font-display text-sm font-medium tracking-wide">Faturamento mensal</h3>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Últimos 6 meses — pedidos fechados</p>
          {monthly.every((m) => m.faturamento === 0) ? (
            <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">Sem dados ainda</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart key={resetKey} data={monthly} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                <Bar dataKey="faturamento" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" fillOpacity={0.85} cursor="pointer" isAnimationActive animationBegin={0} animationDuration={700} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="font-display text-sm font-medium tracking-wide">Uso da calculadora</h3>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Últimos 6 meses — cotações calculadas pela equipe</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart key={resetKey} data={monthly} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" fillOpacity={0.5} cursor="pointer" isAnimationActive animationBegin={0} animationDuration={700} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4 — Rentabilidade por Modelo */}
      <div className="reveal rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b px-5 py-4">
          <h3 className="font-display text-sm font-medium tracking-wide">Rentabilidade por Modelo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Faturamento, custo e margem das vendas registradas — cotações da calculadora contam só como demanda</p>
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
                  <th className="px-6 py-3.5 text-center font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[22%]">Modelo</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[10%]">Cotações</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[10%]">Vendas</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[17%]">Faturamento</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[17%]">Custo das vendas</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[12%]">Margem</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-muted-foreground tracking-wide text-xs uppercase w-[12%]">Top Tecido</th>
                </tr>
              </thead>
              <tbody>
                {rentabilidadePorModelo.map(({ modelo, cotacoes, fechados: nVendas, fat, custo, margem, topTecido }) => (
                  <tr key={modelo} className="border-b last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 font-semibold whitespace-nowrap">{modelo}</td>
                    <td className="px-4 py-4 text-center tabular-nums text-muted-foreground">{cotacoes}</td>
                    <td className="px-4 py-4 text-center">
                      {nVendas > 0
                        ? <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary">{nVendas}</span>
                        : <span className="text-muted-foreground/30">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center tabular-nums font-medium whitespace-nowrap">{fat > 0 ? formatCurrency(fat) : <span className="text-muted-foreground/30">—</span>}</td>
                    <td className="px-6 py-4 text-center tabular-nums text-muted-foreground whitespace-nowrap">{custo > 0 ? formatCurrency(custo) : <span className="text-muted-foreground/30">—</span>}</td>
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
                  <td className="px-4 py-3.5 text-center tabular-nums font-semibold">{rentabilidadePorModelo.reduce((s, r) => s + r.cotacoes, 0)}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary tabular-nums">
                      {fechados.length}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-center tabular-nums font-bold text-primary whitespace-nowrap">{formatCurrency(faturamentoGeral)}</td>
                  <td className="px-6 py-3.5 text-center tabular-nums font-semibold text-muted-foreground whitespace-nowrap">{custoTotal > 0 ? formatCurrency(custoTotal) : '—'}</td>
                  <td className="px-6 py-3.5 text-center">
                    {faturamentoGeral > 0 && custoTotal > 0
                      ? (() => { const m = ((faturamentoGeral - custoTotal) / faturamentoGeral) * 100; return (
                          <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                            m >= 40 ? 'bg-primary/10 text-primary' : m >= 20 ? 'bg-muted text-foreground' : 'bg-destructive/10 text-destructive'
                          }`}>{m.toFixed(1)}%</span>
                        ) })()
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
      <div className="reveal grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      <div className="reveal grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="font-display text-sm font-medium tracking-wide">Vendas por Vendedor</h3>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Vendas registradas e faturamento por responsável</p>
          <VendasPorResponsavel data={data} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
          <h3 className="font-display text-sm font-medium tracking-wide">Demanda por Modelo</h3>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Cotações calculadas por modelo — o que o balcão mais pede</p>
          <DemandaPorModelo data={data} />
        </div>
      </div>

      {/* 7 — Tendência diária */}
      <div className="reveal rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-elevated">
        <div className="flex items-baseline justify-between mb-0.5">
          <h3 className="font-display text-sm font-medium tracking-wide">Tendência diária</h3>
          <span className="text-xs text-muted-foreground capitalize">
            {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">Cotações e registros criados por dia no mês atual</p>
        {daily.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">Sem dados este mês</div>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={daily} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="orcamentos" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#areaGrad)" isAnimationActive animationBegin={200} animationDuration={1300} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 8 — Previsão de Faturamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FaturamentoPreditivo data={data} />
      </div>

      {/* 9 — Heatmap de atividade */}
      <ActivityHeatmap data={data} />

      {/* 10 — Peak Hour Clock */}
      <PeakHourClock data={data} />

    </div>
  )
}
