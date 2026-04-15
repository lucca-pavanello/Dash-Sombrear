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
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 animate-pulse flex flex-col gap-2">
        <div className="flex justify-between"><div className="h-2.5 w-28 bg-muted/60 rounded" /><div className="h-8 w-8 rounded-full bg-muted/60" /></div>
        <div className="h-7 w-10 bg-muted/60 rounded" />
        <div className="h-2.5 w-24 bg-muted/60 rounded" />
      </div>
    )
  }

  const { count, valor } = data
  const critico = count > 0

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 flex flex-col gap-2 transition-all',
        onClick && 'cursor-pointer hover:border-primary/40 hover:shadow-sm hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 leading-tight">
          Parado &gt; {amarelo_max}d
        </p>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Clock className="h-4 w-4 text-primary/70" />
        </div>
      </div>
      <p className={cn('text-2xl font-bold leading-none', critico ? 'text-destructive' : 'text-foreground')}>
        {count}
      </p>
      <p className="text-xs text-muted-foreground">
        {critico ? formatCurrency(valor) + ' parado' : 'nenhum produto crítico'}
      </p>
    </div>
  )
}
