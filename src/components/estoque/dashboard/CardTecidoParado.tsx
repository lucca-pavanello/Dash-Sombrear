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
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 dark:bg-primary/8 shadow-sm p-4 flex flex-col items-center text-center gap-2 animate-pulse">
        <div className="h-7 w-7 rounded-lg bg-primary/15" />
        <div className="h-3 w-28 bg-primary/15 rounded" />
        <div className="h-7 w-8 bg-primary/15 rounded" />
        <div className="h-3 w-32 bg-primary/15 rounded" />
      </div>
    )
  }

  const { count, valor } = data
  const critico = count > 0

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 border-primary/20 bg-primary/5 dark:bg-primary/8 shadow-sm p-4 flex flex-col items-center text-center gap-2 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="rounded-lg p-1.5 bg-primary/15 text-primary shrink-0">
        <Clock className="h-4 w-4" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/70 leading-tight">
        Parado &gt; {amarelo_max}d
      </p>
      <p className={cn('text-2xl font-bold leading-none', critico ? 'text-red-700' : 'text-foreground')}>
        {count}
      </p>
      <p className="text-xs text-muted-foreground/60">
        {critico ? formatCurrency(valor) + ' parado' : 'nenhum produto crítico'}
      </p>
    </div>
  )
}
