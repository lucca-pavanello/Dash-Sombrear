/**
 * O termômetro da carteira.
 *
 * Aqui a leitura é proporção — "dois terços da carteira esfriou" — e não valor absoluto,
 * por isso uma barra empilhada única e não cinco KPIs soltos. Ao contrário das objeções,
 * estas categorias são exclusivas e de fato somam o todo, então empilhar é honesto.
 *
 * Ao lado, o que dá pra fazer hoje: quentes e mornos sem venda registrada, ordenados por
 * quanto tempo estão parados. Painel que só descreve não muda nada.
 */
import { Thermometer, ExternalLink } from 'lucide-react'
import type { Termometro } from '@/lib/analises'
import { CHATWOOT_BASE_URL } from '@/lib/constants'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { cn } from '@/lib/utils'
import { SecaoAnalise, Cobertura } from './base'

/** Quantos parados mostrar. É uma lista de ação, não um relatório. */
const MAX_PARADOS = 6

function linkChatwoot(l: CrmLead): string | null {
  if (!l.id_conta_chatwoot || !l.id_conversa_chatwoot) return null
  return `${CHATWOOT_BASE_URL}/app/accounts/${l.id_conta_chatwoot}/conversations/${l.id_conversa_chatwoot}`
}

export default function TermometroLeads({
  termometro, sensibilidade,
}: {
  termometro: Termometro
  sensibilidade: { nivel: string; rotulo: string; n: number }[]
}) {
  const { degraus, avaliados, total, scoreMedio, paradosQuentes } = termometro
  const temSensibilidade = sensibilidade.some((s) => s.n > 0)

  return (
    <SecaoAnalise
      icone={Thermometer}
      titulo="O termômetro da carteira"
      pergunta="Quanto do funil ainda está quente — e quem está esperando resposta?"
      direita={
        <Cobertura tom={avaliados === 0 ? 'atencao' : 'neutro'}>
          {avaliados} de {total} avaliados
        </Cobertura>
      }
    >
      {avaliados === 0 ? (
        <p className="py-6 text-center text-sm text-foreground/50">
          Nenhuma conversa avaliada no período. A temperatura é calculada pela Amanda a cada
          conversa nova.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <div>
            {/* gap de 2px entre segmentos: encostados, dois tons próximos leem como um só */}
            <div className="flex h-5 gap-[2px] overflow-hidden rounded-full">
              {degraus.map((d) => (
                <div
                  key={d.id}
                  className={cn('h-full first:rounded-l-full last:rounded-r-full', d.barra)}
                  style={{ width: `${d.pct}%` }}
                  title={`${d.rotulo}: ${d.n} (${d.pct.toFixed(0)}%)`}
                />
              ))}
            </div>

            <ul className="mt-3 space-y-1.5">
              {degraus.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-xs">
                  <span className={cn('h-3 w-3 shrink-0 rounded-sm', d.barra)} aria-hidden="true" />
                  <span className="text-foreground/75">{d.rotulo}</span>
                  <span className="ml-auto tabular-nums font-semibold text-foreground">{d.n}</span>
                  <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">
                    {d.pct.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
              {scoreMedio !== null && (
                <span>Score médio <span className="font-semibold tabular-nums text-foreground">{scoreMedio.toFixed(0)}</span>/100</span>
              )}
              {temSensibilidade && (
                <span>
                  Sensibilidade a preço:{' '}
                  {sensibilidade.filter((s) => s.n > 0).map((s) => `${s.rotulo.toLowerCase()} ${s.n}`).join(' · ')}
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">
              Quentes e mornos sem pedido
            </p>
            {paradosQuentes.length === 0 ? (
              <p className="mt-2 text-xs text-foreground/50">
                Ninguém quente esperando — todo mundo que estava aquecido já virou pedido.
              </p>
            ) : (
              <>
                <ul className="mt-2 space-y-1">
                  {paradosQuentes.slice(0, MAX_PARADOS).map(({ lead, dias }) => {
                    const link = linkChatwoot(lead)
                    return (
                      <li key={lead.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/30">
                        <span className="truncate text-foreground/85">{lead.nome ?? 'Sem nome'}</span>
                        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                          {dias === 0 ? 'hoje' : `${dias}d parado`}
                        </span>
                        {link && (
                          <a
                            href={link} target="_blank" rel="noopener noreferrer"
                            title="Abrir a conversa no Chatwoot"
                            className="shrink-0 rounded text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {paradosQuentes.length > MAX_PARADOS && (
                  <p className="mt-1.5 px-2 text-[11px] text-muted-foreground">
                    e mais {paradosQuentes.length - MAX_PARADOS} na aba Agente IA.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </SecaoAnalise>
  )
}
