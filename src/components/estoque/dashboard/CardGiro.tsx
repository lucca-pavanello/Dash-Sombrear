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
      <div className="rounded-xl border border-orange-200 bg-orange-100 dark:bg-orange-950/30 dark:border-orange-900/40 shadow-sm p-6 flex flex-col gap-3 animate-pulse">
        <div className="flex items-start justify-between gap-2">
          <div className="h-3 w-20 bg-orange-200/60 dark:bg-orange-900/40 rounded" />
          <div className="h-7 w-7 rounded-lg bg-orange-200/60 dark:bg-orange-900/40" />
        </div>
        <div className="h-8 w-16 bg-orange-200/60 dark:bg-orange-900/40 rounded" />
        <div className="h-3 w-28 bg-orange-200/60 dark:bg-orange-900/40 rounded" />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-orange-200 bg-orange-100 dark:bg-orange-950/30 dark:border-orange-900/40 shadow-sm p-6 flex flex-col gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300 leading-tight">
          Giro anual
        </p>
        <div className="rounded-lg p-1.5 bg-orange-200/50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 shrink-0">
          <RefreshCw className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-semibold leading-none text-orange-900 dark:text-orange-100">
        {fmtNum(data.giro_reais)}
        <span className="text-sm font-normal text-orange-600/80 dark:text-orange-400/70 ml-1">×</span>
      </p>
      <p className="text-xs text-orange-600/80 dark:text-orange-400/70">
        {fmtBRL(data.estoque_atual_reais)} em estoque
      </p>
    </div>
  )
}
