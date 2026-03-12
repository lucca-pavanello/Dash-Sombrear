import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

export type KpiVariant = 'default' | 'emerald' | 'blue' | 'orange' | 'purple' | 'amber'

interface KpiCardProps {
  title: string
  value: string | number
  icon: ReactNode
  subtitle?: string
  className?: string
  variant?: KpiVariant
  trend?: { pct: number; label?: string }
}

const VARIANTS: Record<KpiVariant, { icon: string; border: string }> = {
  default: { icon: 'bg-muted text-muted-foreground', border: '' },
  emerald: {
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    border: 'border-l-4 border-l-emerald-500',
  },
  blue: {
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    border: 'border-l-4 border-l-blue-500',
  },
  orange: {
    icon: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    border: 'border-l-4 border-l-orange-500',
  },
  purple: {
    icon: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    border: 'border-l-4 border-l-purple-500',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    border: 'border-l-4 border-l-amber-500',
  },
}

export default function KpiCard({
  title,
  value,
  icon,
  subtitle,
  className = '',
  variant = 'default',
  trend,
}: KpiCardProps) {
  const styles = VARIANTS[variant]
  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${styles.border} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="font-display mt-1 text-xl font-bold truncate">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>}
          {trend != null && (
            <p
              className={`mt-1 flex items-center gap-0.5 text-xs font-semibold ${
                trend.pct >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-destructive'
              }`}
            >
              {trend.pct >= 0 ? (
                <TrendingUp className="h-3 w-3 shrink-0" />
              ) : (
                <TrendingDown className="h-3 w-3 shrink-0" />
              )}
              {trend.pct >= 0 ? '+' : ''}
              {trend.pct.toFixed(0)}%{' '}
              <span className="font-normal text-muted-foreground">
                {trend.label ?? 'vs mês anterior'}
              </span>
            </p>
          )}
        </div>
        <div className={`shrink-0 rounded-lg p-1.5 ${styles.icon}`}>{icon}</div>
      </div>
    </div>
  )
}
