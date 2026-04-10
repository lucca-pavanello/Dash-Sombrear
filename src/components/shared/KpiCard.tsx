import { useEffect, useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type KpiVariant = 'default' | 'emerald' | 'blue' | 'orange' | 'purple' | 'amber'

interface KpiCardProps {
  title: string
  value: string | number
  icon: ReactNode
  subtitle?: string
  className?: string
  variant?: KpiVariant
  trend?: { pct: number; label?: string }
  backContent?: ReactNode
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
  backContent,
}: KpiCardProps) {
  const styles = VARIANTS[variant]
  const [isFlipped, setIsFlipped] = useState(false)

  // ── 3D tilt on hover ──
  const [tiltStyle, setTiltStyle] = useState<CSSProperties>({
    transition: 'transform 300ms ease-out, box-shadow 300ms ease-out',
  })

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isFlipped) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const rotY = (x - 0.5) * 12
    const rotX = -(y - 0.5) * 12
    setTiltStyle({
      transform: `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`,
      transition: 'transform 80ms ease-out, box-shadow 80ms ease-out',
      boxShadow: `${rotY * -0.8}px ${rotX * 0.8}px 20px hsl(var(--primary) / 0.12)`,
    })
  }

  function handleMouseLeave() {
    setTiltStyle({
      transform: 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)',
      transition: 'transform 300ms ease-out, box-shadow 300ms ease-out',
      boxShadow: undefined,
    })
  }

  // ── Flash when value changes ──
  const prevValueRef = useRef<string | number | undefined>(undefined)
  const valueElRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (prevValueRef.current === undefined) {
      prevValueRef.current = value
      return
    }
    if (prevValueRef.current !== value) {
      prevValueRef.current = value
      const el = valueElRef.current
      if (el) {
        el.classList.remove('kpi-value-flash')
        void el.offsetWidth
        el.classList.add('kpi-value-flash')
        const t = setTimeout(() => el.classList.remove('kpi-value-flash'), 800)
        return () => clearTimeout(t)
      }
    }
  }, [value])

  const cardBase = `rounded-xl border bg-card shadow-sm will-change-transform dark:bg-card/75 dark:backdrop-blur-sm dark:border-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${styles.border} ${className}`

  if (!backContent) {
    return (
      <div
        className={cardBase + ' p-4'}
        style={{ ...tiltStyle, transformStyle: 'preserve-3d' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p ref={valueElRef} className="font-display mt-1 text-xl font-bold truncate">{value}</p>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>}
            {trend != null && (
              <p className={`mt-1 flex items-center gap-0.5 text-xs font-semibold ${
                trend.pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
              }`}>
                {trend.pct >= 0 ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
                {trend.pct >= 0 ? '+' : ''}{trend.pct.toFixed(0)}%{' '}
                <span className="font-normal text-muted-foreground">{trend.label ?? 'vs mês anterior'}</span>
              </p>
            )}
          </div>
          <div className={`shrink-0 rounded-lg p-1.5 ${styles.icon}`}>{icon}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cardBase}
      style={{ perspective: '800px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => setIsFlipped(v => !v)}
      title={isFlipped ? 'Clique para voltar' : 'Clique para detalhes'}
    >
      <div className={cn('kpi-flip-inner', isFlipped && 'is-flipped')}>
        {/* Front */}
        <div className="kpi-flip-front p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{title}</p>
              <p ref={valueElRef} className="font-display mt-1 text-xl font-bold truncate">{value}</p>
              {subtitle && <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>}
              {trend != null && (
                <p className={`mt-1 flex items-center gap-0.5 text-xs font-semibold ${
                  trend.pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                }`}>
                  {trend.pct >= 0 ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
                  {trend.pct >= 0 ? '+' : ''}{trend.pct.toFixed(0)}%{' '}
                  <span className="font-normal text-muted-foreground">{trend.label ?? 'vs mês anterior'}</span>
                </p>
              )}
            </div>
            <div className={`shrink-0 rounded-lg p-1.5 ${styles.icon}`}>{icon}</div>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/40 text-right select-none">clique para detalhes ›</p>
        </div>

        {/* Back */}
        <div className="kpi-flip-back p-4 flex flex-col justify-center rounded-xl bg-card border border-border">
          {backContent}
          <p className="mt-2 text-[10px] text-muted-foreground/40 text-right select-none">‹ voltar</p>
        </div>
      </div>
    </div>
  )
}
