import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueFornecedor } from '@/lib/supabase'

export function useEstoqueFornecedores({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: ['estoque-fornecedores', includeInactive],
    queryFn: async () => {
      let q = supabase.from('estoque_fornecedores').select('*').order('nome')
      if (!includeInactive) q = q.eq('ativo', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as EstoqueFornecedor[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

type FornecedorPayload = Omit<EstoqueFornecedor, 'id' | 'created_at'>

export function useAddFornecedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: FornecedorPayload) => {
      const { data, error } = await supabase
        .from('estoque_fornecedores')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as EstoqueFornecedor
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-fornecedores'] }),
  })
}

export function useUpdateFornecedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<FornecedorPayload> & { id: string }) => {
      const { data, error } = await supabase
        .from('estoque_fornecedores')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as EstoqueFornecedor
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-fornecedores'] }),
  })
}
