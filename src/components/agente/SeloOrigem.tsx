import { Globe, HelpCircle, Instagram, Link2, MessageCircle, Search, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Origem do lead — de onde a pessoa veio antes de cair no WhatsApp.
 *
 * O gestor de tráfego lê esta tela pra decidir onde investir, então cada canal
 * tem cor e ícone fixos: ele bate o olho e reconhece sem ler. O laranja da
 * marca fica de fora de propósito (ver DESIGN.md: laranja é ação e seleção,
 * não categoria) — quem usa laranja aqui é só o chip selecionado no filtro.
 */
export const ORIGENS = [
  { id: 'google',    rotulo: 'Google',    icone: Search,        cor: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  { id: 'instagram', rotulo: 'Instagram', icone: Instagram,     cor: 'border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300' },
  { id: 'facebook',  rotulo: 'Facebook',  icone: Users,         cor: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  { id: 'site',      rotulo: 'Site',      icone: Globe,         cor: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' },
  { id: 'indicacao', rotulo: 'Indicação', icone: Link2,         cor: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  { id: 'direto',    rotulo: 'Direto',    icone: MessageCircle, cor: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
] as const

export const SEM_ORIGEM = {
  id: 'sem_origem', rotulo: 'Sem origem', icone: HelpCircle,
  cor: 'border-border bg-muted/60 text-muted-foreground',
} as const

/** Normaliza o que veio do banco: aceita 'Google', 'google_ads', 'GOOGLE ' … */
export function acharOrigem(valor: string | null | undefined) {
  const chave = (valor ?? '').toLowerCase().trim()
  // o próprio id da ausência também precisa voltar como ausência: o relatório
  // agrupa por id e reenvia 'sem_origem' pra cá
  if (!chave || chave === SEM_ORIGEM.id) return SEM_ORIGEM
  return ORIGENS.find(o => chave === o.id || chave.startsWith(o.id)) ?? {
    id: chave, rotulo: valor as string, icone: HelpCircle,
    cor: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  }
}

export default function SeloOrigem({ origem, campanha, className, compacto }: {
  origem: string | null | undefined
  /** campanha/anúncio, quando o canal informa — vira tooltip */
  campanha?: string | null
  className?: string
  /** só o ícone, pra caber em espaço curto */
  compacto?: boolean
}) {
  const o = acharOrigem(origem)
  const Icone = o.icone
  return (
    <span
      title={campanha ? `${o.rotulo} · ${campanha}` : o.rotulo}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        o.cor, className,
      )}
    >
      <Icone className="h-3 w-3 shrink-0" aria-hidden="true" />
      {!compacto && o.rotulo}
    </span>
  )
}
