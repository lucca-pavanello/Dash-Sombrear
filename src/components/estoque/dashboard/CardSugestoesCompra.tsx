import { useQuery } from '@tanstack/react-query'
import { ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onClick?: () => void
}

// ─── Componente ───────────────────────────────────────────────────────────────

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

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="rounded-xl border-2 border-l-4 border-l-muted bg-card shadow-sm px-4 py-3 animate-pulse">
        <div className="h-3 w-32 bg-muted rounded mb-2" />
        <div className="h-7 w-8 bg-muted rounded mb-1.5" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    )
  }

  const temCritico = criticos > 0

  return (
    <div
      onClick={onClick}
      className={[
        'rounded-xl border-2 border-l-4 bg-card shadow-sm px-4 py-3 flex items-center gap-3',
        'transition-shadow',
        onClick ? 'cursor-pointer hover:shadow-md' : '',
        temCritico
          ? 'border-l-red-500 bg-red-50/40 dark:bg-red-900/10'
          : 'border-l-amber-500',
      ].join(' ')}
    >
      {/* Ícone */}
      <div
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          temCritico
            ? 'bg-red-100 dark:bg-red-900/30'
            : 'bg-amber-100 dark:bg-amber-900/30',
        ].join(' ')}
      >
        <ShoppingBag
          className={[
            'h-4 w-4',
            temCritico
              ? 'text-red-600 dark:text-red-400'
              : 'text-amber-600 dark:text-amber-400',
          ].join(' ')}
        />
      </div>

      {/* Conteúdo */}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          Sugestões de compra
        </p>
        <p
          className={[
            'text-xl font-bold leading-tight',
            temCritico
              ? 'text-red-600 dark:text-red-400'
              : 'text-amber-600 dark:text-amber-400',
          ].join(' ')}
        >
          {totalNaoOk}
        </p>
        <p
          className={[
            'text-[10px] truncate',
            temCritico ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
          ].join(' ')}
        >
          {criticos} crítico(s)
        </p>
      </div>
    </div>
  )
}
