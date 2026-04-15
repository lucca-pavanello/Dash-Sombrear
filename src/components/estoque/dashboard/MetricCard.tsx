import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  variant?: 'primary' | 'secondary'
  valueColor?: 'primary' | 'destructive'
  onClick?: () => void
}

const variantCls = {
  primary: {
    card: 'border-primary/35 bg-primary/10 dark:bg-primary/15',
    label: 'text-muted-foreground/70',
    iconWrap: 'bg-primary/15 text-primary',
    valueDef: 'text-primary',
    sub: 'text-muted-foreground/60',
  },
  secondary: {
    card: 'border-primary/20 bg-primary/5 dark:bg-primary/8',
    label: 'text-muted-foreground/70',
    iconWrap: 'bg-primary/15 text-primary',
    valueDef: 'text-foreground',
    sub: 'text-muted-foreground/60',
  },
}

export default function MetricCard({ title, value, subtitle, icon: Icon, variant, valueColor, onClick }: Props) {
  const v = variant ? variantCls[variant] : null

  const valueCls = valueColor === 'destructive'
    ? 'text-red-700'
    : v
      ? v.valueDef
      : valueColor === 'primary'
        ? 'text-primary'
        : 'text-foreground'

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 shadow-sm p-4 flex flex-col gap-3 transition-all',
        v ? v.card : 'bg-card',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-[10px] font-semibold uppercase tracking-[0.07em] leading-tight', v ? v.label : 'text-muted-foreground/70')}>
          {title}
        </p>
        <div className={cn('rounded-lg p-1.5 shrink-0', v ? v.iconWrap : 'bg-muted/50 text-muted-foreground')}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn('text-2xl font-bold leading-none', valueCls)}>
        {value}
      </p>
      {subtitle && (
        <p className={cn('text-xs', v ? v.sub : 'text-muted-foreground')}>{subtitle}</p>
      )}
    </div>
  )
}
