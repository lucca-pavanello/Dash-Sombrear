import { useQuery } from '@tanstack/react-query'
import { ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface Props {
  onClick?: () => void
}

export function CardSugestoesCompra({ onClick }: Props) {
  const { data: totalNaoOk = 0 } = useQuery({
    queryKey: ['estoque-sugestoes-count-nao-ok'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('estoque_vw_sugestao_compra')
        .select('*', { count: 'exact', head: true })
        .neq('urgencia', 'ok')
      if (error) throw error
      return count ?? 0
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const { data: criticos = 0, isLoading } = useQuery({
    queryKey: ['estoque-sugestoes-count-critico'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('estoque_vw_sugestao_compra')
        .select('*', { count: 'exact', head: true })
        .eq('urgencia', 'critico')
      if (error) throw error
      return count ?? 0
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-3 animate-pulse">
        <div className="flex items-start justify-between gap-2">
          <div className="h-3 w-32 bg-muted rounded" />
          <div className="h-7 w-7 rounded-lg bg-muted" />
        </div>
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    )
  }

  const temCriticos = criticos > 0

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
          Sugestões de compra
        </p>
        <div className="rounded-lg p-1.5 bg-muted/50 text-muted-foreground shrink-0">
          <ShoppingCart className="h-4 w-4" />
        </div>
      </div>
      <p className={cn('text-3xl font-semibold leading-none', temCriticos ? 'text-red-700' : 'text-primary')}>
        {totalNaoOk}
      </p>
      <p className="text-xs text-muted-foreground">
        {temCriticos
          ? `${criticos} crítico${criticos !== 1 ? 's' : ''}`
          : 'nenhum crítico'}
      </p>
    </div>
  )
}
