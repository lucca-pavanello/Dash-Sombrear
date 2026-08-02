import { useMemo, memo } from 'react'
import type { Orcamento } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import ChartTooltip from '@/components/shared/ChartTooltip'

const CHART_COLORS = ['#E8701A', '#F59E0B', '#D97706', '#B45309', '#92400E', '#C45E14', '#FB923C', '#FDBA74']

interface Props { data: Orcamento[]; resetKey?: number; loading?: boolean }

function ResponsavelChart({ data, resetKey, loading }: Props) {
  const chartData = useMemo(() => {
    const grouped = data.reduce<Record<string, number>>((acc, o) => {
      acc[o.responsavel] = (acc[o.responsavel] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(grouped)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [data])

  return (
    <div className="rounded-xl border-2 bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-display text-sm font-semibold tracking-wide text-foreground">Orçamentos por Responsável</h3>
      {loading ? (
        <div className="h-[200px] rounded-lg skeleton-shimmer" />
      ) : chartData.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-foreground">Nenhum orçamento no filtro</p>
          <p className="text-xs text-muted-foreground">Ajuste o período ou os filtros para ver o ranking</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart key={resetKey} data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barSize={28}>
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} cursor="pointer" isAnimationActive animationBegin={0} animationDuration={600} animationEasing="ease-out">
              {chartData.map((entry, i) => (
                <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default memo(ResponsavelChart)
