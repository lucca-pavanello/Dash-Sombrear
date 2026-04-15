import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueLocalizacao } from '@/lib/supabase'

export function useEstoqueLocalizacoes({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: ['estoque-localizacoes', includeInactive],
    queryFn: async () => {
      let q = supabase
        .from('estoque_localizacoes')
        .select('*, estoque_produtos!localizacao_id(count)')
        .order('codigo')
      if (!includeInactive) q = q.eq('ativo', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as EstoqueLocalizacao[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

type LocalizacaoPayload = Omit<EstoqueLocalizacao, 'id' | 'created_at' | 'updated_at' | 'estoque_produtos'>

export function useAddLocalizacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: LocalizacaoPayload) => {
      const { data, error } = await supabase
        .from('estoque_localizacoes')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as EstoqueLocalizacao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-localizacoes'] }),
  })
}

export function useUpdateLocalizacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<LocalizacaoPayload> & { id: string }) => {
      const { data, error } = await supabase
        .from('estoque_localizacoes')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as EstoqueLocalizacao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-localizacoes'] }),
  })
}
