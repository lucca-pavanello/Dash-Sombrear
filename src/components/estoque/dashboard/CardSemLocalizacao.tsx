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
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border-2 border-primary/50 bg-primary/5 shadow-sm px-4 py-3 flex items-center gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <MapPinOff className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          Sem localização
        </p>
        <p className={cn('text-xl font-bold leading-tight', hasAlert ? 'text-destructive' : 'text-foreground')}>
          {isLoading ? '…' : (count ?? 0)}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {hasAlert ? 'sem local definido' : 'todos localizados'}
        </p>
      </div>
    </div>
  )
}
