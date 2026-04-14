import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SugestaoCompra } from '@/lib/supabase'

export function useSugestaoCompra() {
  return useQuery({
    queryKey: ['estoque-sugestoes-compra'],
    queryFn: async (): Promise<SugestaoCompra[]> => {
      const { data, error } = await supabase
        .from('estoque_vw_sugestao_compra')
        .select('*')
      if (error) throw error
      return (data ?? []) as SugestaoCompra[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
