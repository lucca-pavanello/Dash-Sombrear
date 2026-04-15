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
        'rounded-xl border-2 border-primary/20 bg-primary/5 dark:bg-primary/8 shadow-sm p-4 flex flex-col items-center text-center gap-2 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="rounded-lg p-1.5 bg-primary/15 text-primary shrink-0">
        <MapPinOff className="h-4 w-4" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/70 leading-tight">
        Sem localização
      </p>
      <p className={cn('text-2xl font-bold leading-none', 'text-foreground')}>
        {isLoading ? '…' : (count ?? 0)}
      </p>
      <p className="text-xs text-muted-foreground/60">
        {hasAlert ? 'sem local definido' : 'todos localizados'}
      </p>
    </div>
  )
}
