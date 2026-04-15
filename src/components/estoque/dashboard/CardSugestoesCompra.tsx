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
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 animate-pulse flex flex-col gap-2">
        <div className="flex justify-between"><div className="h-2.5 w-32 bg-muted/60 rounded" /><div className="h-8 w-8 rounded-full bg-muted/60" /></div>
        <div className="h-7 w-8 bg-muted/60 rounded" />
        <div className="h-2.5 w-20 bg-muted/60 rounded" />
      </div>
    )
  }

  const temCriticos = criticos > 0

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border px-4 py-4 flex flex-col gap-2 transition-all',
        temCriticos
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-primary/20 bg-primary/5',
        onClick && 'cursor-pointer hover:shadow-sm hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-[10px] font-semibold uppercase tracking-widest leading-tight', temCriticos ? 'text-destructive/60' : 'text-primary/60')}>
          Sugestões de compra
        </p>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', temCriticos ? 'bg-destructive/10' : 'bg-primary/10')}>
          <ShoppingBag className={cn('h-4 w-4', temCriticos ? 'text-destructive/70' : 'text-primary/70')} />
        </div>
      </div>
      <p className={cn('text-2xl font-bold leading-none', temCriticos ? 'text-destructive' : 'text-foreground')}>
        {totalNaoOk}
      </p>
      <p className="text-xs text-muted-foreground">
        {criticos} crítico{criticos !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
