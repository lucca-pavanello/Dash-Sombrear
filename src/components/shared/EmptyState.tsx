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
  animated?: boolean
}

export default function EmptyState({ icon: Icon, title, description, action, className, animated }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="mb-4 relative flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
        {animated && (
          <svg
            className="absolute -inset-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)]"
            viewBox="0 0 68 68"
            fill="none"
          >
            <circle
              cx="34" cy="34" r="32"
              stroke="hsl(var(--primary))"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="201"
              strokeDashoffset="201"
              style={{ animation: 'svg-ring-draw 0.9s cubic-bezier(0.4,0,0.2,1) 0.1s forwards' }}
            />
          </svg>
        )}
        <Icon className={cn(
          'h-7 w-7 text-muted-foreground/50',
          animated && 'animate-in zoom-in-75 fade-in-0 duration-500 fill-mode-both delay-300'
        )} />
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
