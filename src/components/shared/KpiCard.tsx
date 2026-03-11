import type { ReactNode } from 'react'

interface KpiCardProps {
  title: string
  value: string | number
  icon: ReactNode
  subtitle?: string
  className?: string
}

export default function KpiCard({ title, value, icon, subtitle, className = '' }: KpiCardProps) {
  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="font-display mt-1 text-xl font-bold truncate">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <div className="shrink-0 rounded-lg p-1.5 bg-muted text-muted-foreground">
          {icon}
        </div>
      </div>
    </div>
  )
}
