/**
 * Quanto das conversas a IA já leu — e o botão para ler o resto, aqui mesmo.
 *
 * Por que isto é uma peça de primeira classe e não um rodapé: a leitura das conversas
 * (`classificar-conversas`) só roda quando alguém clica. Ela parou em 07/09/2026 e
 * ninguém percebeu por quinze dias. Nesse período, a seção de objeções mostrava "nenhuma
 * objeção nova" — que quem lê entende como "está tudo bem", quando o certo era "ninguém
 * leu". Um painel que não sabe dizer o que ainda não sabe engana com números certos.
 *
 * O retorno fica inline, ao lado do botão, em vez de toast: o resultado pertence ao
 * lugar onde a ação aconteceu, e a seção logo abaixo muda sozinha quando o cache cai.
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Brain, RefreshCw } from 'lucide-react'
import type { CoberturaIA as Cobertura } from '@/lib/analises'
import { classificarPendentes } from '@/lib/analises/classificar'
import { formatDate, cn } from '@/lib/utils'
import { Medidor } from './base'

export default function CoberturaIA({ cobertura }: { cobertura: Cobertura }) {
  const qc = useQueryClient()
  const [lendo, setLendo] = useState(false)
  const [feitas, setFeitas] = useState(0)
  const [recado, setRecado] = useState<string | null>(null)

  // dois dias parada já significa que a conversa de ontem não entrou na conta
  const atrasada = (cobertura.diasParado ?? 0) >= 2 && cobertura.pendentes > 0
  if (cobertura.conversas === 0) return null

  async function ler() {
    if (lendo) return
    setLendo(true); setFeitas(0); setRecado(null)
    try {
      const r = await classificarPendentes(qc, setFeitas)
      setRecado(
        r.total === 0
          ? (r.mensagem ?? 'Nada novo pra ler.')
          : `${r.total} conversa${r.total > 1 ? 's' : ''} lida${r.total > 1 ? 's' : ''}.` +
            (r.restantes ? ` Faltam ${r.restantes} — clique de novo.` : ''),
      )
    } catch (err) {
      setRecado(err instanceof Error ? err.message : 'Não consegui ler agora.')
    } finally {
      setLendo(false)
    }
  }

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 shadow-sm',
      // o atraso avisa pela borda e pelo texto; banho de cor no cartão inteiro só
      // competiria com o acento da receita, que é o único da tela
      atrasada ? 'border-amber-500/40' : 'border-border',
    )}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Brain className={cn('h-3.5 w-3.5 shrink-0', atrasada ? 'text-amber-600 dark:text-amber-400' : 'text-primary')} aria-hidden="true" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">
          Leitura das conversas pela IA
        </p>
        <p className="ml-auto text-xs tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{cobertura.analisadas}</span>
          {' de '}{cobertura.conversas} lidas
          {cobertura.ultimaEm && ` · última em ${formatDate(cobertura.ultimaEm)}`}
        </p>
      </div>

      <Medidor pct={cobertura.pct} tom={atrasada ? 'atencao' : 'neutro'} />

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className={cn('text-xs', atrasada ? 'text-amber-700 dark:text-amber-400' : 'text-foreground/60')}>
          {cobertura.pendentes === 0
            ? 'Tudo lido — as contagens abaixo cobrem todas as conversas do período.'
            : atrasada
              ? `A leitura está parada há ${cobertura.diasParado} dias. ${cobertura.pendentes} conversas estão fora das contagens abaixo.`
              : `${cobertura.pendentes} conversas ainda não entraram nas contagens abaixo.`}
        </p>

        {cobertura.pendentes > 0 && (
          <button
            type="button"
            onClick={ler}
            disabled={lendo}
            className={cn(
              'ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5',
              'text-xs font-semibold transition-all duration-150 active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              'disabled:cursor-not-allowed disabled:opacity-60',
              atrasada
                ? 'border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400'
                : 'border-primary/40 text-primary hover:bg-primary/5',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', lendo && 'animate-spin')} aria-hidden="true" />
            {lendo
              ? (feitas > 0 ? `Lendo… ${feitas} prontas` : 'Lendo…')
              : `Ler as ${cobertura.pendentes} agora`}
          </button>
        )}
      </div>

      {recado && <p className="mt-2 text-xs text-foreground/70">{recado}</p>}
    </div>
  )
}
