import type { Orcamento } from '@/lib/supabase'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#E8701A', '#C45E14', '#F0854A', '#A04D10', '#F5A374', '#7A3A0C']

interface Props { data: Orcamento[] }

export default function ModelosChart({ data }: Props) {
  const grouped = data.reduce<Record<string, number>>((acc, o) => {
    acc[o.modelo] = (acc[o.modelo] ?? 0) + 1
    return acc
  }, {})

  const chartData = Object.entries(grouped).map(([name, value]) => ({ name, value }))

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-display text-base font-semibold">Orçamentos por Modelo</h3>
      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Sem dados</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
              labelStyle={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
