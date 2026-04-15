import { useQuery } from '@tanstack/react-query'
import { ShoppingBag } from 'lucide-react'
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
      <div className="rounded-xl border-2 border-primary/50 bg-primary/5 shadow-sm px-4 py-3 animate-pulse">
        <div className="h-3 w-32 bg-muted rounded mb-2" />
        <div className="h-7 w-8 bg-muted rounded mb-1.5" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 border-primary/50 bg-primary/5 shadow-sm px-4 py-3 flex items-center gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          Sugestões de compra
        </p>
        <p className="text-xl font-bold leading-tight text-foreground">
          {totalNaoOk}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {criticos} crítico{criticos !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}
