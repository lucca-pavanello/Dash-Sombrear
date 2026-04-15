import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PerformanceFornecedor {
  id: string
  nome: string
  lead_time_medio_dias: number | null
  total_entradas: number
  valor_total_comprado: number
  custo_unitario_medio: number
  produtos_fornecidos: number
}

export interface PerformanceCategoria {
  categoria: string | null
  total_produtos: number
  valor_em_estoque: number | null
  unidades_vendidas_90d: number
  valor_vendido_90d: number
  ticket_medio: number
}

export interface PerformanceLocalizacao {
  id: string
  codigo: string
  setor: string | null
  nivel_acesso: string | null
  total_produtos: number
  valor_em_estoque: number | null
  valor_vendido_90d: number
  unidades_vendidas_90d: number
}

export interface SazonalidadeMes {
  mes: string
  mes_nome: string
  mes_numero: number
  ano: number
  total_vendas: number
  faturamento: number
  unidades_vendidas: number
  ticket_medio: number
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useEstoquePerformanceFornecedor() {
  return useQuery({
    queryKey: ['estoque-performance-fornecedor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_vw_performance_fornecedor')
        .select('*')
      if (error) throw error
      return (data ?? []) as PerformanceFornecedor[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useEstoquePerformanceCategoria() {
  return useQuery({
    queryKey: ['estoque-performance-categoria'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_vw_performance_categoria')
        .select('*')
      if (error) throw error
      return (data ?? []) as PerformanceCategoria[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useEstoquePerformanceLocalizacao() {
  return useQuery({
    queryKey: ['estoque-performance-localizacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_vw_performance_localizacao')
        .select('*')
      if (error) throw error
      return (data ?? []) as PerformanceLocalizacao[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useEstoqueSazonalidade() {
  return useQuery({
    queryKey: ['estoque-sazonalidade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_vw_sazonalidade')
        .select('*')
      if (error) throw error
      return (data ?? []) as SazonalidadeMes[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
