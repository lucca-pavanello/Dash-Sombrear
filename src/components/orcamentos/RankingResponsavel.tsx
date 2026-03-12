import type { Orcamento } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import AvatarInitials from '@/components/shared/AvatarInitials'
import { Trophy } from 'lucide-react'

interface Props { data: Orcamento[] }

const MEDALS = ['🥇', '🥈', '🥉']
const MEDAL_BG = [
  'bg-yellow-500/10 border-yellow-500/20',
  'bg-slate-400/10 border-slate-400/20',
  'bg-orange-600/10 border-orange-600/20',
]

export default function RankingResponsavel({ data }: Props) {
  const ranked = Object.entries(
    data
      .filter((o) => o.fechado === true)
      .reduce<Record<string, { count: number; value: number }>>((acc, o) => {
        if (!acc[o.responsavel]) acc[o.responsavel] = { count: 0, value: 0 }
        acc[o.responsavel].count++
        acc[o.responsavel].value += (o.valor_venda ?? 0) + (o.instacao ?? 0)
        return acc
      }, {})
  )
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Ranking de Responsáveis</h3>
      {ranked.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
            <Trophy className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-semibold text-foreground">Nenhum fechamento ainda</p>
          <p className="text-xs text-muted-foreground">Os dados aparecerão conforme os orçamentos forem fechados</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {ranked.map(({ name, count, value }, i) => {
            const topValue = ranked[0].value
            const pct = topValue > 0 ? (value / topValue) * 100 : 0
            return (
              <div key={name} className={`rounded-lg border p-3 transition-all duration-200 hover:shadow-sm cursor-default ${i < 3 ? MEDAL_BG[i] : 'bg-muted/30 border-border'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    <AvatarInitials name={name} size="md" />
                    {i < 3 && (
                      <span className="absolute -bottom-1 -right-1 text-sm leading-none">{MEDALS[i]}</span>
                    )}
                    {i >= 3 && (
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{name}</span>
                      <span className="text-sm font-bold text-primary shrink-0">{formatCurrency(value)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-gradient transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{count} {count === 1 ? 'fechamento' : 'fechamentos'}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
