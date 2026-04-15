import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
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
  const giroR = payload.find(p => p.name === 'giro_reais')
  const giroU = payload.find(p => p.name === 'giro_unidades')
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-md text-xs space-y-1.5 min-w-[160px]">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <hr className="border-gray-100" />
      {giroR && (
        <p>
          <span className="text-gray-500">Giro R$: </span>
          <span className="font-medium text-orange-700">{giroR.value.toFixed(2)}×</span>
        </p>
      )}
      {giroU && (
        <p>
          <span className="text-gray-500">Giro un.: </span>
          <span className="font-medium text-gray-700">{giroU.value.toFixed(2)}×</span>
        </p>
      )}
      <p>
        <span className="text-gray-500">Vendas: </span>
        <span className="text-gray-500">{fmtBRL(d?.vendas_reais ?? 0)}</span>
      </p>
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
      <ComposedChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="giroGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 11 }}
          interval={0}
          tickFormatter={(v: string) => {
            const parts = String(v).split(' ')
            if (parts.length >= 2) {
              return `${parts[0].slice(0, 3).toLowerCase()}/${parts[1].slice(2)}`
            }
            return String(v).slice(0, 6)
          }}
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
        <Area
          dataKey="giro_reais"
          name="giro_reais"
          stroke="#f97316"
          strokeWidth={2.5}
          fill="url(#giroGradient)"
          dot={{ r: 4, fill: '#f97316', stroke: 'white', strokeWidth: 1.5 }}
          activeDot={{ r: 6 }}
          type="monotone"
        />
        <Line
          dataKey="giro_unidades"
          name="giro_unidades"
          stroke="#9ca3af"
          strokeWidth={2}
          strokeDasharray="4 2"
          dot={{ r: 3, fill: '#9ca3af' }}
          activeDot={{ r: 4 }}
          type="monotone"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
