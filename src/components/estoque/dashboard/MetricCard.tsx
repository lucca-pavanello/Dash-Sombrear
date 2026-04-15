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
    card: 'bg-orange-100 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900/40',
    label: 'text-orange-700 dark:text-orange-300',
    iconWrap: 'bg-orange-200/50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400',
    valueDef: 'text-orange-900 dark:text-orange-100',
    sub: 'text-orange-600/80 dark:text-orange-400/70',
  },
  secondary: {
    card: 'bg-orange-50 border-orange-100 dark:bg-orange-950/15 dark:border-orange-900/25',
    label: 'text-orange-600 dark:text-orange-400',
    iconWrap: 'bg-orange-100/50 dark:bg-orange-950/20 text-orange-300 dark:text-orange-600',
    valueDef: 'text-gray-900 dark:text-gray-100',
    sub: 'text-gray-500 dark:text-gray-400',
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
        'rounded-xl border shadow-sm p-6 flex flex-col gap-3 transition-all',
        v ? v.card : 'bg-card',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-xs font-semibold uppercase tracking-wide leading-tight', v ? v.label : 'text-muted-foreground')}>
          {title}
        </p>
        <div className={cn('rounded-lg p-1.5 shrink-0', v ? v.iconWrap : 'bg-muted/50 text-muted-foreground')}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn('text-3xl font-semibold leading-none', valueCls)}>
        {value}
      </p>
      {subtitle && (
        <p className={cn('text-xs', v ? v.sub : 'text-muted-foreground')}>{subtitle}</p>
      )}
    </div>
  )
}
