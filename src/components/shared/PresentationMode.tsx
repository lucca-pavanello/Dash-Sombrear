import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import AvatarInitials from '@/components/shared/AvatarInitials'
import { X, TrendingUp, DollarSign, Target, Pause, Play } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  data: Orcamento[]
}

const SLIDE_DURATION = 6000 // ms per slide

// ── helpers ───────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    setDisplayed(0)
    const steps = 40
    const step = value / steps
    let current = 0
    let frame = 0
    const tick = setInterval(() => {
      frame++
      current = Math.min(current + step, value)
      setDisplayed(Math.round(current))
      if (frame >= steps) clearInterval(tick)
    }, 30)
    return () => clearInterval(tick)
  }, [value])
  return <>{prefix}{displayed.toLocaleString('pt-BR')}{suffix}</>
}

// ── Slide 1: KPIs do mês ─────────────────────────────────────────
function SlideKPIs({ data }: { data: Orcamento[] }) {
  const now = new Date()
  const thisMonth = data.filter(o => {
    const d = new Date(o.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const fechados = thisMonth.filter(o => o.fechado === true)
  const faturamento = fechados.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)
  const convRate = thisMonth.length > 0 ? (fechados.length / thisMonth.length) * 100 : 0
  const ticket = fechados.length > 0 ? faturamento / fechados.length : 0
  const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-16">
      <div className="text-center">
        <p className="text-primary/70 text-lg font-semibold uppercase tracking-[0.3em] mb-2">{mesLabel}</p>
        <h2 className="text-8xl font-black tabular-nums text-white leading-none">
          {faturamento > 0
            ? <><span className="text-4xl text-white/60 mr-2">R$</span><AnimatedNumber value={Math.round(faturamento / 1000)} suffix="k" /></>
            : <span className="text-5xl text-white/40">Sem dados</span>
          }
        </h2>
        <p className="text-white/50 text-xl mt-3">faturamento do mês</p>
      </div>

      <div className="grid grid-cols-3 gap-8 w-full max-w-3xl">
        {[
          { label: 'Fechamentos', value: fechados.length, icon: Target, renderValue: () => <AnimatedNumber value={fechados.length} /> },
          { label: 'Conversão',   value: convRate,        icon: TrendingUp, renderValue: () => <AnimatedNumber value={Math.round(convRate)} suffix="%" /> },
          { label: 'Ticket Médio', value: ticket,         icon: DollarSign, renderValue: () => <span>{formatCurrency(ticket)}</span> },
        ].map(({ label, icon: Icon, renderValue }) => (
          <div key={label} className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-sm">
            <Icon className="h-6 w-6 text-primary/70" />
            <span className="text-4xl font-black tabular-nums text-white">
              {renderValue()}
            </span>
            <span className="text-sm text-white/50 uppercase tracking-widest">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Slide 2: Ranking de Responsáveis ─────────────────────────────
function SlideRanking({ data }: { data: Orcamento[] }) {
  const ranking = useMemo(() => {
    const map = new Map<string, { fechamentos: number; faturamento: number }>()
    data.forEach(o => {
      const e = map.get(o.responsavel) ?? { fechamentos: 0, faturamento: 0 }
      if (o.fechado) {
        e.fechamentos++
        e.faturamento += (o.valor_venda ?? 0) + (o.instalacao ?? 0)
      }
      map.set(o.responsavel, e)
    })
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .filter(r => r.fechamentos > 0)
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 5)
  }, [data])

  const maxFat = ranking[0]?.faturamento ?? 1

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-20">
      <div className="text-center">
        <p className="text-primary/70 text-sm font-semibold uppercase tracking-[0.3em] mb-1">Ranking</p>
        <h2 className="text-4xl font-black text-white">Responsáveis</h2>
      </div>

      <div className="w-full max-w-2xl space-y-4">
        {ranking.map((r, i) => (
          <div key={r.name} className="flex items-center gap-5 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
            <span className={cn(
              'text-2xl font-black tabular-nums w-8 text-center shrink-0',
              i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-white/30'
            )}>
              {i + 1}
            </span>
            <AvatarInitials name={r.name} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-white text-lg truncate">{r.name}</span>
                <span className="text-primary font-black text-lg tabular-nums ml-3 shrink-0">{formatCurrency(r.faturamento)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-1000"
                  style={{ width: `${(r.faturamento / maxFat) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-white/40 text-sm shrink-0">{r.fechamentos} fech.</span>
          </div>
        ))}
        {ranking.length === 0 && (
          <p className="text-center text-white/30 text-xl">Sem fechamentos registrados</p>
        )}
      </div>
    </div>
  )
}

// ── Slide 3: Pipeline atual ───────────────────────────────────────
function SlidePipeline({ data }: { data: Orcamento[] }) {
  const cols = useMemo(() => {
    const aberto = data.filter(o => !o.fechado && o.status !== 'PERDIDO' && o.status !== 'FEITO')
    const total = aberto.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)
    const em_contato = aberto.filter(o => !o.status || (o.status !== 'PROPOSTA' && o.status !== 'ENVIADO' && o.status !== 'CALCULADO' && o.status !== 'NEGOCIANDO'))
    const proposta = aberto.filter(o => o.status === 'PROPOSTA' || o.status === 'ENVIADO' || o.status === 'CALCULADO')
    const negociando = aberto.filter(o => o.status === 'NEGOCIANDO')
    return { em_contato, proposta, negociando, total }
  }, [data])

  const fechadosMes = useMemo(() => {
    const now = new Date()
    return data.filter(o => {
      if (!o.fechado) return false
      const d = new Date(o.updated_at ?? o.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).slice(0, 4)
  }, [data])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-16">
      <div className="text-center">
        <p className="text-primary/70 text-sm font-semibold uppercase tracking-[0.3em] mb-1">Pipeline</p>
        <h2 className="text-4xl font-black text-white">
          {formatCurrency(cols.total)} <span className="text-white/30 text-2xl font-normal">em aberto</span>
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-6 w-full max-w-3xl">
        {[
          { label: 'Em Contato', count: cols.em_contato.length, color: 'border-blue-400/40 bg-blue-400/10', dot: 'bg-blue-400' },
          { label: 'Proposta Enviada', count: cols.proposta.length, color: 'border-amber-400/40 bg-amber-400/10', dot: 'bg-amber-400' },
          { label: 'Negociando', count: cols.negociando.length, color: 'border-violet-400/40 bg-violet-400/10', dot: 'bg-violet-400' },
        ].map(c => (
          <div key={c.label} className={cn('rounded-2xl border px-6 py-5 text-center backdrop-blur-sm', c.color)}>
            <span className={cn('inline-block h-2.5 w-2.5 rounded-full mb-3', c.dot)} />
            <p className="text-5xl font-black text-white tabular-nums">{c.count}</p>
            <p className="text-white/50 text-sm mt-2 uppercase tracking-wider">{c.label}</p>
          </div>
        ))}
      </div>

      {fechadosMes.length > 0 && (
        <div className="w-full max-w-3xl">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3 text-center">Fechamentos recentes</p>
          <div className="flex gap-3 justify-center flex-wrap">
            {fechadosMes.map(o => (
              <div key={o.id} className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-white/80 text-sm font-medium">{o.cliente ?? o.responsavel}</span>
                {o.valor_venda && <span className="text-emerald-400 text-sm font-bold">{formatCurrency((o.valor_venda ?? 0) + (o.instalacao ?? 0))}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Slide 4: Metas e Desempenho ───────────────────────────────────
function SlideDesempenho({ data }: { data: Orcamento[] }) {
  const stats = useMemo(() => {
    const now = new Date()
    const months = 3
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
      const monthData = data.filter(o => {
        const od = new Date(o.created_at)
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear()
      })
      const fechados = monthData.filter(o => o.fechado === true)
      return {
        mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        faturamento: fechados.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0),
        total: monthData.length,
        fechados: fechados.length,
      }
    })
  }, [data])

  const maxFat = Math.max(...stats.map(s => s.faturamento), 1)

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-20">
      <div className="text-center">
        <p className="text-primary/70 text-sm font-semibold uppercase tracking-[0.3em] mb-1">Tendência</p>
        <h2 className="text-4xl font-black text-white">Últimos 3 Meses</h2>
      </div>

      <div className="grid grid-cols-3 gap-6 w-full max-w-3xl items-end">
        {stats.map((s, i) => {
          const barH = s.faturamento > 0 ? (s.faturamento / maxFat) * 200 : 8
          const isLast = i === stats.length - 1
          return (
            <div key={s.mes} className="flex flex-col items-center gap-3">
              <span className={cn('text-2xl font-black tabular-nums', isLast ? 'text-primary' : 'text-white/60')}>
                {s.faturamento > 0 ? formatCurrency(s.faturamento) : '—'}
              </span>
              <div
                className={cn(
                  'w-full rounded-t-xl transition-all duration-1000',
                  isLast ? 'bg-gradient-to-t from-primary to-amber-400' : 'bg-white/15'
                )}
                style={{ height: `${barH}px`, minHeight: '8px', animationDelay: `${i * 200}ms` }}
              />
              <div className="text-center">
                <p className={cn('font-bold capitalize text-lg', isLast ? 'text-white' : 'text-white/50')}>{s.mes}</p>
                <p className="text-white/30 text-sm">{s.fechados} fechados · {s.total} total</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
const SLIDES = [
  { id: 'kpis',       label: 'KPIs do Mês',    Component: SlideKPIs },
  { id: 'ranking',    label: 'Ranking',         Component: SlideRanking },
  { id: 'pipeline',   label: 'Pipeline',        Component: SlidePipeline },
  { id: 'desempenho', label: 'Tendência',       Component: SlideDesempenho },
]

export default function PresentationMode({ open, onClose, data }: Props) {
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const now = useClock()

  const next = useCallback(() => setSlide(s => (s + 1) % SLIDES.length), [])
  const prev = useCallback(() => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length), [])

  // Auto-advance
  useEffect(() => {
    if (!open || paused) return
    const t = setInterval(next, SLIDE_DURATION)
    return () => clearInterval(t)
  }, [open, paused, next])

  // Reset on open
  useEffect(() => {
    if (open) { setSlide(0); setPaused(false) }
  }, [open])

  // Keys
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') onClose()
      if (e.key === 'ArrowRight') { setPaused(true); next() }
      if (e.key === 'ArrowLeft')  { setPaused(true); prev() }
      if (e.key === ' ')          { e.preventDefault(); setPaused(v => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, next, prev])

  // Fullscreen
  useEffect(() => {
    if (!open) return
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) }
  }, [open])

  if (!open) return null

  const { Component } = SLIDES[slide]

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col select-none"
      style={{ background: 'radial-gradient(ellipse at 60% 20%, hsl(25 90% 10%) 0%, hsl(220 20% 4%) 60%, #000 100%)' }}
      onClick={() => setPaused(v => !v)}
    >
      {/* Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-amber-400/5 blur-3xl" />
      </div>

      {/* Header bar */}
      <div className="relative z-10 flex items-center justify-between px-10 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-brand">
            <span className="font-display text-base font-bold text-white">S</span>
          </div>
          <span className="font-display text-xl font-bold text-white/80">Sombrear</span>
          <span className="ml-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-widest text-primary/80">
            Modo TV
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Clock */}
          <div className="text-right">
            <p className="text-4xl font-black tabular-nums text-white leading-none">
              {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-white/40 text-sm capitalize mt-0.5">
              {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {/* Botão fechar — visível e grande */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
            title="Fechar Modo TV (ESC)"
          >
            <X className="h-5 w-5" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex-1 overflow-hidden" key={slide}>
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 h-full">
          <Component data={data} />
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-center gap-3 pb-6">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={(e) => { e.stopPropagation(); setPaused(true); setSlide(i) }}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === slide ? 'w-8 bg-primary' : 'w-1.5 bg-white/20 hover:bg-white/40'
            )}
          />
        ))}

        {/* Progress bar for current slide */}
        {!paused && (
          <div className="absolute bottom-0 left-0 h-0.5 bg-primary/60 animate-[grow_6s_linear_forwards]"
            key={`${slide}-progress`}
            style={{ animationDuration: `${SLIDE_DURATION}ms` }}
          />
        )}
      </div>

      {/* Controls hint + pause button */}
      <div className="absolute bottom-6 right-8 flex items-center gap-3">
        <span className="text-white/20 text-xs">← → navegar · espaço pausar · ESC sair</span>
        <button
          onClick={(e) => { e.stopPropagation(); setPaused(v => !v) }}
          className="rounded-lg border border-white/15 bg-white/10 p-2 text-white/50 hover:bg-white/20 hover:text-white transition-colors"
          title={paused ? 'Continuar' : 'Pausar'}
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      </div>

      {/* Paused indicator */}
      {paused && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/60 px-6 py-3 backdrop-blur-sm animate-in fade-in duration-200">
          <p className="text-white/60 text-sm font-medium">⏸ Pausado — clique para continuar</p>
        </div>
      )}
    </div>
  )
}
