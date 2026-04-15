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
      <div className="rounded-xl border-2 border-primary/35 bg-primary/10 dark:bg-primary/15 shadow-sm p-4 flex flex-col items-center text-center gap-2 animate-pulse">
        <div className="h-7 w-7 rounded-lg bg-primary/20" />
        <div className="h-3 w-32 bg-primary/20 rounded" />
        <div className="h-7 w-8 bg-primary/20 rounded" />
        <div className="h-3 w-20 bg-primary/20 rounded" />
      </div>
    )
  }

  const temCriticos = criticos > 0

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 border-primary/35 bg-primary/10 dark:bg-primary/15 shadow-sm p-4 flex flex-col items-center text-center gap-2 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="rounded-lg p-1.5 bg-primary/15 text-primary shrink-0">
        <ShoppingCart className="h-4 w-4" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/70 leading-tight">
        Sugestões de compra
      </p>
      <p className={cn('text-2xl font-bold leading-none', temCriticos ? 'text-red-700' : 'text-foreground')}>
        {totalNaoOk}
      </p>
      <p className="text-xs text-muted-foreground/60">
        {temCriticos
          ? `${criticos} crítico${criticos !== 1 ? 's' : ''}`
          : 'nenhum crítico'}
      </p>
    </div>
  )
}
