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
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 animate-pulse flex flex-col gap-2">
        <div className="flex justify-between"><div className="h-2.5 w-20 bg-muted/60 rounded" /><div className="h-8 w-8 rounded-full bg-muted/60" /></div>
        <div className="h-7 w-16 bg-muted/60 rounded" />
        <div className="h-2.5 w-28 bg-muted/60 rounded" />
      </div>
    )
  }

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
          Giro anual
        </p>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <RefreshCw className="h-4 w-4 text-primary/70" />
        </div>
      </div>
      <p className="text-2xl font-bold leading-none text-foreground">
        {fmtNum(data.giro_reais)}
        <span className="text-sm font-normal text-muted-foreground ml-1">×</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {fmtBRL(data.estoque_atual_reais)} em estoque
      </p>
    </div>
  )
}
