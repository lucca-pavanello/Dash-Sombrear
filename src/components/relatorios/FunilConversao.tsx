/**
 * O funil que o gestor de tráfego lê em três segundos: quantos chegaram,
 * quantos viraram orçamento, quantos fecharam — e quanto isso rendeu.
 *
 * As larguras são proporcionais ao topo do funil, com um piso visual pra
 * barra não sumir quando a conversão é baixa. As porcentagens entre as
 * etapas são a informação de verdade; a forma só ajuda o olho.
 */
import { TrendingDown } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

const ETAPAS = [
  { rotulo: 'Leads',       hint: 'chegaram no WhatsApp',   classe: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  { rotulo: 'Orçamentos',  hint: 'receberam valor',        classe: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  { rotulo: 'Fechamentos', hint: 'viraram venda',          classe: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
] as const

export default function FunilConversao({ leads, orcados, fechados, faturamento }: {
  leads: number; orcados: number; fechados: number; faturamento: number
}) {
  const valores = [leads, orcados, fechados]
  // a base é o MAIOR estágio, não o primeiro: quando entram orçamentos sem lead
  // rastreado (balcão, histórico), o meio do funil é maior que o topo e a barra
  // estourava o card
  const topo = Math.max(...valores, 1)
  const largura = (v: number) => `${Math.max((v / topo) * 100, 14)}%`
  const pct = (de: number, para: number) =>
    de > 0 ? `${((para / de) * 100).toFixed(0)}%` : null

  return (
    <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mx-auto flex max-w-xl flex-col items-center">
        {ETAPAS.map((etapa, i) => {
          const conversao = i > 0 ? pct(valores[i - 1], valores[i]) : null
          return (
            <div key={etapa.rotulo} className="flex w-full flex-col items-center">
              {conversao != null && (
                <div className="flex items-center gap-1 py-1 text-[11px] font-semibold text-muted-foreground">
                  <TrendingDown className="h-3 w-3" aria-hidden="true" />
                  {conversao} avançaram
                </div>
              )}
              <div
                className={cn('flex items-baseline justify-center gap-2 rounded-lg border px-4 py-2.5 transition-[width]', etapa.classe)}
                style={{ width: largura(valores[i]) }}
              >
                <span className="font-display text-xl font-bold tabular-nums">{valores[i]}</span>
                <span className="truncate text-xs font-semibold">{etapa.rotulo}</span>
                <span className="hidden truncate text-[11px] opacity-70 sm:inline">· {etapa.hint}</span>
              </div>
            </div>
          )
        })}
        <div className="mt-3 flex items-baseline gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Faturou</span>
          <span className="font-display text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(faturamento)}
          </span>
          {leads > 0 && (
            <span className="text-[11px] text-muted-foreground">
              · {pct(leads, fechados)} do topo ao fim
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
