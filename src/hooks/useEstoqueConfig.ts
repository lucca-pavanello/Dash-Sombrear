import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ConfigMap = Record<string, string>

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useEstoqueConfig() {
  return useQuery({
    queryKey: ['estoque-config'],
    queryFn: async (): Promise<ConfigMap> => {
      const { data, error } = await supabase
        .from('estoque_config')
        .select('chave, valor')

      if (error) throw error
      return Object.fromEntries((data ?? []).map((r: any) => [r.chave, r.valor]))
    },
    staleTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useSalvarConfig() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (rows: { chave: string; valor: string }[]) => {
      const { error } = await supabase
        .from('estoque_config')
        .upsert(rows, { onConflict: 'chave' })

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-config'] })
      qc.invalidateQueries({ queryKey: ['estoque-lead-time-config'] })
    },
  })
}
