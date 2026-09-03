import { useState, useMemo, memo, useEffect, useRef } from 'react'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency, formatCompact } from '@/lib/utils'
import { CheckCircle2, DollarSign, FileText, ReceiptText, TrendingUp, Pencil, Check, Clock, X, AlertTriangle } from 'lucide-react'
import { useMonthlyComparison } from '@/hooks/useOrcamentos'
import { useCountUp } from '@/hooks/useCountUp'
import { META_KEY } from '@/lib/constants'
import { kpi } from '@/components/shared/estilos'

// ── Odômetro de dígitos para o card de Faturamento ──
function OdometerValue({ value }: { value: number }) {
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  const chars = Array.from(formatted)
  const [ready, setReady] = useState(false)
  const prevValueRef = useRef(value)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value
      setAnimKey((k) => k + 1)
    }
  }, [value])

  return (
    <span className="font-display mt-1 inline-flex items-baseline text-2xl font-bold tracking-tight text-primary tabular-nums">
      {chars.map((char, i) => {
        if (!/\d/.test(char)) {
          return (
            <span key={`${animKey}-s-${i}`} className="inline-block">
              {char}
            </span>
          )
        }
        const digit = parseInt(char)
        const delay = (chars.length - i) * 30
        return (
          <span
            key={`${animKey}-d-${i}`}
            className="inline-block overflow-hidden"
            style={{ height: '1.25em', verticalAlign: 'bottom' }}
          >
            <span
              className="flex flex-col"
              style={{
                transform: ready ? `translateY(-${digit * 10}%)` : 'translateY(0%)',
                transition: ready
                  ? `transform 550ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`
                  : 'none',
              }}
            >
              {Array.from({ length: 10 }, (_, n) => (
                <span
                  key={n}
                  style={{ height: '1.25em', lineHeight: '1.25em', display: 'block' }}
                >
                  {n}
                </span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}

interface Props { data: Orcamento[]; resetKey?: number }

function KpiTooltip({ lines }: { lines: string[] }) {
  return (
    <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
      <div className="rounded-lg border bg-card px-3 py-2 shadow-elevated text-xs text-muted-foreground whitespace-nowrap space-y-0.5">
        {lines.map((l, i) => <p key={i}>{l}</p>)}
      </div>
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-border" />
    </div>
  )
}

function KPIGrid({ data, resetKey }: Props) {
  const {
    fechados, emAberto, totalVenda, totalInst, faturamento, totalOrc,
    ticketMedio, convRate, valorEmAberto, comMargem, margemMedia, emRisco, valorEmRisco,
  } = useMemo(() => {
    const fechados = data.filter((o) => o.fechado === true)
    const emAberto = data.filter((o) => !o.fechado)
    const totalVenda = fechados.reduce((s, o) => s + (o.valor_venda ?? 0), 0)
    const totalInst = fechados.reduce((s, o) => s + (o.instalacao ?? 0), 0)
    const faturamento = totalVenda + totalInst
    const totalOrc = data.length
    const ticketMedio = fechados.length > 0 ? faturamento / fechados.length : 0
    const convRate = totalOrc > 0 ? (fechados.length / totalOrc) * 100 : 0
    const valorEmAberto = emAberto.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)
    const comMargem = data.filter((o) => o.margem != null)
    const margemMedia = comMargem.length > 0
      ? comMargem.reduce((s, o) => s + (o.margem ?? 0), 0) / comMargem.length
      : null
    // Em risco: abertos sem edição há mais de 7 dias
    const agora = Date.now()
    const emRisco = emAberto.filter((o) => {
      const dias = Math.floor((agora - new Date(o.updated_at ?? o.created_at).getTime()) / 86400000)
      return dias > 7
    })
    const valorEmRisco = emRisco.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)
    return { fechados, emAberto, totalVenda, totalInst, faturamento, totalOrc, ticketMedio, convRate, valorEmAberto, comMargem, margemMedia, emRisco, valorEmRisco }
  }, [data])

  const animFechados = useCountUp(fechados.length, 480, false, resetKey)
  const animTotalOrc = useCountUp(totalOrc, 450, false, resetKey)
  const animTicket = useCountUp(ticketMedio, 580, false, resetKey)
  const animConv = useCountUp(convRate, 500, false, resetKey)
  const animMargem = useCountUp(margemMedia ?? 0, margemMedia != null ? 540 : 0, false, resetKey)
  const animEmAberto = useCountUp(valorEmAberto, 580, false, resetKey)
  const animEmRisco = useCountUp(emRisco.length, 500, false, resetKey)

  const [flippedCard, setFlippedCard] = useState<string | null>(null)

  const [meta, setMeta] = useState(() => {
    const saved = localStorage.getItem(META_KEY)
    return saved ? Number(saved) : 0
  })
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaInput, setMetaInput] = useState('')

  function saveMeta() {
    const val = Number(metaInput.replace(/\D/g, ''))
    if (!metaInput.trim() || isNaN(val) || val === 0) { setEditingMeta(false); return }
    setMeta(val)
    localStorage.setItem(META_KEY, String(val))
    setEditingMeta(false)
  }

  function clearMeta() {
    setMeta(0)
    localStorage.removeItem(META_KEY)
    setEditingMeta(false)
  }

  const metaPct = meta > 0 ? Math.min((faturamento / meta) * 100, 100) : 0
  const animMetaPct = useCountUp(metaPct, 700, false, resetKey)

  const { data: monthly } = useMonthlyComparison()
  const pctChange = monthly && monthly.previousMonth > 0
    ? ((monthly.currentMonth - monthly.previousMonth) / monthly.previousMonth) * 100
    : null

  const kpis = [
    {
      label: 'Fechamentos',
      value: String(Math.round(animFechados)),
      icon: CheckCircle2,
      highlight: true,
      sub: `${Math.round(animConv)}% da lista`,
      // NÃO chamar de "taxa de conversão": a maioria das linhas de `orcamentos` é uso
      // interno da calculadora, não lead que recebeu proposta — essa conta já foi
      // removida de Análises por dar número sem significado (ver src/lib/analytics.ts).
      // Aqui é só "quanto da lista filtrada já fechou", a taxa de conversão de
      // verdade (por lead) mora em Relatórios → Por canal.
      tooltip: [`${fechados.length} de ${totalOrc} orçamento${totalOrc !== 1 ? 's' : ''}`, `${convRate.toFixed(1)}% desta lista está fechado`],
      back: [
        `${fechados.length} fechado${fechados.length !== 1 ? 's' : ''} de ${totalOrc} total`,
        `${convRate.toFixed(1)}% da lista fechada`,
        totalOrc - fechados.length > 0 ? `${totalOrc - fechados.length} ainda em aberto` : 'Nenhum em aberto',
      ],
    },
    {
      label: 'Orçamentos',
      value: String(Math.round(animTotalOrc)),
      icon: FileText,
      highlight: false,
      sub: 'no período',
      tooltip: [`${totalOrc} orçamento${totalOrc !== 1 ? 's' : ''} no período`, `${totalOrc - fechados.length} em aberto`],
      back: [
        `${totalOrc} orçamento${totalOrc !== 1 ? 's' : ''} no período`,
        `${fechados.length} fechados · ${totalOrc - fechados.length} abertos`,
      ],
    },
    {
      label: 'Ticket Médio',
      value: ticketMedio > 0 ? formatCompact(animTicket) : '—',
      icon: ReceiptText,
      highlight: false,
      sub: 'por fechamento',
      tooltip: ticketMedio > 0
        ? [`${formatCurrency(faturamento)} ÷ ${fechados.length} fechamentos`]
        : ['Nenhum fechamento ainda'],
      back: ticketMedio > 0
        ? [`${formatCurrency(faturamento)} total`, `÷ ${fechados.length} fechamento${fechados.length !== 1 ? 's' : ''}`, `= ${formatCurrency(ticketMedio)} / venda`]
        : ['Nenhum fechamento ainda'],
    },
    {
      label: 'Margem Média',
      value: comMargem.length > 0 ? `${animMargem.toFixed(1)}%` : '—',
      icon: TrendingUp,
      highlight: false,
      sub: comMargem.length > 0 ? `${comMargem.length} com custo` : 'sem custo informado',
      tooltip: comMargem.length > 0
        ? [`Baseado em ${comMargem.length} orçamento${comMargem.length !== 1 ? 's' : ''} com margem calculada`, `(venda + instalação − custo) / receita`]
        : ['Margem calculada automaticamente', 'pelo n8n ao registrar o orçamento'],
      back: comMargem.length > 0
        ? [`${comMargem.length} orçamentos com custo`, `(receita − custo) ÷ receita`, `Média: ${(margemMedia ?? 0).toFixed(1)}%`]
        : ['Sem custo registrado', 'Informe o custo para', 'calcular a margem automaticamente'],
    },
    {
      label: 'Em aberto',
      value: valorEmAberto > 0 ? formatCompact(animEmAberto) : '—',
      icon: Clock,
      highlight: false,
      amber: false,
      sub: `${emAberto.length} orçamento${emAberto.length !== 1 ? 's' : ''}`,
      tooltip: [
        `${emAberto.length} orçamento${emAberto.length !== 1 ? 's' : ''} pendente${emAberto.length !== 1 ? 's' : ''}`,
        valorEmAberto > 0 ? `Pipeline: ${formatCurrency(valorEmAberto)}` : 'Sem valor informado',
      ],
      back: [
        `${emAberto.length} pendente${emAberto.length !== 1 ? 's' : ''}`,
        valorEmAberto > 0 ? `Pipeline: ${formatCurrency(valorEmAberto)}` : 'Sem valor informado',
      ],
    },
    {
      label: 'Em Risco',
      value: String(Math.round(animEmRisco)),
      icon: AlertTriangle,
      highlight: false,
      amber: emRisco.length > 0,
      sub: 'abertos há +7 dias',
      tooltip: [
        `${emRisco.length} orçamento${emRisco.length !== 1 ? 's' : ''} aberto${emRisco.length !== 1 ? 's' : ''} há mais de 7 dias`,
        valorEmRisco > 0 ? `Pipeline em risco: ${formatCurrency(valorEmRisco)}` : 'Sem valor informado',
      ],
      back: emRisco.length > 0
        ? [`${emRisco.length} aberto${emRisco.length !== 1 ? 's' : ''} há +7 dias`, valorEmRisco > 0 ? `Em risco: ${formatCurrency(valorEmRisco)}` : 'Sem valor informado', 'Retome o contato agora']
        : ['Nenhum orçamento em risco', 'Todos os abertos foram', 'atualizados nos últimos 7 dias'],
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-7">
      {/* Faturamento — shimmer + tooltip + meta */}
      <div
        tabIndex={0}
        className={`group relative animate-in fade-in-0 slide-in-from-bottom-4 duration-500 ${kpi.cartao} ${kpi.acento.primario} transition-all duration-200 hover:shadow-md hover:-translate-y-px cursor-default outline-none`}
        style={{ animationFillMode: 'both', animationDelay: '0ms' }}
      >
        <KpiTooltip lines={[
          totalInst > 0
            ? `${formatCurrency(totalVenda)} vendas + ${formatCurrency(totalInst)} instalações`
            : `${formatCurrency(totalVenda)} em vendas`,
          pctChange !== null
            ? `${pctChange >= 0 ? '↑' : '↓'} ${Math.abs(pctChange).toFixed(0)}% vs mês anterior`
            : 'Sem comparativo disponível',
        ]} />

        {/* Shimmer sweep */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
          <div className="shimmer-sweep h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        <div className="flex flex-col items-center text-center gap-0.5">
          <div className="mb-1.5 flex items-center gap-1.5">
            <div className="rounded-lg p-1.5 bg-primary/15 text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setMetaInput(meta > 0 ? String(meta) : ''); setEditingMeta(true) }}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Definir meta"
              aria-label="Definir meta mensal"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          <p className={`${kpi.rotulo} w-full`}>Faturamento</p>
          <OdometerValue value={faturamento} />

          {meta > 0 ? (
            <div className="mt-1.5 w-full">
              <div className="h-1.5 w-full rounded-full bg-primary/20 overflow-hidden">
                <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${animMetaPct}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {Math.round(animMetaPct)}% de {formatCurrency(meta)}
              </p>
            </div>
          ) : pctChange !== null ? (
            <p className={`mt-0.5 text-xs font-medium ${pctChange >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {pctChange >= 0 ? '↑' : '↓'} {Math.abs(pctChange).toFixed(0)}% vs mês ant.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">fechados</p>
          )}

          {meta > 0 && pctChange !== null && (
            <p className={`mt-0.5 text-xs font-medium ${pctChange >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {pctChange >= 0 ? '↑' : '↓'} {Math.abs(pctChange).toFixed(0)}% vs mês ant.
            </p>
          )}
        </div>

        {editingMeta && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={metaInput}
                onChange={(e) => setMetaInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') saveMeta(); if (e.key === 'Escape') setEditingMeta(false) }}
                placeholder="Ex: 50000"
                className="flex-1 min-w-0 rounded border bg-background px-2 py-1 text-xs outline-none ring-ring focus:ring-1"
              />
              <button onClick={saveMeta} className="rounded bg-primary px-2.5 py-2 text-white" title="Salvar meta">
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={() => setEditingMeta(false)}
                className="rounded border px-2.5 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Cancelar"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {meta > 0 && (
              <button onClick={clearMeta} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2">
                Limpar meta
              </button>
            )}
          </div>
        )}
      </div>

      {kpis.map(({ label, value, icon: Icon, amber, sub, tooltip, back }, i) => {
        const isFlipped = flippedCard === label
        return (
          <div
            key={label}
            tabIndex={0}
            onClick={() => setFlippedCard(isFlipped ? null : label)}
            className={`group relative animate-in fade-in-0 slide-in-from-bottom-4 duration-500 rounded-xl border shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer outline-none ${
              amber ? kpi.acento.amber : kpi.acento.primario
            }`}
            style={{ animationFillMode: 'both', animationDelay: `${(i + 1) * 80}ms`, perspective: '800px' }}
          >
            <div className={`kpi-flip-inner${isFlipped ? ' is-flipped' : ''}`}>
              {/* Front */}
              <div className="kpi-flip-front p-4">
                <KpiTooltip lines={tooltip} />
                <div className="flex flex-col items-center text-center gap-0.5">
                  <div className={`mb-1.5 rounded-lg p-1.5 ${amber ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-primary/15 text-primary'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className={`${kpi.rotulo} w-full`}>{label}</p>
                  <p className={`${kpi.valor} ${amber ? kpi.valorCor.amber : kpi.valorCor.primario}`}>
                    {value}
                  </p>
                  <p className={`${kpi.sub} w-full`}>{sub}</p>
                </div>
                <p className="mt-1.5 text-[9px] text-muted-foreground/30 text-center select-none">clique ›</p>
              </div>
              {/* Back */}
              <div className="kpi-flip-back rounded-xl p-4 flex flex-col justify-center gap-1.5 bg-card border border-border">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
                {back.map((line, j) => (
                  <p key={j} className="text-xs text-foreground/80 leading-snug">{line}</p>
                ))}
                <p className="mt-1 text-[9px] text-muted-foreground/30 text-right select-none">‹ voltar</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default memo(KPIGrid)
