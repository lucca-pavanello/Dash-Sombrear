import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CoberturaMargemRow } from '@/lib/supabase'

export function useMargemEstoque() {
  return useQuery({
    queryKey: ['estoque-cobertura-margem', 'margem'],
    queryFn: async (): Promise<CoberturaMargemRow[]> => {
      const { data, error } = await supabase
        .from('estoque_vw_cobertura_margem')
        .select('*')
        .order('margem_percentual', { ascending: false, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as CoberturaMargemRow[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
