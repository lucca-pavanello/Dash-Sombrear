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
        'rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 flex flex-col gap-2 transition-all',
        onClick && 'cursor-pointer hover:border-primary/40 hover:shadow-sm hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 leading-tight">
          Sem localização
        </p>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MapPinOff className="h-4 w-4 text-primary/70" />
        </div>
      </div>
      <p className={cn('text-2xl font-bold leading-none', hasAlert ? 'text-destructive' : 'text-foreground')}>
        {isLoading ? '…' : (count ?? 0)}
      </p>
      <p className="text-xs text-muted-foreground">
        {hasAlert ? 'sem local definido' : 'todos localizados'}
      </p>
    </div>
  )
}
