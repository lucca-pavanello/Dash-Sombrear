import type { Orcamento } from '@/lib/supabase'

export type KanbanStatus = 'em_aberto' | 'negociando' | 'fechado' | 'perdido'

export type KanbanColumn = {
  id: KanbanStatus
  label: string
  accent: string        // barra colorida no topo
  textColor: string     // cor do título
  countBg: string       // fundo do badge de contagem
  isAtRisk: boolean     // habilita alerta de follow-up
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'em_aberto',
    label: 'Em Aberto',
    accent: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    countBg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    isAtRisk: true,
  },
  {
    id: 'negociando',
    label: 'Negociando',
    accent: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    countBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    isAtRisk: true,
  },
  {
    id: 'fechado',
    label: 'Fechado',
    accent: 'bg-green-500',
    textColor: 'text-green-600 dark:text-green-400',
    countBg: 'bg-green-500/15 text-green-700 dark:text-green-300',
    isAtRisk: false,
  },
  {
    id: 'perdido',
    label: 'Perdido',
    accent: 'bg-red-500',
    textColor: 'text-red-600 dark:text-red-400',
    countBg: 'bg-red-500/15 text-red-700 dark:text-red-300',
    isAtRisk: false,
  },
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
  if (current === 'fechado') return 'em_aberto'
  if (current === 'negociando' || current === 'perdido') return current
  return 'em_aberto'
}

/** Formata número de WhatsApp para URL wa.me */
export function toWhatsAppUrl(telefone: string | null | undefined): string | null {
  if (!telefone) return null
  const digits = telefone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const number = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${number}`
}
