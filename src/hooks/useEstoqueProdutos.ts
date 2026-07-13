import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueProduto, EstoqueProdutoAlerta } from '@/lib/supabase'

export function useEstoqueProdutos({ includeInactive = false }: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ['estoque-produtos', { includeInactive }],
    queryFn: async () => {
      let q = supabase
        .from('estoque_produtos')
        .select('*, estoque_categorias(nome, tipo)')
        .order('nome')
      if (!includeInactive) q = q.eq('ativo', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as EstoqueProduto[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useEstoqueProdutosAlerta({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['estoque-produtos-alerta'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_produtos_alerta')
        .select('*')
        .order('nome')
      if (error) throw error
      return (data ?? []) as EstoqueProdutoAlerta[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

type CreatePayload = Omit<EstoqueProduto, 'id' | 'created_at' | 'updated_at' | 'estoque_categorias'>

export function useCreateEstoqueProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const { data, error } = await supabase
        .from('estoque_produtos')
        .insert(payload)
        .select('*, estoque_categorias(nome, tipo)')
        .single()
      if (error) throw error
      return data as EstoqueProduto
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      qc.invalidateQueries({ queryKey: ['estoque-produtos-alerta'] })
    },
  })
}

type UpdatePayload = Partial<CreatePayload> & { id: string }

export function useUpdateEstoqueProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdatePayload) => {
      const { data, error } = await supabase
        .from('estoque_produtos')
        .update(payload)
        .eq('id', id)
        .select('*, estoque_categorias(nome, tipo)')
        .single()
      if (error) throw error
      return data as EstoqueProduto
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      qc.invalidateQueries({ queryKey: ['estoque-produtos-alerta'] })
    },
  })
}

export function useDeactivateEstoqueProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('estoque_produtos')
        .update({ ativo: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      qc.invalidateQueries({ queryKey: ['estoque-produtos-alerta'] })
    },
  })
}
