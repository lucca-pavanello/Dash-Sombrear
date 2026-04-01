import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Orcamento } from '@/lib/supabase'

export function useToggleShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .update({ share_enabled: enabled })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Orcamento
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

export function useOrcamentoPublico(id: string | undefined) {
  return useQuery({
    queryKey: ['orcamento-publico', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não informado')
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('id', id)
        .eq('share_enabled', true)
        .single()
      if (error) throw error
      return data as Orcamento
    },
    enabled: !!id,
    retry: false,
  })
}
