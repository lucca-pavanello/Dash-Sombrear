import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  valueColor?: 'destructive'
  onClick?: () => void
}

export default function MetricCard({ title, value, subtitle, icon: Icon, valueColor, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 border-primary/50 bg-primary/5 shadow-sm px-4 py-3 flex items-center gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          {title}
        </p>
        <p className={cn('text-xl font-bold leading-tight', valueColor === 'destructive' ? 'text-destructive' : 'text-foreground')}>
          {value}
        </p>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
