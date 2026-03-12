import type { Orcamento } from '@/lib/supabase'

const COLORS = ['#E8701A', '#F59E0B', '#F97316', '#D97706', '#FB923C', '#B45309', '#FDBA74', '#92400E']

interface Props { data: Orcamento[] }

export default function ModelosChart({ data }: Props) {
  const grouped = data.reduce<Record<string, number>>((acc, o) => {
    if (o.modelo) acc[o.modelo] = (acc[o.modelo] ?? 0) + 1
    return acc
  }, {})

  const total = data.length
  const chartData = Object.entries(grouped)
    .map(([name, count]) => ({ name, count, pct: total > 0 ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-sm font-medium tracking-wide">Orçamentos por Modelo</h3>
        <span className="text-xs text-muted-foreground">{total} total</span>
      </div>
      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sem dados</div>
      ) : (
        <div className="space-y-2.5">
          {chartData.map(({ name, count, pct }, i) => (
            <div key={name}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium" title={name}>{name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {count} <span className="text-muted-foreground/50">· {pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
