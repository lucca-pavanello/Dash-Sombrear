import type { Orcamento } from '@/lib/supabase'

export type KanbanStatus = 'em_aberto' | 'negociando' | 'fechado' | 'perdido'

export const KANBAN_COLUMNS: { id: KanbanStatus; label: string; colorClass: string; headerClass: string }[] = [
  { id: 'em_aberto',  label: 'Em Aberto',  colorClass: 'border-blue-400/40',   headerClass: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  { id: 'negociando', label: 'Negociando', colorClass: 'border-amber-400/40',  headerClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  { id: 'fechado',    label: 'Fechado',    colorClass: 'border-green-400/40',  headerClass: 'text-green-600 dark:text-green-400 bg-green-500/10' },
  { id: 'perdido',    label: 'Perdido',    colorClass: 'border-red-400/40',    headerClass: 'text-red-600 dark:text-red-400 bg-red-500/10' },
]

/** Deriva o status kanban dos campos existentes no BD */
export function getKanbanStatus(o: Orcamento): KanbanStatus {
  if (o.kanban_status) return o.kanban_status
  if (o.fechado) return 'fechado'
  return 'em_aberto'
}

/** Campos a sincronizar no BD ao mover um card */
export function kanbanStatusToFields(status: KanbanStatus): { fechado: boolean; kanban_status: KanbanStatus } {
  return {
    kanban_status: status,
    fechado: status === 'fechado',
  }
}

/** Calcula kanban_status ao salvar pelo formulário (preserva negociando/perdido se fechado não mudou) */
export function resolveKanbanOnSave(
  formFechado: boolean,
  current: KanbanStatus | null | undefined,
): KanbanStatus {
  if (formFechado) return 'fechado'
  if (current === 'fechado') return 'em_aberto'  // reabriu
  if (current === 'negociando' || current === 'perdido') return current
  return 'em_aberto'
}
