import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useGiroMensal } from '@/hooks/useEstoqueAnalytics'
import type { GiroMensalItem } from '@/hooks/useEstoqueAnalytics'

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface TooltipProps {
  active?: boolean
  payload?: { name: string; value: number; color: string; payload: GiroMensalItem }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 shadow-lg text-xs space-y-1">
      <p className="font-semibold capitalize">{label}</p>
      <p>
        <span className="text-muted-foreground">Vendas: </span>
        <span className="font-medium">{fmtBRL(d?.vendas_reais ?? 0)}</span>
      </p>
      {payload.map(p => (
        <p key={p.name}>
          <span className="text-muted-foreground">{p.name}: </span>
          <span className="font-medium" style={{ color: p.color }}>
            {p.value.toFixed(2)}×
          </span>
        </p>
      ))}
    </div>
  )
}

export default function GiroMensalChart() {
  const { data: dados = [], isLoading } = useGiroMensal()

  if (isLoading) {
    return <div className="h-[300px] rounded-lg skeleton-shimmer" />
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 11 }}
          interval={0}
          tickFormatter={v => String(v).split(' ')[0]}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          width={40}
          tickFormatter={(v: number) => v.toFixed(2)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={v => v === 'giro_reais' ? 'Giro R$' : 'Giro un.'}
        />
        <Line
          dataKey="giro_reais"
          name="giro_reais"
          stroke="#E8701A"
          strokeWidth={2}
          dot={{ r: 3, fill: '#E8701A', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          type="monotone"
        />
        <Line
          dataKey="giro_unidades"
          name="giro_unidades"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          strokeDasharray="4 2"
          type="monotone"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
