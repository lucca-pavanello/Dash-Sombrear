import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type LeadTimeRow = {
  produto_id:           string
  codigo:               string | null
  nome:                 string
  quantidade_atual:     number
  classificacao_abc:    'A' | 'B' | 'C' | 'sem_dados' | null
  tipo:                 'tecido' | 'acessorio' | 'ferragem' | 'outro' | null
  data_lote_mais_antigo: string | null
  dias_em_estoque:      number | null
  quantidade_parada:    number | null
  valor_parado_reais:   number | null
}

export type LeadTimeConfig = {
  verde_max:  number
  amarelo_max: number
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useLeadTimeRows() {
  return useQuery({
    queryKey: ['estoque-lead-time'],
    queryFn: async (): Promise<LeadTimeRow[]> => {
      const { data, error } = await supabase
        .from('estoque_vw_lead_time')
        .select('*')
        .order('dias_em_estoque', { ascending: false, nullsFirst: false })

      if (error) throw error
      return (data ?? []) as LeadTimeRow[]
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useLeadTimeConfig() {
  return useQuery({
    queryKey: ['estoque-lead-time-config'],
    queryFn: async (): Promise<LeadTimeConfig> => {
      const { data, error } = await supabase
        .from('estoque_config')
        .select('chave, valor')
        .in('chave', ['lead_time_verde_max_dias', 'lead_time_amarelo_max_dias'])

      if (error) throw error

      const map = Object.fromEntries((data ?? []).map((r: any) => [r.chave, Number(r.valor)]))
      return {
        verde_max:  map['lead_time_verde_max_dias']   ?? 90,
        amarelo_max: map['lead_time_amarelo_max_dias'] ?? 180,
      }
    },
    staleTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
