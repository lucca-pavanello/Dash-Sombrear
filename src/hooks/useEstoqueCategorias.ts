import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueCategoria } from '@/lib/supabase'

export function useEstoqueCategorias() {
  return useQuery({
    queryKey: ['estoque-categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_categorias')
        .select('*')
        .order('nome')
      if (error) throw error
      return (data ?? []) as EstoqueCategoria[]
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
