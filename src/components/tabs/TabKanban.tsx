import { useState, useRef } from 'react'
import { useMemo } from 'react'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { useUpdateOrcamento } from '@/hooks/useOrcamentos'
import { calcPropensityScore } from '@/lib/analytics'
import AvatarInitials from '@/components/shared/AvatarInitials'
import { AlertTriangle, TrendingUp, DollarSign, Users } from 'lucide-react'

// ── Column definitions ──────────────────────────────────────────────
type ColId = 'contato' | 'proposta' | 'negociando' | 'fechado' | 'perdido'

const COLUMNS: { id: ColId; label: string; color: string; bg: string; dot: string }[] = [
  { id: 'contato',   label: 'Em Contato',      color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-500/8 border-blue-500/20',    dot: 'bg-blue-400' },
  { id: 'proposta',  label: 'Proposta Enviada', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/8 border-amber-500/20',  dot: 'bg-amber-400' },
  { id: 'negociando',label: 'Negociando',       color: 'text-violet-600 dark:text-violet-400',bg: 'bg-violet-500/8 border-violet-500/20',dot: 'bg-violet-400' },
  { id: 'fechado',   label: 'Fechado',          color: 'text-emerald-600 dark:text-emerald-400',bg: 'bg-emerald-500/8 border-emerald-500/20',dot: 'bg-emerald-400' },
  { id: 'perdido',   label: 'Perdido',          color: 'text-rose-600 dark:text-rose-400',   bg: 'bg-rose-500/8 border-rose-500/20',    dot: 'bg-rose-400' },
]

function getColumn(o: Orcamento): ColId {
  if (o.fechado) return 'fechado'
  if (o.status === 'PERDIDO') return 'perdido'
  if (o.status === 'NEGOCIANDO') return 'negociando'
  if (o.status === 'PROPOSTA' || o.status === 'ENVIADO' || o.status === 'CALCULADO') return 'proposta'
  return 'contato'
}

function getUpdateForColumn(colId: ColId): Partial<Orcamento> {
  switch (colId) {
    case 'contato':    return { status: null,         fechado: false }
    case 'proposta':   return { status: 'PROPOSTA',   fechado: false }
    case 'negociando': return { status: 'NEGOCIANDO', fechado: false }
    case 'fechado':    return { status: null,         fechado: true }
    case 'perdido':    return { status: 'PERDIDO',    fechado: false }
  }
}

// ── Score pill ─────────────────────────────────────────────────────
function ScorePill({ score }: { score: number }) {
  if (score === -1) return null
  return (
    <span className={cn(
      'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
      score >= 70 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        : score >= 40 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        : 'bg-red-500/15 text-red-600 dark:text-red-400'
    )}>
      {score}
    </span>
  )
}

// ── Kanban Card ────────────────────────────────────────────────────
interface CardProps {
  o: Orcamento
  allData: Orcamento[]
  isDragging: boolean
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onClick: (o: Orcamento) => void
}

function KanbanCard({ o, allData, isDragging, onDragStart, onDragEnd, onClick }: CardProps) {
  const score = calcPropensityScore(o, allData)
  const total = (o.valor_venda ?? 0) + (o.instacao ?? 0)
  const diasAberto = o.fechado ? 0 : Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400000)
  const isAtRisk = !o.fechado && diasAberto > 7

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, o.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(o)}
      className={cn(
        'group relative rounded-xl border bg-card p-3 cursor-grab active:cursor-grabbing',
        'hover:shadow-elevated hover:-translate-y-0.5 hover:border-primary/30',
        'transition-all duration-150 select-none',
        isDragging && 'opacity-40 scale-95 rotate-1',
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">
            {o.cliente ?? 'Sem cliente'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <AvatarInitials name={o.responsavel} size="xs" />
            <span className="text-[11px] text-muted-foreground truncate">{o.responsavel}</span>
          </div>
        </div>
        <ScorePill score={score} />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {o.modelo && (
          <span className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {o.modelo}
          </span>
        )}
        {o.ambiente && (
          <span className="inline-flex items-center rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {o.ambiente}
          </span>
        )}
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-bold', total > 0 ? 'text-primary' : 'text-muted-foreground/40')}>
          {total > 0 ? formatCurrency(total) : '—'}
        </span>
        <div className="flex items-center gap-1.5">
          {isAtRisk && (
            <span title={`${diasAberto}d sem atualização`}>
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            </span>
          )}
          {!isAtRisk && diasAberto > 0 && (
            <span className="text-[10px] text-muted-foreground/50">{diasAberto}d</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Column ─────────────────────────────────────────────────────────
interface ColProps {
  col: typeof COLUMNS[number]
  cards: Orcamento[]
  allData: Orcamento[]
  draggingId: string | null
  dragOverCol: ColId | null
  onDragOver: (e: React.DragEvent, colId: ColId) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, colId: ColId) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onCardClick: (o: Orcamento) => void
}

function KanbanColumn({ col, cards, allData, draggingId, dragOverCol, onDragOver, onDragLeave, onDrop, onDragStart, onDragEnd, onCardClick }: ColProps) {
  const total = cards.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)
  const isOver = dragOverCol === col.id

  return (
    <div className="flex flex-col w-[272px] shrink-0 rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3.5 py-3 border-b', col.bg)}>
        <span className={cn('h-2 w-2 rounded-full shrink-0', col.dot)} />
        <span className={cn('font-semibold text-[13px] flex-1 truncate', col.color)}>{col.label}</span>
        <span className="text-[11px] font-mono text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">{cards.length}</span>
      </div>

      {/* Value summary */}
      {total > 0 && (
        <div className="px-3.5 py-1.5 border-b border-border/40 flex items-center gap-1 bg-muted/20">
          <DollarSign className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-[11px] font-semibold text-muted-foreground">{formatCurrency(total)}</span>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => onDragOver(e, col.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, col.id)}
        className={cn(
          'flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] transition-colors duration-150',
          isOver && 'bg-primary/5 ring-2 ring-inset ring-primary/30',
        )}
      >
        {cards.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-border/40">
            <span className="text-xs text-muted-foreground/40">Arraste aqui</span>
          </div>
        )}
        {cards.map(o => (
          <KanbanCard
            key={o.id}
            o={o}
            allData={allData}
            isDragging={draggingId === o.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onCardClick}
          />
        ))}
        {isOver && (
          <div className="h-12 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 animate-pulse" />
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────
interface Props {
  data: Orcamento[]
  onOpenCard?: (o: Orcamento) => void
}

export default function TabKanban({ data, onOpenCard }: Props) {
  const { mutate: update } = useUpdateOrcamento()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ColId | null>(null)
  const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const columns = useMemo(() => {
    const map = new Map<ColId, Orcamento[]>()
    COLUMNS.forEach(c => map.set(c.id, []))
    data.forEach(o => {
      const col = getColumn(o)
      map.get(col)!.push(o)
    })
    // Sort by most recent first within each column
    map.forEach(cards => cards.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    return map
  }, [data])

  const stats = useMemo(() => ({
    total: data.filter(o => !o.fechado && o.status !== 'PERDIDO').length,
    atRisk: data.filter(o => {
      if (o.fechado || o.status === 'PERDIDO') return false
      const dias = Math.floor((Date.now() - new Date(o.updated_at ?? o.created_at).getTime()) / 86400000)
      return dias > 7
    }).length,
    faturamento: data.filter(o => o.fechado).reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0),
    pipeline: data.filter(o => !o.fechado && o.status !== 'PERDIDO').reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0),
  }), [data])

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    setDraggingId(id)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverCol(null)
  }

  function handleDragOver(e: React.DragEvent, colId: ColId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragLeaveTimer.current) clearTimeout(dragLeaveTimer.current)
    setDragOverCol(colId)
  }

  function handleDragLeave() {
    dragLeaveTimer.current = setTimeout(() => setDragOverCol(null), 50)
  }

  function handleDrop(e: React.DragEvent, colId: ColId) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    const o = data.find(x => x.id === id)
    if (!o) return
    const currentCol = getColumn(o)
    if (currentCol === colId) return
    const patch = getUpdateForColumn(colId)
    update({ id, ...patch })
    setDraggingId(null)
    setDragOverCol(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2"><Users className="h-4 w-4 text-blue-500" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Em aberto</p>
            <p className="text-lg font-bold tabular-nums">{stats.total}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2"><AlertTriangle className="h-4 w-4 text-amber-500" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Em risco</p>
            <p className="text-lg font-bold tabular-nums">{stats.atRisk}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="rounded-lg bg-violet-500/10 p-2"><TrendingUp className="h-4 w-4 text-violet-500" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Pipeline</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(stats.pipeline)}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2"><DollarSign className="h-4 w-4 text-emerald-500" /></div>
          <div>
            <p className="text-xs text-muted-foreground">Faturamento</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(stats.faturamento)}</p>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1"
        style={{ minHeight: '520px' }}
      >
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            cards={columns.get(col.id)!}
            allData={data}
            draggingId={draggingId}
            dragOverCol={dragOverCol}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onCardClick={(o) => onOpenCard?.(o)}
          />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground pb-2">
        Arraste os cards entre as colunas para atualizar o status no funil
      </p>
    </div>
  )
}
