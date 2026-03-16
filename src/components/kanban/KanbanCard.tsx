import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ExternalLink } from 'lucide-react'
import type { Orcamento } from '@/lib/supabase'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import AvatarInitials from '@/components/shared/AvatarInitials'

interface Props {
  orcamento: Orcamento
  onClick: (o: Orcamento) => void
  overlay?: boolean
}

export function KanbanCardContent({ orcamento, overlay }: { orcamento: Orcamento; overlay?: boolean }) {
  const diasAberto = !orcamento.fechado
    ? Math.floor((Date.now() - new Date(orcamento.created_at).getTime()) / 86400000)
    : 0

  return (
    <div className={cn(
      'rounded-xl border bg-card p-3 shadow-sm transition-shadow',
      overlay && 'shadow-elevated rotate-1 scale-[1.02]',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate leading-tight">
            {orcamento.cliente ?? <span className="italic text-muted-foreground">Sem cliente</span>}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(orcamento.created_at)}</p>
        </div>
        <AvatarInitials name={orcamento.responsavel} size="xs" />
      </div>

      {/* Produto */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {orcamento.modelo}
        </span>
        {orcamento.ambiente && (
          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {orcamento.ambiente}
          </span>
        )}
      </div>

      {/* Tecido */}
      <p className="text-[11px] text-muted-foreground truncate mb-2">{orcamento.tecido}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {orcamento.valor_venda ? (
          <span className="text-sm font-bold text-primary">
            {formatCurrency(orcamento.valor_venda)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50 italic">Sem valor</span>
        )}
        {diasAberto > 0 && (
          <span className={cn(
            'text-[10px] font-medium',
            diasAberto > 7 ? 'text-destructive' : 'text-muted-foreground',
          )}>
            {diasAberto}d
          </span>
        )}
      </div>

      {/* Share indicator */}
      {orcamento.share_enabled && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-primary/70">
          <ExternalLink className="h-2.5 w-2.5" />
          <span>Compartilhado</span>
        </div>
      )}
    </div>
  )
}

export default function KanbanCard({ orcamento, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: orcamento.id,
    data: { orcamento },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group relative', isDragging && 'opacity-30')}
    >
      {/* drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 flex h-5 w-4 cursor-grab items-center justify-center rounded opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity touch-none"
        aria-label="Arrastar card"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div
        onClick={() => onClick(orcamento)}
        className="cursor-pointer pl-1 hover:scale-[1.01] transition-transform active:scale-[0.99]"
      >
        <KanbanCardContent orcamento={orcamento} />
      </div>
    </div>
  )
}
