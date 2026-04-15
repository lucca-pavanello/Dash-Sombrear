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
      <div className="rounded-xl border-2 border-primary/25 bg-primary/5 shadow-sm px-4 py-3 animate-pulse">
        <div className="h-3 w-36 bg-muted rounded mb-2" />
        <div className="h-7 w-12 bg-muted rounded mb-1.5" />
        <div className="h-3 w-28 bg-muted rounded" />
      </div>
    )
  }

  const { count, valor } = data
  const critico = count > 0

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 border-primary/25 bg-primary/5 shadow-sm px-4 py-3 flex items-center gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <Clock className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          Parado &gt; {amarelo_max}d
        </p>
        <p className={cn('text-xl font-bold leading-tight', critico ? 'text-destructive' : 'text-foreground')}>
          {critico ? count : '0'}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {critico ? formatCurrency(valor) + ' parado' : 'nenhum produto crítico'}
        </p>
      </div>
    </div>
  )
}
