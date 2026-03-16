import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Pencil, MessageCircle, ExternalLink, AlertTriangle } from 'lucide-react'
import type { Orcamento } from '@/lib/supabase'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import AvatarInitials from '@/components/shared/AvatarInitials'
import { toWhatsAppUrl } from '@/lib/kanban'
import { FOLLOWUP_DIAS } from '@/lib/constants'

interface Props {
  orcamento: Orcamento
  colIsAtRisk: boolean
  onEdit: (o: Orcamento) => void
  overlay?: boolean
}

export function KanbanCardContent({
  orcamento,
  colIsAtRisk,
  onEdit,
  overlay,
}: {
  orcamento: Orcamento
  colIsAtRisk: boolean
  onEdit?: (o: Orcamento) => void
  overlay?: boolean
}) {
  const diasAberto = !orcamento.fechado
    ? Math.floor((Date.now() - new Date(orcamento.created_at).getTime()) / 86400000)
    : 0

  const isLate = colIsAtRisk && diasAberto >= FOLLOWUP_DIAS
  const waUrl = toWhatsAppUrl(orcamento.telefone)

  return (
    <div
      className={cn(
        'group/card relative rounded-2xl bg-card p-3.5 transition-all duration-150',
        'shadow-[0_2px_8px_rgba(0,0,0,0.07)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]',
        overlay && 'shadow-[0_8px_32px_rgba(0,0,0,0.18)] rotate-2 scale-105',
        isLate && 'ring-2 ring-orange-400/60 ring-offset-1 ring-offset-background',
      )}
    >
      {/* Faixa de alerta de follow-up */}
      {isLate && (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-2 py-1">
          <AlertTriangle className="h-3 w-3 shrink-0 text-orange-500" />
          <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">
            Follow-up: {diasAberto}d sem movimentação
          </span>
        </div>
      )}

      {/* Header: cliente + avatar */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">
            {orcamento.cliente ?? (
              <span className="italic text-muted-foreground font-normal text-xs">Sem cliente</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(orcamento.created_at)}</p>
        </div>
        <AvatarInitials name={orcamento.responsavel} size="xs" />
      </div>

      {/* Chips: modelo + ambiente */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {orcamento.modelo}
        </span>
        {orcamento.ambiente && (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {orcamento.ambiente}
          </span>
        )}
      </div>

      {/* Tecido */}
      <p className="text-[11px] text-muted-foreground/70 truncate mb-3">{orcamento.tecido}</p>

      {/* Footer: valor + dias + ações rápidas */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col leading-tight">
          {orcamento.valor_venda ? (
            <span className="text-sm font-bold text-foreground">
              {formatCurrency(orcamento.valor_venda)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/40 italic">Sem valor</span>
          )}
          {!isLate && diasAberto > 0 && (
            <span className={cn(
              'text-[10px] font-medium',
              diasAberto > 3 ? 'text-muted-foreground' : 'text-muted-foreground/50',
            )}>
              {diasAberto}d
            </span>
          )}
        </div>

        {/* Ações rápidas — visíveis no hover */}
        {!overlay && (
          <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title="Abrir no WhatsApp"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors dark:text-green-400"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onEdit(orcamento) }}
                title="Editar orçamento"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Link compartilhado */}
      {orcamento.share_enabled && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-primary/60">
          <ExternalLink className="h-2.5 w-2.5" />
          <span>Link ativo</span>
        </div>
      )}
    </div>
  )
}

export default function KanbanCard({ orcamento, colIsAtRisk, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: orcamento.id,
    data: { orcamento },
  })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-25',
      )}
    >
      <KanbanCardContent
        orcamento={orcamento}
        colIsAtRisk={colIsAtRisk}
        onEdit={onEdit}
      />
    </div>
  )
}
