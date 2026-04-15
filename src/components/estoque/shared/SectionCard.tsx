import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const badgeVariants = {
  urgent:  'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40',
  info:    'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40',
  neutral: 'bg-gray-50 text-gray-700 border border-gray-200 dark:bg-muted/20 dark:text-muted-foreground dark:border-border',
}

interface SectionCardProps {
  icon: LucideIcon
  title: string
  subtitle: string
  badge?: { label: string; variant: 'urgent' | 'warning' | 'info' | 'neutral' }
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function SectionCard({
  icon: Icon,
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-muted/30 transition-colors cursor-pointer"
      >
        {/* Col 1: ícone */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/30">
          <Icon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </span>

        {/* Col 2: título + subtítulo centralizados */}
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-base font-semibold text-gray-900 dark:text-foreground leading-tight">{title}</p>
          <p className="text-sm text-gray-500 dark:text-muted-foreground leading-snug mt-0.5">{subtitle}</p>
        </div>

        {/* Col 3: badge + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          {badge && (
            <span className={cn(
              'inline-flex h-7 px-3 items-center rounded-full text-xs font-medium',
              badgeVariants[badge.variant],
            )}>
              {badge.label}
            </span>
          )}
          <ChevronDown className={cn(
            'h-5 w-5 text-gray-400 dark:text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )} />
        </div>
      </button>

      {open && <div className="border-t border-gray-200 dark:border-border">{children}</div>}
    </div>
  )
}
