import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FornecedorCategoria } from '@/lib/supabase'

export function useFornecedorCategorias(fornecedorId?: string) {
  return useQuery({
    queryKey: ['fornecedor-categorias', fornecedorId],
    queryFn: async () => {
      if (!fornecedorId) return []
      const { data, error } = await supabase
        .from('estoque_fornecedor_categorias')
        .select('*')
        .eq('fornecedor_id', fornecedorId)
        .eq('ativo', true)
        .order('tipo_produto')
      if (error) throw error
      return (data ?? []) as FornecedorCategoria[]
    },
    enabled: !!fornecedorId,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useAllFornecedorCategorias() {
  return useQuery({
    queryKey: ['fornecedor-categorias-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_fornecedor_categorias')
        .select('*')
        .eq('ativo', true)
        .order('tipo_produto')
      if (error) throw error
      const rows = (data ?? []) as FornecedorCategoria[]
      const grouped: Record<string, FornecedorCategoria[]> = {}
      for (const row of rows) {
        if (!grouped[row.fornecedor_id]) grouped[row.fornecedor_id] = []
        grouped[row.fornecedor_id].push(row)
      }
      return grouped
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
