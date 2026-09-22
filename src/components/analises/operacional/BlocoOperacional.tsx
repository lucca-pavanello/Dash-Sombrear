/**
 * A operação da loja — o que a aba Análise mostrava antes e continua útil, mas não é a
 * história que ela conta agora.
 *
 * Desceu para um bloco recolhido porque o público mudou: quem abre Análise quer saber
 * por que o cliente não fecha, não em que hora do dia o balcão mais usa a calculadora.
 * Quem precisa disso continua tendo, a um clique.
 *
 * Os componentes vieram de `TabAnalises.tsx` sem alteração de comportamento — só saíram
 * de um arquivo de 1111 linhas. O `FaturamentoPreditivo` NÃO veio junto: fazia regressão
 * linear sobre dois meses de fechamento e apresentava o resultado como previsão, com
 * banda de confiança e tudo. Dois pontos não preveem nada.
 */
import { useMemo, useState } from 'react'
import { ChevronDown, Clock } from 'lucide-react'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'


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

/**
 * A gaveta. Monta o conteúdo só quando abre — `ResponsiveContainer` e qualquer medida de
 * largura leem 0 dentro de um container com `display:none`, e o gráfico nasce achatado.
 */
export default function BlocoOperacional({ data }: { data: Orcamento[] }) {
  const [aberto, setAberto] = useState(false)

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2.5 rounded-xl px-5 py-4 text-left transition-colors hover:bg-muted/30"
      >
        <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="font-display text-sm font-semibold tracking-wide">A operação da loja</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          modelos mais cotados, vendedores, horários e atividade
        </span>
        <ChevronDown
          className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            aberto && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-border/60 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <VendasPorResponsavel data={data} />
            <DemandaPorModelo data={data} />
          </div>
          <PeakHourClock data={data} />
          <ActivityHeatmap data={data} />
        </div>
      )}
    </section>
  )
}
