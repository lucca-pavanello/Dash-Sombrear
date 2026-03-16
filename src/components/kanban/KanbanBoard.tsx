import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import type { Orcamento } from '@/lib/supabase'
import { KANBAN_COLUMNS, getKanbanStatus, type KanbanStatus } from '@/lib/kanban'
import { useUpdateKanbanStatus } from '@/hooks/useKanban'
import KanbanCard, { KanbanCardContent } from './KanbanCard'
import EditOrcamentoForm from '@/components/orcamentos/EditOrcamentoForm'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

function KanbanColumn({
  col,
  items,
  onCardClick,
}: {
  col: typeof KANBAN_COLUMNS[number]
  items: Orcamento[]
  onCardClick: (o: Orcamento) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  const total = items.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)

  return (
    <div className="flex flex-col min-w-[260px] w-full">
      {/* Column header */}
      <div className={cn('mb-2 flex items-center justify-between rounded-lg px-3 py-2', col.headerClass)}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider">{col.label}</span>
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/30 dark:bg-black/20 px-1.5 text-[10px] font-bold">
            {items.length}
          </span>
        </div>
        {total > 0 && (
          <span className="text-[10px] font-semibold opacity-80">{formatCurrency(total)}</span>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 rounded-xl border-2 border-dashed p-2 min-h-[120px] transition-colors duration-150',
          col.colorClass,
          isOver && 'bg-primary/5 border-primary/40',
        )}
      >
        {items.map(o => (
          <KanbanCard key={o.id} orcamento={o} onClick={onCardClick} />
        ))}
        {items.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-6">
            <p className="text-xs text-muted-foreground/40 italic">Arraste um card aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  data: Orcamento[]
  toast: (type: 'success' | 'error', message: string) => void
}

export default function KanbanBoard({ data, toast }: Props) {
  const [activeOrcamento, setActiveOrcamento] = useState<Orcamento | null>(null)
  const [editing, setEditing] = useState<Orcamento | null>(null)
  const { mutate: updateKanban } = useUpdateKanbanStatus()

  // Sensors: pointer (desktop) + touch (mobile), com delay para não conflitar com scroll
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const columns = KANBAN_COLUMNS.map(col => ({
    ...col,
    items: data.filter(o => getKanbanStatus(o) === col.id),
  }))

  function handleDragStart(event: DragStartEvent) {
    const o = data.find(o => o.id === event.active.id)
    if (o) setActiveOrcamento(o)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveOrcamento(null)
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
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none md:grid md:grid-cols-4">
          {columns.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              items={col.items}
              onCardClick={setEditing}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeOrcamento && (
            <div className="w-[260px]">
              <KanbanCardContent orcamento={activeOrcamento} overlay />
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
