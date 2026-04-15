import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ROIEstoqueResult } from '@/lib/supabase'

export function useROIEstoque() {
  return useQuery({
    queryKey: ['estoque-roi-estoque'],
    queryFn: async (): Promise<ROIEstoqueResult | null> => {
      const { data, error } = await supabase.rpc('estoque_fn_roi_estoque')
      if (error) throw error
      const row = (data as ROIEstoqueResult[] | null)?.[0] ?? null
      if (!row) return null
      return {
        lucro_bruto_90d: Number(row.lucro_bruto_90d),
        lucro_bruto_anualizado: Number(row.lucro_bruto_anualizado),
        valor_estoque_atual: Number(row.valor_estoque_atual),
        roi_percentual: Number(row.roi_percentual),
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
