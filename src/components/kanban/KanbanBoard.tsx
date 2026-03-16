import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  DragOverEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import type { Orcamento } from '@/lib/supabase'
import { KANBAN_COLUMNS, getKanbanStatus, type KanbanStatus, type KanbanColumn } from '@/lib/kanban'
import { useUpdateKanbanStatus } from '@/hooks/useKanban'
import KanbanCard, { KanbanCardContent } from './KanbanCard'
import EditOrcamentoForm from '@/components/orcamentos/EditOrcamentoForm'
import { cn, formatCurrency } from '@/lib/utils'

// ── Coluna ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  items,
  onEdit,
  showGhost,
}: {
  col: KanbanColumn
  items: Orcamento[]
  onEdit: (o: Orcamento) => void
  showGhost: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  const total = items.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)

  return (
    <div className="flex min-w-[230px] flex-1 flex-col">
      {/* Cabeçalho da coluna */}
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {/* Dot colorido */}
          <span className={cn('h-2 w-2 rounded-full', col.accent)} />
          <span className={cn('text-sm font-bold', col.textColor)}>{col.label}</span>
          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums', col.countBg)}>
            {items.length}
          </span>
        </div>
        {/* Total sempre visível */}
        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
          {total > 0 ? formatCurrency(total) : '—'}
        </span>
      </div>

      {/* Corpo da coluna (Trello-style: fundo sólido suave) */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-1 flex-col gap-2 rounded-2xl p-2 transition-colors duration-150',
          'bg-slate-100 dark:bg-slate-800/50',
          'min-h-[160px]',
          isOver && 'bg-primary/8 dark:bg-primary/10',
        )}
      >
        {items.map(o => (
          <KanbanCard
            key={o.id}
            orcamento={o}
            colIsAtRisk={col.isAtRisk}
            onEdit={onEdit}
          />
        ))}

        {/* Ghost placeholder — indica onde o card vai cair */}
        {showGhost && (
          <div className={cn(
            'h-[108px] rounded-2xl border-2 border-dashed transition-all duration-150',
            col.isAtRisk
              ? 'border-primary/40 bg-primary/5'
              : 'border-muted-foreground/30 bg-muted/20',
          )} />
        )}

        {/* Estado vazio (sem ghost) */}
        {items.length === 0 && !showGhost && (
          <div className="flex flex-1 items-center justify-center py-8">
            <p className="text-xs text-muted-foreground/35 italic select-none">Vazio</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Board ─────────────────────────────────────────────────────────────────────

interface Props {
  data: Orcamento[]
  toast: (type: 'success' | 'error', message: string) => void
}

export default function KanbanBoard({ data, toast }: Props) {
  const [activeOrcamento, setActiveOrcamento] = useState<Orcamento | null>(null)
  const [overColumnId, setOverColumnId] = useState<KanbanStatus | null>(null)
  const [editing, setEditing] = useState<Orcamento | null>(null)
  const { mutate: updateKanban } = useUpdateKanbanStatus()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const columns = KANBAN_COLUMNS.map(col => ({
    ...col,
    items: data.filter(o => getKanbanStatus(o) === col.id),
  }))

  function handleDragStart(event: DragStartEvent) {
    const o = data.find(o => o.id === event.active.id)
    if (o) setActiveOrcamento(o)
  }

  function handleDragOver(event: DragOverEvent) {
    const colId = event.over?.id as KanbanStatus | null
    setOverColumnId(colId ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveOrcamento(null)
    setOverColumnId(null)
    if (!over) return

    const newStatus = over.id as KanbanStatus
    const orcamento = data.find(o => o.id === active.id)
    if (!orcamento) return
    if (getKanbanStatus(orcamento) === newStatus) return

    updateKanban(
      { id: orcamento.id, status: newStatus },
      { onError: () => toast('error', 'Erro ao mover card. Tente novamente.') },
    )
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Grid igual nas 4 colunas — scroll horizontal no mobile */}
        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none md:grid md:grid-cols-4 md:gap-4">
          {columns.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              items={col.items}
              onEdit={setEditing}
              showGhost={
                overColumnId === col.id &&
                !!activeOrcamento &&
                getKanbanStatus(activeOrcamento) !== col.id
              }
            />
          ))}
        </div>

        {/* Card flutuante durante o drag */}
        <DragOverlay
          dropAnimation={{
            duration: 180,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeOrcamento && (
            <div className="w-[230px] md:w-full">
              <KanbanCardContent
                orcamento={activeOrcamento}
                colIsAtRisk={false}
                overlay
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editing && (
        <EditOrcamentoForm
          orcamento={editing}
          onClose={() => setEditing(null)}
          toast={toast}
        />
      )}
    </>
  )
}
