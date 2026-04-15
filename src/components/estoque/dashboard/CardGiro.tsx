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
      <div className="rounded-xl border-2 border-primary/25 bg-primary/5 shadow-sm px-4 py-3 animate-pulse">
        <div className="h-3 w-24 bg-muted rounded mb-2" />
        <div className="h-7 w-20 bg-muted rounded mb-1.5" />
        <div className="h-3 w-32 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 border-primary/25 bg-primary/5 shadow-sm px-4 py-3 flex items-center gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          Giro anual
        </p>
        <p className="text-xl font-bold leading-tight text-foreground">
          {fmtNum(data.giro_reais)}
          <span className="text-sm font-normal text-muted-foreground ml-1">×</span>
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {fmtBRL(data.estoque_atual_reais)} em estoque
        </p>
      </div>
    </div>
  )
}
