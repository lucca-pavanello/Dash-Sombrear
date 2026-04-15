import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  valueColor?: 'primary' | 'destructive'
  onClick?: () => void
}

export default function MetricCard({ title, value, subtitle, icon: Icon, valueColor, onClick }: Props) {
  const valueCls =
    valueColor === 'primary' ? 'text-primary' :
    valueColor === 'destructive' ? 'text-red-700' :
    'text-foreground'

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
          {title}
        </p>
        <div className="rounded-lg p-1.5 bg-muted/50 text-muted-foreground shrink-0">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn('text-3xl font-semibold leading-none', valueCls)}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}
