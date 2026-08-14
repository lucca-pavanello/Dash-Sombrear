/**
 * O funil que o gestor lê em três segundos: quantos chegaram, quantos viraram
 * orçamento, quantos fecharam — e quanto isso rendeu.
 *
 * O rótulo mora FORA da barra. Dentro dela ele sumia em reticências toda vez
 * que a etapa era pequena ("0 L…", "6 F. …") — e etapa pequena é justamente a
 * que precisa ser lida. Agora a barra carrega só o comprimento do dado, sobre
 * um trilho que mostra o quanto falta pro topo: é o vazio que conta a queda.
 *
 * A base é o MAIOR estágio, não o primeiro. Quando entram orçamentos sem lead
 * rastreado (balcão, histórico), o meio do funil fica maior que o topo — e aí
 * a leitura honesta é "não há base pra comparar", não uma barra inventada.
 */
import { Fragment } from 'react'
import { ArrowDown } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

const ETAPAS = [
  { rotulo: 'Leads',       hint: 'chegaram no WhatsApp', barra: 'bg-sky-500/70 dark:bg-sky-400/60'         },
  { rotulo: 'Orçamentos',  hint: 'receberam valor',      barra: 'bg-amber-500/75 dark:bg-amber-400/65'     },
  { rotulo: 'Fechamentos', hint: 'viraram venda',        barra: 'bg-emerald-500/80 dark:bg-emerald-400/70' },
] as const

export default function FunilConversao({ leads, orcados, fechados, faturamento }: {
  leads: number; orcados: number; fechados: number; faturamento: number
}) {
  const valores = [leads, orcados, fechados]
  const topo = Math.max(...valores, 1)
  /** 0 não desenha barra nenhuma; acima disso, piso de 1,5% pra não sumir */
  const largura = (v: number) => (v === 0 ? '0%' : `${Math.max((v / topo) * 100, 1.5)}%`)
  const pct = (de: number, para: number) =>
    de > 0 ? `${((para / de) * 100).toFixed(0)}%` : null

  const ticket = fechados > 0 ? faturamento / fechados : 0
  const vazio = leads === 0 && orcados === 0 && fechados === 0

  return (
    <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mx-auto w-full max-w-5xl">
        {vazio ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum lead, orçamento ou venda neste período.
          </p>
        ) : (
          <>
            {ETAPAS.map((etapa, i) => {
              const valor = valores[i]
              const conversao = i > 0 ? pct(valores[i - 1], valores[i]) : null
              // topo zerado com meio cheio: a venda não veio de lead rastreado
              const semRastreio = i === 0 && valor === 0 && orcados > 0
              return (
                <Fragment key={etapa.rotulo}>
                  {i > 0 && (
                    <div className="flex items-center gap-1.5 py-2 text-[11px] font-semibold text-muted-foreground">
                      <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {conversao != null
                        ? <>{conversao} avançaram</>
                        : <span className="font-normal opacity-70">sem base para comparar</span>}
                    </div>
                  )}
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-sm font-semibold text-foreground">
                        {etapa.rotulo}
                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                          {semRastreio ? 'nenhum lead rastreado no período' : etapa.hint}
                        </span>
                      </p>
                      <p className="shrink-0 font-display text-xl font-bold tabular-nums text-foreground">
                        {valor}
                      </p>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted/60">
                      <div className={cn('h-full rounded-full', etapa.barra)} style={{ width: largura(valor) }} />
                    </div>
                  </div>
                </Fragment>
              )
            })}

            <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border/60 sm:grid-cols-3">
              {[
                { rotulo: 'Faturou', valor: formatCurrency(faturamento), destaque: true },
                { rotulo: 'Ticket médio', valor: ticket > 0 ? formatCurrency(ticket) : '—' },
                { rotulo: 'Orçamento → venda', valor: pct(orcados, fechados) ?? '—' },
              ].map(s => (
                <div key={s.rotulo}
                  className="flex items-baseline justify-between gap-3 bg-card px-3 py-2.5 sm:block sm:text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">{s.rotulo}</p>
                  <p className={cn('font-display text-base font-bold tabular-nums sm:mt-0.5 sm:text-lg',
                    s.destaque ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
                    {s.valor}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
