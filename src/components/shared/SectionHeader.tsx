import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Cabeçalho de etapa — o padrão do Calcular (número, ícone, título, régua).
 *
 * Existia copiado em TabCotacao e TabSimulador; cada cópia foi divergindo um
 * pouco. Telas novas usam esta; as antigas migram quando forem tocadas.
 */
export default function SectionHeader({ step, icon, title, hint, badge, done, className }: {
  step: string
  icon?: ReactNode
  title: string
  /** dica curta à direita do título, some no mobile */
  hint?: string
  badge?: string
  done?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
        'transition-colors duration-200',
        done ? 'bg-emerald-500' : 'bg-primary',
      )}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : step}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-foreground/40" aria-hidden="true">{icon}</span>}
        <span className="whitespace-nowrap text-sm font-bold text-foreground">{title}</span>
        {badge && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{badge}</span>
        )}
        {hint && <span className="hidden truncate text-xs text-foreground/45 sm:inline">{hint}</span>}
      </div>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  )
}
