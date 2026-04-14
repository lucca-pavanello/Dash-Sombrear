import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueSugestaoMover } from '@/lib/supabase'

export function useEstoqueSugestoesMover() {
  return useQuery({
    queryKey: ['estoque-sugestoes-mover'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_vw_sugestao_movimentacao')
        .select('*')
        .order('classe_abc')
      if (error) throw error
      return (data ?? []) as EstoqueSugestaoMover[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useTotalProdutosAnalisados() {
  return useQuery({
    queryKey: ['estoque-produtos-analisados-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('estoque_produtos')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true)
        .not('localizacao_id', 'is', null)
        .not('classificacao_abc', 'is', null)
        .neq('classificacao_abc', 'sem_dados')
      if (error) throw error
      return count ?? 0
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useMoverProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ produto_id, localizacao_id }: { produto_id: string; localizacao_id: string }) => {
      const { error } = await supabase
        .from('estoque_produtos')
        .update({ localizacao_id })
        .eq('id', produto_id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-sugestoes-mover'] })
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      qc.invalidateQueries({ queryKey: ['estoque-produtos-analisados-count'] })
    },
  })
}
