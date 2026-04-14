import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import { RefreshCw } from 'lucide-react'
import { useCurvaAbc, useRecalcularAbc } from '@/hooks/useEstoqueAnalytics'
import type { ToastType } from '@/hooks/useToast'

const ABC_COLOR: Record<string, string> = {
  A: '#E8701A',
  B: '#F59E0B',
  C: '#6B7280',
}

interface Props {
  toast: (type: ToastType, message: string) => void
}

export default function AbcCurveChart({ toast }: Props) {
  const { data: produtos = [], isLoading } = useCurvaAbc()
  const recalcular = useRecalcularAbc()

  async function handleRecalcular() {
    try {
      await recalcular.mutateAsync()
      toast('success', 'Curva ABC recalculada com sucesso.')
    } catch {
      toast('error', 'Erro ao recalcular curva ABC.')
    }
  }

  const chartData = produtos
    .slice(0, 20)
    .map((p) => ({
      nome: p.nome.length > 18 ? p.nome.slice(0, 16) + '…' : p.nome,
      nomeCompleto: p.nome,
      saidas: p.total_saidas_90d,
      classe: p.classificacao_abc ?? 'C',
    }))

  const counts = { A: 0, B: 0, C: 0 }
  for (const p of produtos) {
    if (p.classificacao_abc === 'A') counts.A++
    else if (p.classificacao_abc === 'B') counts.B++
    else if (p.classificacao_abc === 'C') counts.C++
  }

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Curva ABC — últimos 90 dias</p>
          <p className="text-xs text-muted-foreground">
            Classificação por volume de saídas
          </p>
        </div>
        <button
          onClick={handleRecalcular}
          disabled={recalcular.isPending}
          title="Recalcular classificação ABC"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${recalcular.isPending ? 'animate-spin' : ''}`} />
          Recalcular
        </button>
      </div>

      {/* Badges de resumo */}
      <div className="grid grid-cols-3 divide-x border-b">
        {(['A', 'B', 'C'] as const).map((cls) => (
          <div key={cls} className="px-4 py-2.5 text-center">
            <p className="text-lg font-bold" style={{ color: ABC_COLOR[cls] }}>
              {counts[cls]}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Classe {cls}
              {cls === 'A' && ' · top 20%'}
              {cls === 'B' && ' · mid 30%'}
              {cls === 'C' && ' · 50% rest.'}
            </p>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div className="p-4">
        {isLoading ? (
          <div className="h-52 rounded-lg skeleton-shimmer" />
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Sem dados de saídas nos últimos 90 dias
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Registre vendas e clique em "Recalcular"
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 60 }}>
              <XAxis
                dataKey="nome"
                tick={{ fontSize: 10 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} width={36} />
              <Tooltip
                formatter={(value: number, _name, props) => [
                  `${value} un`,
                  props.payload.nomeCompleto,
                ]}
                labelFormatter={() => ''}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="saidas" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={ABC_COLOR[entry.classe]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legenda de cores */}
      <div className="flex items-center justify-center gap-4 border-t px-4 py-2">
        {(['A', 'B', 'C'] as const).map((cls) => (
          <div key={cls} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ background: ABC_COLOR[cls] }} />
            <span className="text-[11px] text-muted-foreground">Classe {cls}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
