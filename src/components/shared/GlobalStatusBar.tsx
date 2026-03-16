import { useMemo } from 'react'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { META_KEY } from '@/lib/constants'

interface Props {
  orcamentos: Orcamento[]
}

function getMeta(): number {
  try {
    const v = localStorage.getItem(META_KEY)
    return v ? Number(v) : 0
  } catch { return 0 }
}

export default function GlobalStatusBar({ orcamentos }: Props) {
  const stats = useMemo(() => {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const doMes = orcamentos.filter((o) => new Date(o.created_at) >= firstOfMonth)
    const fechadosMes = doMes.filter((o) => o.fechado)

    const faturamento = fechadosMes.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)
    const conversao = doMes.length > 0 ? (fechadosMes.length / doMes.length) * 100 : 0
    const total = doMes.length
    const meta = getMeta()
    const progresso = meta > 0 ? Math.min((faturamento / meta) * 100, 100) : 0

    return { faturamento, conversao, total, fechados: fechadosMes.length, meta, progresso }
  }, [orcamentos])

  return (
    <div className="border-b border-primary/10 bg-muted/40 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] items-center gap-0 overflow-x-auto scrollbar-none px-4 md:px-6">

        {/* Faturamento */}
        <div className="flex shrink-0 items-center gap-2 px-4 py-2 border-r border-border/60 first:pl-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Fat. mês</span>
          <span className="text-xs font-bold tabular-nums text-foreground">{formatCurrency(stats.faturamento)}</span>
        </div>

        {/* Conversão */}
        <div className="flex shrink-0 items-center gap-2 px-4 py-2 border-r border-border/60">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Conversão</span>
          <span className="text-xs font-bold tabular-nums text-foreground">{stats.conversao.toFixed(0)}%</span>
          <span className="text-[10px] text-muted-foreground/60">{stats.fechados}/{stats.total}</span>
        </div>

        {/* Meta progress */}
        {stats.meta > 0 && (
          <div className="flex shrink-0 items-center gap-2.5 px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Meta</span>
            <div className="flex items-center gap-1.5">
              <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-border">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${stats.progresso}%` }}
                />
              </div>
              <span className={`text-xs font-bold tabular-nums ${stats.progresso >= 100 ? 'text-green-600 dark:text-green-400' : stats.progresso >= 70 ? 'text-primary' : 'text-muted-foreground'}`}>
                {stats.progresso.toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
