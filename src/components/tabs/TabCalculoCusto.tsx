import type { Orcamento } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Calculator, TrendingDown, Calendar, BarChart2, AlertCircle } from 'lucide-react'
import SkeletonCard from '@/components/shared/SkeletonCard'
import { filterByPeriod } from '@/hooks/usePeriodFilter'

interface Props {
  data: Orcamento[]
  isLoading?: boolean
  error?: boolean
}

export default function TabCalculoCusto({ data, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="rounded-xl border bg-card shadow-sm animate-pulse">
          <div className="border-b px-5 py-4"><div className="h-5 w-48 rounded bg-muted" /></div>
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded bg-muted" />)}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-8 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        <p className="text-sm font-medium text-destructive">Erro ao carregar dados de custo. Tente recarregar a página.</p>
      </div>
    )
  }
  const comCusto = data.filter((o) => o.custo_tecido != null && o.custo_tecido > 0)

  const hoje = new Date()

  const comCustoMes = filterByPeriod(comCusto, 'mes')
  const totalMes = comCustoMes.reduce((s, o) => s + (o.custo_tecido ?? 0), 0)

  const usosSemana = filterByPeriod(comCusto, 'semana').length

  const diasDecorridos = hoje.getDate()
  const mediaDiaria = diasDecorridos > 0 ? totalMes / diasDecorridos : 0

  const custoPorModelo = comCusto.reduce<Record<string, { total: number; count: number }>>((acc, o) => {
    const k = o.modelo
    if (!acc[k]) acc[k] = { total: 0, count: 0 }
    acc[k].total += o.custo_tecido ?? 0
    acc[k].count += 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total no Mês', value: formatCurrency(totalMes), icon: TrendingDown, highlight: true },
          { label: 'Usos na Semana', value: usosSemana, icon: Calendar, highlight: false },
          { label: `Média Diária (${diasDecorridos}d)`, value: formatCurrency(mediaDiaria), icon: BarChart2, highlight: false },
        ].map(({ label, value, icon: Icon, highlight }) => (
          <div
            key={label}
            className={`rounded-xl border p-4 shadow-sm ${highlight ? 'border-primary/30 bg-primary/5' : 'bg-card'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-display mt-1 text-xl font-bold">{value}</p>
              </div>
              <div className={`shrink-0 rounded-lg p-1.5 ${highlight ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Custo por modelo */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Calculator className="h-4 w-4 text-primary" />
          <div>
            <h2 className="font-display text-base font-semibold">Custo por Modelo</h2>
            <p className="text-xs text-muted-foreground">Acumulado total</p>
          </div>
        </div>
        {Object.keys(custoPorModelo).length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum orçamento com custo registrado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Modelo</th>
                  <th className="px-5 py-3 text-center font-medium text-muted-foreground">Qtd. Orçamentos</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Custo Total</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Custo Médio</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(custoPorModelo).map(([modelo, { total, count }]) => (
                  <tr key={modelo} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium">{modelo}</td>
                    <td className="px-5 py-3.5 text-center">{count}</td>
                    <td className="px-5 py-3.5 text-right">{formatCurrency(total)}</td>
                    <td className="px-5 py-3.5 text-right">{formatCurrency(total / count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
