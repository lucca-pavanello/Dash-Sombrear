import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CapitalTravadoResult } from '@/lib/supabase'

export function useCapitalTravado(diasMinimos = 90) {
  return useQuery({
    queryKey: ['estoque-capital-travado', diasMinimos],
    queryFn: async (): Promise<CapitalTravadoResult | null> => {
      const { data, error } = await supabase
        .rpc('estoque_fn_capital_travado', { p_dias_minimos: diasMinimos })
      if (error) throw error
      const row = (data as CapitalTravadoResult[] | null)?.[0] ?? null
      if (!row) return null
      return {
        total_produtos: Number(row.total_produtos),
        total_capital_reais: Number(row.total_capital_reais),
        por_classe: row.por_classe ?? null,
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
