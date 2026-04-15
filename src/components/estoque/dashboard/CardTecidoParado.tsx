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
      <div className="rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-3 animate-pulse">
        <div className="flex items-start justify-between gap-2">
          <div className="h-3 w-28 bg-muted rounded" />
          <div className="h-7 w-7 rounded-lg bg-muted" />
        </div>
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="h-3 w-32 bg-muted rounded" />
      </div>
    )
  }

  const { count, valor } = data
  const critico = count > 0

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
          Parado &gt; {amarelo_max}d
        </p>
        <div className="rounded-lg p-1.5 bg-muted/50 text-muted-foreground shrink-0">
          <Clock className="h-4 w-4" />
        </div>
      </div>
      <p className={cn('text-3xl font-semibold leading-none', critico ? 'text-red-700' : 'text-foreground')}>
        {count}
      </p>
      <p className="text-xs text-muted-foreground">
        {critico ? formatCurrency(valor) + ' parado' : 'nenhum produto crítico'}
      </p>
    </div>
  )
}
