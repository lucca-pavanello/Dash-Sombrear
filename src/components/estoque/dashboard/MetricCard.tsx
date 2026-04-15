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
        'rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 flex flex-col gap-2 transition-all',
        onClick && 'cursor-pointer hover:border-primary/40 hover:shadow-sm hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 leading-tight">
          {title}
        </p>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-4 w-4 text-primary/70" />
        </div>
      </div>
      <p className={cn('text-2xl font-bold leading-none', valueColor === 'destructive' ? 'text-destructive' : 'text-foreground')}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}
