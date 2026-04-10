import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CustoInterno } from '@/lib/supabase'

type Payload = Omit<CustoInterno, 'id' | 'created_at'>

export function useAddCustoInterno() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Payload) => {
      const { data, error } = await supabase.from('custos_internos').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-internos'] })
    },
  })
}
