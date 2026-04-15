import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useEstoqueConfig } from '@/hooks/useEstoqueConfig'
import { formatCurrency } from '@/lib/utils'

interface Props {
  onClick?: () => void
}

export function CardTecidoParado({ onClick }: Props) {
  const { data: configMap } = useEstoqueConfig()
  const amarelo_max = parseInt(configMap?.['lead_time_amarelo_max_dias'] ?? '180', 10)

  const { data, isLoading } = useQuery({
    queryKey: ['estoque-card-tecido-parado', amarelo_max],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('estoque_vw_lead_time')
        .select('valor_parado_reais')
        .gt('dias_em_estoque', amarelo_max)

      if (error) throw error

      return {
        count: (rows ?? []).length,
        valor: (rows ?? []).reduce(
          (s, r) => s + Number(r.valor_parado_reais ?? 0),
          0
        ),
      }
    },
    enabled: !!configMap,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-orange-100 bg-orange-50 dark:bg-orange-950/15 dark:border-orange-900/25 shadow-sm p-6 flex flex-col gap-3 animate-pulse">
        <div className="flex items-start justify-between gap-2">
          <div className="h-3 w-28 bg-orange-100/60 dark:bg-orange-900/30 rounded" />
          <div className="h-7 w-7 rounded-lg bg-orange-100/60 dark:bg-orange-900/30" />
        </div>
        <div className="h-8 w-8 bg-orange-100/60 dark:bg-orange-900/30 rounded" />
        <div className="h-3 w-32 bg-orange-100/60 dark:bg-orange-900/30 rounded" />
      </div>
    )
  }

  const { count, valor } = data
  const critico = count > 0

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-orange-100 bg-orange-50 dark:bg-orange-950/15 dark:border-orange-900/25 shadow-sm p-6 flex flex-col gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400 leading-tight">
          Parado &gt; {amarelo_max}d
        </p>
        <div className="rounded-lg p-1.5 bg-orange-100/50 dark:bg-orange-950/20 text-orange-300 dark:text-orange-600 shrink-0">
          <Clock className="h-4 w-4" />
        </div>
      </div>
      <p className={cn('text-3xl font-semibold leading-none', critico ? 'text-red-700' : 'text-gray-900 dark:text-gray-100')}>
        {count}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {critico ? formatCurrency(valor) + ' parado' : 'nenhum produto crítico'}
      </p>
    </div>
  )
}
