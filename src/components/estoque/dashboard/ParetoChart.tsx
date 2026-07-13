import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts'
import type { ParetoItem } from '@/hooks/useEstoqueAnalytics'
import { useChartColors } from '../shared/useChartColors'

const CLASS_COLOR: Record<string, string> = {
  A:         'hsl(var(--primary))',  // laranja Sombrear
  B:         '#fdba74',  // orange-300
  C:         '#ffedd5',  // orange-100
  sem_dados: '#e5e7eb',  // gray-200
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function truncate(s: string, max = 10) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { payload: ParetoItem }[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-card px-3 py-2.5 shadow-md text-xs space-y-1 max-w-[200px]">
      <p className="font-semibold text-sm leading-tight text-gray-900 dark:text-foreground">{d.nome}</p>
      <p className="text-gray-500 dark:text-muted-foreground">SKU: {d.codigo}</p>
      <hr className="border-gray-100 dark:border-border" />
      <p>
        <span className="text-gray-500 dark:text-muted-foreground">Valor vendido: </span>
        <span className="font-medium">{fmtBRL(d.valor_total)}</span>
      </p>
      <p>
        <span className="text-gray-500 dark:text-muted-foreground">% individual: </span>
        <span className="font-medium text-orange-700 dark:text-orange-400">{d.percentual_individual.toFixed(1)}%</span>
      </p>
      <p>
        <span className="text-gray-500 dark:text-muted-foreground">% acumulado: </span>
        <span className="font-medium text-gray-700 dark:text-foreground/80">{d.percentual_acumulado.toFixed(1)}%</span>
      </p>
      <div className="flex items-center gap-1.5 pt-0.5">
        <div
          className="h-2.5 w-2.5 rounded-sm shrink-0"
          style={{ background: CLASS_COLOR[d.classificacao_abc ?? 'sem_dados'] }}
        />
        <span className="text-gray-500 dark:text-muted-foreground">
          Classe {d.classificacao_abc ?? 'sem dados'}
        </span>
      </div>
    </div>
  )
}

interface Props {
  items: ParetoItem[]
  isLoading: boolean
}

export default function ParetoChart({ items, isLoading }: Props) {
  const chartColors = useChartColors()

  if (isLoading) {
    return <div className="h-64 sm:h-[400px] rounded-lg skeleton-shimmer" />
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 sm:h-[400px] text-center px-6">
        <p className="text-sm font-medium text-muted-foreground">
          Ainda não há vendas suficientes para calcular a Curva ABC.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Registre pelo menos 5 vendas e clique em "Recalcular Curva ABC".
        </p>
      </div>
    )
  }

  return (
    <div className="h-64 sm:h-[400px]">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={items} margin={{ top: 8, right: 48, left: 8, bottom: 70 }}>
        <XAxis
          dataKey="codigo"
          tick={{ fontSize: 10 }}
          angle={-45}
          textAnchor="end"
          interval={0}
          tickFormatter={(v: string) => truncate(v, 10)}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10 }}
          width={36}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          label={{ value: '% individual', angle: -90, position: 'insideLeft', fontSize: 9, fill: chartColors.axisLabel, offset: 8 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fontSize: 10 }}
          width={36}
          tickFormatter={(v: number) => `${v}%`}
          label={{ value: '% acumulado', angle: 90, position: 'insideRight', fontSize: 9, fill: chartColors.lineDark, offset: 8 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="top"
          height={28}
          formatter={(value) => (value === 'percentual_individual' ? '% individual (barras)' : '% acumulado (linha)')}
          wrapperStyle={{ fontSize: 11 }}
        />
        <Bar yAxisId="left" dataKey="percentual_individual" maxBarSize={32} radius={[3, 3, 0, 0]}>
          {items.map((entry, i) => (
            <Cell key={i} fill={CLASS_COLOR[entry.classificacao_abc ?? 'sem_dados']} />
          ))}
        </Bar>
        <Line
          yAxisId="right"
          dataKey="percentual_acumulado"
          type="monotone"
          stroke={chartColors.lineDark}
          strokeWidth={2}
          dot={{ r: 3, fill: chartColors.lineDark, stroke: 'white', strokeWidth: 1 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  )
}
