import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const badgeVariants = {
  urgent:  'bg-red-50 text-red-700 border border-red-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  info:    'bg-orange-50 text-orange-700 border border-orange-200',
  neutral: 'bg-gray-50 text-gray-700 border border-gray-200',
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
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-gray-50 transition-colors cursor-pointer"
      >
        {/* Lado esquerdo: ícone + texto */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
            <Icon className="h-5 w-5 text-orange-600" />
          </span>
          <div className="flex flex-col min-w-0">
            <p className="text-base font-semibold text-gray-900 leading-tight">{title}</p>
            <p className="text-sm text-gray-500 leading-snug mt-0.5 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Lado direito: badge + chevron */}
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
            'h-5 w-5 text-gray-400 transition-transform duration-200',
            open && 'rotate-180',
          )} />
        </div>
      </button>

      {open && <div className="border-t border-gray-200">{children}</div>}
    </div>
  )
}
