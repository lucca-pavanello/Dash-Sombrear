import { useQuery } from '@tanstack/react-query'
import { MapPinOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface Props {
  onClick?: () => void
}

export default function CardSemLocalizacao({ onClick }: Props) {
  const { data: count = null, isLoading } = useQuery({
    queryKey: ['estoque-produtos-sem-localizacao-count'],
    queryFn: async () => {
      const { count: c, error } = await supabase
        .from('estoque_produtos')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true)
        .is('localizacao_id', null)
      if (error) throw error
      return c ?? 0
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const hasAlert = count !== null && count > 0

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'rounded-xl border-2 border-l-4 bg-card shadow-sm px-4 py-3 flex items-center gap-3 w-full text-left transition-colors',
        hasAlert
          ? 'border-l-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
          : 'border-l-border',
        !onClick && 'cursor-default',
      )}
    >
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        hasAlert ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted/60',
      )}>
        <MapPinOff className={cn(
          'h-4 w-4',
          hasAlert ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
        )} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          Sem localização
        </p>
        <p className={cn(
          'text-xl font-bold leading-tight',
          hasAlert ? 'text-amber-600 dark:text-amber-400' : '',
        )}>
          {isLoading ? '…' : (count ?? 0)}
        </p>
        {hasAlert && (
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 truncate">
            produtos sem local definido
          </p>
        )}
      </div>
    </button>
  )
}
