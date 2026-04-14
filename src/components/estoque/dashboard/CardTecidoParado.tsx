import { useQuery } from '@tanstack/react-query'
import { AlertOctagon, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useEstoqueConfig } from '@/hooks/useEstoqueConfig'
import { formatCurrency } from '@/lib/utils'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onClick?: () => void
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CardTecidoParado({ onClick }: Props) {
  const { data: configMap } = useEstoqueConfig()
  const amarelo_max = parseInt(configMap?.['lead_time_amarelo_max_dias'] ?? '180', 10)

  const { data, isLoading } = useQuery({
    queryKey: ['estoque-card-tecido-parado', amarelo_max],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('estoque_vw_lead_time')
        .select('valor_parado_reais')
        .gt('dias_em_estoque', amarelo_max)

      if (error) throw error

      return {
        count: (rows ?? []).length,
        valor: (rows ?? []).reduce(
          (s, r) => s + Number(r.valor_parado_reais ?? 0),
          0
        ),
      }
    },
    enabled: !!configMap,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  // ── Loading skeleton ──
  if (isLoading || !data) {
    return (
      <div className="rounded-xl border-2 border-l-4 border-l-muted bg-card shadow-sm px-4 py-3 animate-pulse">
        <div className="h-3 w-36 bg-muted rounded mb-2" />
        <div className="h-7 w-12 bg-muted rounded mb-1.5" />
        <div className="h-3 w-28 bg-muted rounded" />
      </div>
    )
  }

  const { count, valor } = data
  const critico = count > 0

  return (
    <div
      onClick={onClick}
      className={[
        'rounded-xl border-2 border-l-4 bg-card shadow-sm px-4 py-3 flex items-center gap-3',
        'transition-shadow',
        onClick ? 'cursor-pointer hover:shadow-md' : '',
        critico
          ? 'border-l-red-500 bg-red-50/40 dark:bg-red-900/10'
          : 'border-l-emerald-500',
      ].join(' ')}
    >
      {/* Ícone */}
      <div
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          critico
            ? 'bg-red-100 dark:bg-red-900/30'
            : 'bg-emerald-100 dark:bg-emerald-900/30',
        ].join(' ')}
      >
        {critico ? (
          <AlertOctagon className="h-4 w-4 text-red-600 dark:text-red-400" />
        ) : (
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>

      {/* Conteúdo */}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          Tecido parado &gt; {amarelo_max} dias
        </p>
        <p
          className={[
            'text-xl font-bold leading-tight',
            critico
              ? 'text-red-600 dark:text-red-400'
              : 'text-emerald-600 dark:text-emerald-400',
          ].join(' ')}
        >
          {critico ? count : 'Tudo ok'}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {critico
            ? `Valor parado: ${formatCurrency(valor)}`
            : 'Nenhum produto crítico'}
        </p>
      </div>
    </div>
  )
}
