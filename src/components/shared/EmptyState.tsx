import type { ElementType } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  icon: ElementType
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export default function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
        <Icon className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-muted px-4 py-2 text-xs font-medium hover:bg-muted/80 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
