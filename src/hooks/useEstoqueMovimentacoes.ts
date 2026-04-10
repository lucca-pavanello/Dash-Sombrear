import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueMovimentacao } from '@/lib/supabase'

const PAGE_SIZE = 30

export interface MovimentacaoFilters {
  produto_id?: string
  tipo?: string
  responsavel?: string
  dateFrom?: string
  dateTo?: string
  page?: number
}

export function useEstoqueMovimentacoes(filters: MovimentacaoFilters = {}) {
  const page = filters.page ?? 1
  const offset = (page - 1) * PAGE_SIZE

  return useQuery({
    queryKey: ['estoque-movimentacoes', filters],
    queryFn: async () => {
      let q = supabase
        .from('estoque_movimentacoes')
        .select('*, estoque_produtos(nome, unidade)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (filters.produto_id) q = q.eq('produto_id', filters.produto_id)
      if (filters.tipo)       q = q.eq('tipo', filters.tipo)
      if (filters.responsavel) q = q.ilike('responsavel', `%${filters.responsavel}%`)
      if (filters.dateFrom)   q = q.gte('created_at', filters.dateFrom)
      if (filters.dateTo)     q = q.lte('created_at', filters.dateTo + 'T23:59:59')

      const { data, error, count } = await q
      if (error) throw error
      return {
        rows: (data ?? []) as EstoqueMovimentacao[],
        total: count ?? 0,
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

// Movimentações de um produto específico (para gráfico de evolução)
export function useMovimentacoesPorProduto(produtoId: string | null) {
  return useQuery({
    queryKey: ['estoque-movimentacoes-produto', produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select('*')
        .eq('produto_id', produtoId!)
        .order('created_at', { ascending: true })
        .limit(200)
      if (error) throw error
      return (data ?? []) as EstoqueMovimentacao[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export interface RegistrarPayload {
  produto_id: string
  tipo: 'entrada' | 'saida' | 'ajuste' | 'perda'
  quantidade: number            // para ajuste: valor final desejado
  quantidade_anterior: number   // snapshot atual (buscado antes do insert)
  motivo?: string
  nota_fiscal?: string
  custo_unitario?: number
  orcamento_id?: string
  responsavel: string
  user_id?: string
}

export function useRegistrarMovimentacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: RegistrarPayload) => {
      // Validação: saída/perda não pode exceder estoque disponível
      if (payload.tipo === 'saida' || payload.tipo === 'perda') {
        if (payload.quantidade > payload.quantidade_anterior) {
          throw new Error(
            `Estoque insuficiente: disponível ${payload.quantidade_anterior.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}`
          )
        }
      }

      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as EstoqueMovimentacao
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      qc.invalidateQueries({ queryKey: ['estoque-produtos-alerta'] })
      qc.invalidateQueries({ queryKey: ['estoque-movimentacoes'] })
      qc.invalidateQueries({ queryKey: ['estoque-movimentacoes-produto'] })
      qc.invalidateQueries({ queryKey: ['estoque-analytics-top'] })
      qc.invalidateQueries({ queryKey: ['estoque-analytics-mensal'] })
    },
  })
}
