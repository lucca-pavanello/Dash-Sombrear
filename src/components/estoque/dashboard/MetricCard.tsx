import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  accent?: 'default' | 'primary' | 'amber' | 'orange' | 'slate'
  onClick?: () => void
}

const ACCENT_CLASSES: Record<NonNullable<Props['accent']>, string> = {
  default: 'border-l-border text-foreground',
  primary: 'border-l-primary text-primary',
  amber:   'border-l-amber-500 text-amber-600',
  orange:  'border-l-orange-500 text-orange-600',
  slate:   'border-l-slate-400 text-slate-500',
}

export default function MetricCard({ title, value, subtitle, icon: Icon, accent = 'default', onClick }: Props) {
  const accentCls = ACCENT_CLASSES[accent]
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 border-l-4 bg-card shadow-sm px-4 py-3 flex items-center gap-3 transition-shadow',
        accentCls,
        onClick && 'cursor-pointer hover:shadow-md',
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          {title}
        </p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
