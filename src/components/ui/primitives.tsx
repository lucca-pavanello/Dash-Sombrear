import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Primitivas base do design system Sombrear (ver DESIGN.md).
 * Novos componentes DEVEM usar estas primitivas em vez de repetir classes;
 * telas existentes migram gradualmente quando forem tocadas.
 */

// ── Button ──────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'brand' | 'outline' | 'ghost' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:     'bg-primary text-white hover:bg-primary/90 shadow-sm',
  brand:       'bg-brand-gradient text-white hover:brightness-110 shadow-brand',
  outline:     'border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5',
  ghost:       'text-muted-foreground hover:bg-muted hover:text-foreground',
  destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-sm gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150',
        'active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})

// ── SectionTitle ────────────────────────────────────────────────────

export function SectionTitle({ icon: Icon, children, right, className }: {
  icon?: typeof Loader2
  children: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {Icon && <Icon className="h-4 w-4 text-primary" aria-hidden="true" />}
      <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">{children}</h2>
      {right != null && <div className="ml-auto">{right}</div>}
    </div>
  )
}

// ── EmptyState ──────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, titulo, dica, className }: {
  icon?: typeof Loader2
  titulo: string
  dica?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-1 py-10 text-center', className)}>
      {Icon && (
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
          <Icon className="h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  )
}

// ── Interruptor (toggle em pílula) ───────────────────────────────────────────
/**
 * Linha inteira clicável com um interruptor — "Enviar pelo WhatsApp",
 * "Incluir instalação", "Incluir bandô". Nasceu no Calcular; o Simulador
 * usava checkbox nativo pra mesma coisa. Ligado = verde (estado "ativo/ok",
 * como manda o DESIGN.md); desligado = campo neutro.
 */
export function Interruptor({ ligado, onChange, children, detalhe, className }: {
  ligado: boolean
  onChange: (v: boolean) => void
  children: ReactNode
  /** texto menor embaixo do rótulo */
  detalhe?: ReactNode
  className?: string
}) {
  return (
    <button
      type="button" role="switch" aria-checked={ligado}
      onClick={() => onChange(!ligado)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all duration-200 touch-manipulation',
        ligado
          ? 'border-emerald-500/50 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
          : 'border-border bg-background text-foreground/60 hover:border-muted-foreground/40 hover:bg-muted/30',
        className,
      )}
    >
      <span className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-all duration-200', ligado ? 'border-emerald-500 bg-emerald-500' : 'border-foreground/20 bg-muted')}>
        <span className={cn('absolute left-0 top-0 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200', ligado ? 'translate-x-4' : 'translate-x-0')} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">{children}</span>
        {detalhe && <span className={cn('block text-xs font-normal', ligado ? 'text-emerald-700/80 dark:text-emerald-300/80' : 'text-foreground/50')}>{detalhe}</span>}
      </span>
      {ligado && <span className="ml-auto shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400">Ativado</span>}
    </button>
  )
}

// ── BotaoAdicionar (tracejado, largura inteira) ──────────────────────────────
/** "Adicionar medida / ambiente / persiana" — o mesmo botão tracejado do Calcular. */
export function BotaoAdicionar({ onClick, children, className, tamanho = 'sm' }: {
  onClick: () => void
  children: ReactNode
  className?: string
  tamanho?: 'sm' | 'md'
}) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn(
        'group flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 font-semibold text-foreground/40 transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-[0.99]',
        tamanho === 'sm' ? 'py-2 text-xs' : 'py-2.5 text-sm',
        className,
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-current transition-all duration-200 group-hover:border-primary group-hover:bg-primary group-hover:text-white">
        <Plus className="h-2.5 w-2.5" />
      </span>
      {children}
    </button>
  )
}
