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
        'rounded-xl border border-orange-100 bg-orange-50 dark:bg-orange-950/15 dark:border-orange-900/25 shadow-sm p-6 flex flex-col gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400 leading-tight">
          Sem localização
        </p>
        <div className="rounded-lg p-1.5 bg-orange-100/50 dark:bg-orange-950/20 text-orange-300 dark:text-orange-600 shrink-0">
          <MapPinOff className="h-4 w-4" />
        </div>
      </div>
      <p className={cn('text-3xl font-semibold leading-none', hasAlert ? 'text-red-700' : 'text-gray-900 dark:text-gray-100')}>
        {isLoading ? '…' : (count ?? 0)}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {hasAlert ? 'sem local definido' : 'todos localizados'}
      </p>
    </div>
  )
}
