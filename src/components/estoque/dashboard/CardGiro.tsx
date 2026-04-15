import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface Props {
  onClick?: () => void
}

const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function CardGiro({ onClick }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['estoque-giro-anual'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('estoque_calcular_giro')
      if (error) throw error
      return (data?.[0] ?? null) as {
        giro_reais: number
        estoque_atual_reais: number
      } | null
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border-2 border-primary/35 bg-primary/10 dark:bg-primary/15 shadow-sm p-4 flex flex-col gap-3 animate-pulse">
        <div className="flex items-start justify-between gap-2">
          <div className="h-3 w-20 bg-primary/20 rounded" />
          <div className="h-7 w-7 rounded-lg bg-primary/20" />
        </div>
        <div className="h-7 w-16 bg-primary/20 rounded" />
        <div className="h-3 w-28 bg-primary/20 rounded" />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 border-primary/35 bg-primary/10 dark:bg-primary/15 shadow-sm p-4 flex flex-col gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/70 leading-tight">
          Giro anual
        </p>
        <div className="rounded-lg p-1.5 bg-primary/15 text-primary shrink-0">
          <RefreshCw className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold leading-none text-foreground">
        {fmtNum(data.giro_reais)}
        <span className="text-sm font-normal text-muted-foreground/60 ml-1">×</span>
      </p>
      <p className="text-xs text-muted-foreground/60">
        {fmtBRL(data.estoque_atual_reais)} em estoque
      </p>
    </div>
  )
}
