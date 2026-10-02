import { useState } from 'react'
import { ExternalLink, TrendingDown, TrendingUp } from 'lucide-react'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { CHATWOOT_BASE_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Ranking de etiquetas com o detalhe que abre: as conversas daquela etiqueta, cada uma
 * com a frase da IA e o link do Chatwoot pra conferir se a etiqueta bate. Usado pelas
 * objeções (IA e equipe) e pelas falhas de atendimento da equipe.
 */

/** mesma regra de data da aba: vale a última mensagem, não a criação da linha */
export function dataAtividade(l: CrmLead): string {
  const ultima = l.timestamp_ultima_msg ? new Date(l.timestamp_ultima_msg).getTime() : NaN
  const criada = new Date(l.created_at).getTime()
  return Number.isFinite(ultima) && ultima > criada ? (l.timestamp_ultima_msg as string) : l.created_at
}

export function linkChatwoot(l: CrmLead): string | null {
  if (!l.id_conta_chatwoot || !l.id_conversa_chatwoot) return null
  return `${CHATWOOT_BASE_URL}/app/accounts/${l.id_conta_chatwoot}/conversations/${l.id_conversa_chatwoot}`
}

export function Delta({ pct, rotulo }: { pct: number | null; rotulo: string }) {
  if (pct === null || Math.abs(pct) < 1) return null
  const Icone = pct > 0 ? TrendingUp : TrendingDown
  // subir objeção ou falha é ruim, cair é bom — o oposto do delta de faturamento
  const cor = pct > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
  return (
    <span className={cn('flex shrink-0 items-center gap-0.5 text-[11px] font-medium tabular-nums', cor)}>
      <Icone className="h-3 w-3" aria-hidden="true" />
      {Math.abs(pct).toFixed(0)}% <span className="font-normal text-muted-foreground">{rotulo}</span>
    </span>
  )
}

export type LinhaRanking = {
  id: string
  rotulo: string
  cor: string
  dica: string
  n: number
  pct: number
  delta: number | null
}

export function RankingEtiquetas({ linhas, conversasDe, fraseDe, rotuloDelta }: {
  linhas: LinhaRanking[]
  conversasDe: (id: string) => CrmLead[]
  /** a frase da IA sobre a conversa, mostrada no detalhe */
  fraseDe: (l: CrmLead) => string | null | undefined
  rotuloDelta: string
}) {
  const [aberta, setAberta] = useState<string | null>(null)
  return (
    <div className="space-y-2.5">
      {linhas.map(({ id, rotulo, cor, dica, n, pct, delta }) => {
        const aberto = aberta === id
        return (
          <div key={id}>
            <button
              onClick={() => setAberta(aberto ? null : id)}
              aria-expanded={aberto}
              className="w-full rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full border', cor)} aria-hidden="true" />
                  <span className="truncate text-xs font-medium">{rotulo}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Delta pct={delta} rotulo={rotuloDelta} />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {n} <span className="text-muted-foreground/50">· {pct.toFixed(0)}%</span>
                  </span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-foreground/25 transition-all duration-500"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </button>

            {aberto && (
              <div className="mt-2 space-y-1.5 rounded-lg bg-muted/25 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">{dica}</p>
                {conversasDe(id).map(l => {
                  const url = linkChatwoot(l)
                  return (
                    <div key={l.id} className="flex items-start justify-between gap-2 border-t border-border/50 pt-1.5 first:border-0 first:pt-0">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{l.nome || 'sem nome'}</p>
                        <p className="text-[11px] text-muted-foreground">{fraseDe(l) || 'sem motivo registrado'}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {new Date(dataAtividade(l)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir a conversa no Chatwoot"
                            className="text-muted-foreground transition-colors hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
