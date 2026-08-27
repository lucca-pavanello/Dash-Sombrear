import { Flame, Snowflake, Sun, Trash2, Wind } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Temperatura do lead — calculada pela Amanda (score 0-100) a cada conversa.
 * Existe no banco desde a virada do CRM mas nunca apareceu em nenhuma tela:
 * o time só via isso abrindo o Supabase direto. Escala do mais quente pro
 * mais frio, cor e ícone fixos como em SeloOrigem — o gestor bate o olho.
 * (Decisão do Lucca, 27/08: temperatura mantém identidade própria, não a escala
 * neutra emerald/âmbar do badge de conversão.)
 */
export const TEMPERATURAS = [
  { id: 'quente',   rotulo: 'Quente',   icone: Flame,     cor: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300', barra: 'bg-rose-500' },
  { id: 'morno',    rotulo: 'Morno',    icone: Sun,       cor: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300', barra: 'bg-amber-500' },
  { id: 'frio',     rotulo: 'Frio',     icone: Wind,      cor: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300', barra: 'bg-sky-500' },
  { id: 'gelado',   rotulo: 'Gelado',   icone: Snowflake, cor: 'border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300', barra: 'bg-slate-400' },
  { id: 'descarte', rotulo: 'Descarte', icone: Trash2,    cor: 'border-border bg-muted/60 text-muted-foreground', barra: 'bg-muted-foreground/30' },
] as const

const SEM_TEMPERATURA = {
  id: 'sem_temperatura', rotulo: 'Sem avaliação', icone: Wind,
  cor: 'border-border bg-muted/40 text-muted-foreground/70', barra: 'bg-muted-foreground/15',
} as const

export function acharTemperatura(valor: string | null | undefined) {
  const chave = (valor ?? '').toLowerCase().trim()
  if (!chave) return SEM_TEMPERATURA
  return TEMPERATURAS.find(t => chave === t.id || chave.startsWith(t.id)) ?? SEM_TEMPERATURA
}

export default function SeloTemperatura({ temperatura, score, className }: {
  temperatura: string | null | undefined
  /** 0-100, opcional — vira tooltip quando informado */
  score?: number | null
  className?: string
}) {
  const t = acharTemperatura(temperatura)
  const Icone = t.icone
  return (
    <span
      title={score != null ? `${t.rotulo} · ${score}/100` : t.rotulo}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        t.cor, className,
      )}
    >
      <Icone className="h-3 w-3 shrink-0" aria-hidden="true" />
      {t.rotulo}
    </span>
  )
}
