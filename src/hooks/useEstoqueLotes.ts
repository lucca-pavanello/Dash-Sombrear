import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueLote, EstoqueLoteItem } from '@/lib/supabase'

const PAGE_SIZE = 20

export interface LotesFilters {
  fornecedor_id?: string
  dateFrom?: string
  dateTo?: string
  page?: number
}

export function useEstoqueLotes(filters: LotesFilters = {}) {
  const page = filters.page ?? 1
  const offset = (page - 1) * PAGE_SIZE

  return useQuery({
    queryKey: ['estoque-lotes', filters],
    queryFn: async () => {
      let q = supabase
        .from('estoque_lotes')
        .select('*, estoque_fornecedores(nome)', { count: 'exact' })
        .order('data_entrada', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (filters.fornecedor_id) q = q.eq('fornecedor_id', filters.fornecedor_id)
      if (filters.dateFrom)      q = q.gte('data_entrada', filters.dateFrom)
      if (filters.dateTo)        q = q.lte('data_entrada', filters.dateTo)

      const { data, error, count } = await q
      if (error) throw error
      return { lotes: (data ?? []) as EstoqueLote[], total: count ?? 0 }
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useEstoqueLoteItens(loteId: string | null) {
  return useQuery({
    queryKey: ['estoque-lote-itens', loteId],
    queryFn: async () => {
      if (!loteId) return []
      const { data, error } = await supabase
        .from('estoque_lote_itens')
        .select('*, estoque_produtos(nome, unidade)')
        .eq('lote_id', loteId)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as EstoqueLoteItem[]
    },
    enabled: !!loteId,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export interface NovoLotePayload {
  fornecedor_id?: string | null
  nf_numero?: string | null
  data_entrada: string
  observacoes?: string | null
  itens: { produto_id: string; quantidade: number; custo_unitario: number }[]
}

export function useAddLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: NovoLotePayload) => {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Cria o cabeçalho do lote
      const { data: lote, error: errLote } = await supabase
        .from('estoque_lotes')
        .insert({
          fornecedor_id: payload.fornecedor_id ?? null,
          nf_numero:     payload.nf_numero ?? null,
          data_entrada:  payload.data_entrada,
          observacoes:   payload.observacoes ?? null,
          user_id:       user?.id ?? null,
        })
        .select()
        .single()
      if (errLote) throw errLote

      // 2. Insere os itens (os triggers cuidam de movimentacoes + saldo + total)
      const itens = payload.itens.map(i => ({
        lote_id:        lote.id,
        produto_id:     i.produto_id,
        quantidade:     i.quantidade,
        custo_unitario: i.custo_unitario,
      }))
      const { error: errItens } = await supabase
        .from('estoque_lote_itens')
        .insert(itens)
      if (errItens) throw errItens

      return lote as EstoqueLote
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-lotes'] })
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      qc.invalidateQueries({ queryKey: ['estoque-movimentacoes'] })
      qc.invalidateQueries({ queryKey: ['estoque-entradas-historico'] })
    },
  })
}
