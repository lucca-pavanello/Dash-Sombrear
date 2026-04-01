import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CustoInterno } from '@/lib/supabase'

export function useCustosInternos() {
  return useQuery({
    queryKey: ['custos-internos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custos_internos')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CustoInterno[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
