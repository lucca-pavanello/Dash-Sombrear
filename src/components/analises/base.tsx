/**
 * As peças pequenas que todas as seções da aba Análise usam.
 *
 * Ficam juntas de propósito: são cinco componentes de 20 linhas que só existem no
 * contexto desta narrativa. Espalhá-los em cinco arquivos daria mais imports do que
 * clareza. O que é reaproveitável fora daqui (`Button`, `SectionTitle`, `EmptyState`,
 * `CustomSelect`) continua vindo das primitivas do projeto.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'
import { SectionTitle } from '@/components/ui/primitives'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/utils'

/**
 * "Já dá pra ver?" — para o número só começar a contar quando a seção entra na tela.
 *
 * Contador que roda antes de aparecer é contador que ninguém vê: a pessoa rola até a
 * seção e encontra o valor final parado. Observa uma vez e desliga.
 */
function useVisivel<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visivel) return
    if (typeof IntersectionObserver === 'undefined') { setVisivel(true); return }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisivel(true); obs.disconnect() } },
      { rootMargin: '0px 0px -10% 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visivel])

  return { ref, visivel }
}

/** Número que conta do zero quando aparece. `useCountUp` já respeita reduced-motion. */
export function NumeroAnimado({
  valor, formatar, duracao = 700, className,
}: {
  valor: number
  formatar?: (v: number) => string
  duracao?: number
  className?: string
}) {
  const { ref, visivel } = useVisivel<HTMLSpanElement>()
  const atual = useCountUp(visivel ? valor : 0, duracao)
  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {formatar ? formatar(atual) : atual.toLocaleString('pt-BR')}
    </span>
  )
}

/**
 * Moldura de seção: título, a pergunta que ela responde, e um slot à direita para a
 * cobertura do dado. A classe `.reveal` é lida pelo `useScrollReveal` do container.
 */
export function SecaoAnalise({
  icone, titulo, pergunta, direita, children, className,
}: {
  icone: LucideIcon
  titulo: string
  pergunta: string
  direita?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('reveal', className)}>
      <SectionTitle icon={icone} right={direita}>{titulo}</SectionTitle>
      <p className="mt-1 text-xs text-foreground/50">{pergunta}</p>
      <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {children}
      </div>
    </section>
  )
}

/**
 * De onde vem o número desta seção. Aparece no canto do título, sempre — quem lê nunca
 * precisa adivinhar se "3 objeções" é o total ou o que a IA conseguiu ler.
 */
export function Cobertura({ children, tom = 'neutro' }: { children: ReactNode; tom?: 'neutro' | 'atencao' }) {
  return (
    <span className={cn(
      'rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums',
      tom === 'atencao'
        ? 'border-amber-500/30 text-amber-700 dark:text-amber-400'
        : 'border-border text-muted-foreground',
    )}>
      {children}
    </span>
  )
}

/**
 * Variação percentual. `bom` diz para que lado o verde aponta: crescer faturamento é
 * bom, crescer objeção não é — e pintar os dois de verde já confundiu leitura antes.
 */
export function Delta({ pct, rotulo, bom = 'subir' }: {
  pct: number | null
  rotulo?: string
  bom?: 'subir' | 'cair'
}) {
  if (pct === null) {
    return <span className="text-[11px] text-muted-foreground/60">{rotulo ? 'sem base de comparação' : ''}</span>
  }
  if (Math.abs(pct) < 1) {
    return <span className="text-[11px] text-muted-foreground">estável {rotulo}</span>
  }
  const subiu = pct > 0
  const positivo = bom === 'subir' ? subiu : !subiu
  const Icone = subiu ? TrendingUp : TrendingDown
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
      positivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
    )}>
      <Icone className="h-3 w-3 shrink-0" aria-hidden="true" />
      {Math.abs(pct).toFixed(0)}%
      {rotulo && <span className="font-normal text-muted-foreground"> {rotulo}</span>}
    </span>
  )
}

/**
 * Barra horizontal de proporção. Cresce com `transform: scaleX` a partir da esquerda —
 * o compositor resolve, e `width` animada forçaria layout a cada quadro.
 */
export function BarraProporcao({ fatia, cor, className, titulo }: {
  fatia: number
  cor?: string
  className?: string
  titulo?: string
}) {
  const { ref, visivel } = useVisivel<HTMLDivElement>()
  return (
    <div ref={ref} title={titulo} className={cn('h-3 overflow-hidden rounded-full bg-muted/70', className)}>
      <div
        className={cn('h-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none', cor ?? 'bg-primary')}
        style={{ transform: `scaleX(${visivel ? Math.max(0, Math.min(1, fatia)) : 0})` }}
      />
    </div>
  )
}

/**
 * Medidor de cobertura de dado. Diferente da barra acima porque o que ele mede não é
 * uma quantidade e sim uma confiança: quanto do universo a gente realmente enxerga.
 */
export function Medidor({ pct, tom = 'neutro' }: { pct: number; tom?: 'neutro' | 'atencao' }) {
  const { ref, visivel } = useVisivel<HTMLDivElement>()
  return (
    <div ref={ref} className="h-2 overflow-hidden rounded-full bg-muted/70" role="presentation">
      <div
        className={cn(
          'h-full origin-left rounded-full transition-transform duration-700 ease-out motion-reduce:transition-none',
          tom === 'atencao' ? 'bg-amber-500' : 'bg-primary',
        )}
        style={{ transform: `scaleX(${visivel ? Math.max(0, Math.min(1, pct / 100)) : 0})` }}
      />
    </div>
  )
}
