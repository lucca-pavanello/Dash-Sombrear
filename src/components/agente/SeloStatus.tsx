import {
  CalendarCheck, CheckCircle2, Circle, Clock, FileText, HandCoins,
  MessageCircle, Moon, Ruler, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Estágio do lead na conversa com a Stella.
 *
 * O agente (n8n, `Stella | CRM`) grava `status_lead` como STRING "1".."4" e,
 * junto, um `status_motivo` — uma frase do que aconteceu na conversa que
 * colocou o lead ali. O número sozinho não diz nada pra quem vende, então a
 * tela mostra o rótulo e guarda o motivo no tooltip.
 *
 * A escala de cor sobe junto com o estágio (cinza → azul → âmbar → verde),
 * pra dar noção de avanço batendo o olho. Laranja fica de fora: no DESIGN.md
 * ele é ação e seleção, não categoria.
 *
 * O significado dos 4 estágios é combinado com o prompt do extrator no n8n —
 * mudar aqui sem avisar o outro lado faz os dois divergirem.
 */
export const ESTAGIOS = [
  { id: '1', rotulo: 'Novo contato',    icone: Circle,        cor: 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300',
    explica: 'Saudação ou conversa inicial — ainda não passou dados.' },
  { id: '2', rotulo: 'Coletando dados', icone: Ruler,         cor: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    explica: 'Está passando medidas e detalhes técnicos.' },
  { id: '3', rotulo: 'Orçado',          icone: FileText,      cor: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    explica: 'Já recebeu o orçamento.' },
  { id: '4', rotulo: 'Quer fechar',     icone: HandCoins,     cor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    explica: 'Demonstrou interesse em prosseguir — é a hora de um humano entrar.' },
] as const

/** Estados que não vêm do agente: marcados no dash ou herdados do histórico */
const OUTROS = [
  { id: 'convertido', rotulo: 'Convertido', icone: CheckCircle2, cor: 'border-emerald-600 bg-emerald-600 text-white',
    explica: 'Marcado como venda fechada no dash.' },
  { id: 'fechado',    rotulo: 'Convertido', icone: CheckCircle2, cor: 'border-emerald-600 bg-emerald-600 text-white',
    explica: 'Marcado como venda fechada no dash.' },
  { id: 'perdido',    rotulo: 'Perdido',    icone: XCircle,      cor: 'border-destructive/30 bg-destructive/10 text-destructive',
    explica: 'Lead descartado.' },
  { id: 'desistiu',   rotulo: 'Perdido',    icone: XCircle,      cor: 'border-destructive/30 bg-destructive/10 text-destructive',
    explica: 'Lead descartado.' },
  { id: 'aguardando_atendimento', rotulo: 'Aguardando atendimento', icone: Clock, cor: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    explica: 'Esperando alguém da loja assumir.' },
  { id: 'aguardando_atendente',   rotulo: 'Aguardando atendimento', icone: Clock, cor: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    explica: 'Esperando alguém da loja assumir.' },
  { id: 'transferido',rotulo: 'Transferido',icone: MessageCircle, cor: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    explica: 'Conversa passada para um atendente.' },
  { id: 'agendado',   rotulo: 'Agendado',   icone: CalendarCheck, cor: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    explica: 'Visita ou medição marcada.' },
  { id: 'fora_horario', rotulo: 'Fora do horário', icone: Moon, cor: 'border-amber-400/25 bg-amber-400/10 text-amber-700 dark:text-amber-300',
    explica: 'Chegou fora do horário comercial.' },
] as const

const SEM_STATUS = {
  id: 'sem_status', rotulo: 'Sem status', icone: Circle,
  cor: 'border-border bg-muted/60 text-muted-foreground',
  explica: 'A conversa ainda não foi classificada pelo agente.',
} as const

export function acharStatus(raw: string | null | undefined) {
  const chave = String(raw ?? '').toLowerCase().trim()
  if (!chave) return SEM_STATUS
  return ESTAGIOS.find(e => e.id === chave)
    ?? OUTROS.find(o => o.id === chave)
    ?? { ...SEM_STATUS, rotulo: chave.charAt(0).toUpperCase() + chave.slice(1).replace(/_/g, ' ') }
}

/** Estágio 4 = o agente já fez o que podia; daqui pra frente é humano */
export function precisaDeHumano(raw: string | null | undefined) {
  const s = String(raw ?? '').toLowerCase().trim()
  return s === '4' || s === 'aguardando_atendimento' || s === 'aguardando_atendente' || s === 'transferido'
}

export default function SeloStatus({ status, motivo, className }: {
  status: string | null | undefined
  /** frase do que aconteceu na conversa — vira tooltip */
  motivo?: string | null
  className?: string
}) {
  const e = acharStatus(status)
  const Icone = e.icone
  return (
    <span
      role="status"
      title={motivo?.trim() ? `${e.rotulo} — ${motivo.trim()}` : `${e.rotulo} — ${e.explica}`}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold',
        e.cor, className,
      )}
    >
      <Icone className="h-3 w-3 shrink-0" aria-hidden="true" />
      {e.rotulo}
    </span>
  )
}
