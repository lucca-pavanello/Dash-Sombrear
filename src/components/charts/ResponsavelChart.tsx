import { useMemo, memo } from 'react'
import type { Orcamento } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CHART_COLORS = ['#E8701A', '#F59E0B', '#D97706', '#B45309', '#92400E', '#F97316', '#FB923C', '#FDBA74']

interface Props { data: Orcamento[] }

function ResponsavelChart({ data }: Props) {
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
      <h3 className="mb-4 font-display text-sm font-medium tracking-wide">Orçamentos por Responsável</h3>
      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sem dados</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barSize={28}>
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
              labelStyle={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} cursor="pointer" isAnimationActive animationBegin={200} animationDuration={1100} animationEasing="ease-out">
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
