import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FornecedorDescontoCombo } from '@/lib/supabase'

export function useFornecedorDescontos(fornecedorId?: string) {
  return useQuery({
    queryKey: ['fornecedor-descontos', fornecedorId],
    queryFn: async () => {
      if (!fornecedorId) return []
      const { data, error } = await supabase
        .from('estoque_fornecedor_descontos_combo')
        .select('*')
        .eq('fornecedor_id', fornecedorId)
        .eq('ativo', true)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as FornecedorDescontoCombo[]
    },
    enabled: !!fornecedorId,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useAllFornecedorDescontos() {
  return useQuery({
    queryKey: ['fornecedor-descontos-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_fornecedor_descontos_combo')
        .select('*')
        .eq('ativo', true)
      if (error) throw error
      const rows = (data ?? []) as FornecedorDescontoCombo[]
      const grouped: Record<string, FornecedorDescontoCombo[]> = {}
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
