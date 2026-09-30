/**
 * O card de bater o olho do Por canal: quanto entrou em cima, e embaixo o funil que
 * explica de onde veio.
 *
 * O dinheiro sobe pro topo (30/09, Lucca). Antes ele morava num rodapé de 16-18px, menor
 * que a contagem de leads (20px): a tela respondia "quantos chegaram" antes de "deu
 * resultado?". Cor da marca só no valor, nunca no fundo do bloco (reverte de 27/08).
 *
 * O funil fica dentro dos leads: chegaram, receberam preço, compraram. A venda de balcão,
 * que não passou por conversa, entra no faturamento e nos pedidos da faixa de cima, mas não
 * no funil. Antes a última etapa contava pedido de qualquer canal e o "avançaram" passava de
 * 100%.
 *
 * O rótulo mora FORA da barra (14/08): dentro dela ele sumia em reticências justo na etapa
 * pequena, que é a que precisa ser lida. A base é o MAIOR estágio, não o primeiro.
 */
import { Fragment } from 'react'
import { ArrowDown } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

const ETAPAS = [
  { rotulo: 'Leads',     hint: 'chegaram no WhatsApp',          barra: 'bg-primary/45' },
  { rotulo: 'Orçados',   hint: 'receberam preço no WhatsApp',   barra: 'bg-primary/70' },
  { rotulo: 'Compraram', hint: 'leads que viraram pedido',      barra: 'bg-primary'    },
] as const

export default function FunilConversao({ leads, orcados, convertidos, pedidos, faturamento }: {
  leads: number
  orcados: number
  /** leads do período que viraram pedido */
  convertidos: number
  /** pedidos do período, de todos os canais (balcão incluso) */
  pedidos: number
  faturamento: number
}) {
  const valores = [leads, orcados, convertidos]
  const topo = Math.max(...valores, 1)
  /** 0 não desenha barra nenhuma; acima disso, piso de 1,5% pra não sumir */
  const largura = (v: number) => (v === 0 ? '0%' : `${Math.max((v / topo) * 100, 1.5)}%`)
  const pct = (de: number, para: number) =>
    de > 0 ? `${((para / de) * 100).toFixed(0)}%` : null

  const ticket = pedidos > 0 ? faturamento / pedidos : 0

  return (
    <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mx-auto w-full max-w-5xl">
        {/* o resultado primeiro: Faturou é o maior número do card */}
        <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border/60 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-2 bg-card px-3 py-2.5 text-center sm:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">Faturou</p>
            <p className="font-display text-2xl font-bold tabular-nums text-primary sm:text-3xl">
              {formatCurrency(faturamento)}
            </p>
          </div>
          {[
            { rotulo: 'Pedidos', valor: String(pedidos), dica: 'todos os canais' },
            { rotulo: 'Ticket médio', valor: ticket > 0 ? formatCurrency(ticket) : '—', dica: 'por pedido' },
          ].map(s => (
            <div key={s.rotulo} className="flex flex-col justify-center bg-card px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">{s.rotulo}</p>
              <p className="font-display text-base font-bold tabular-nums text-foreground sm:text-lg">{s.valor}</p>
              <p className="text-[10px] text-muted-foreground">{s.dica}</p>
            </div>
          ))}
        </div>

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
      </div>
    </div>
  )
}
