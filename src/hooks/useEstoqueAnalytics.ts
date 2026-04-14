import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueMovimentacao, EstoqueProduto } from '@/lib/supabase'

export type TopProduto = {
  produto_id: string
  nome: string
  total_saidas: number
  total_entradas: number
}

export function useTopProdutosMovimentados(limit = 10) {
  return useQuery({
    queryKey: ['estoque-analytics-top', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('top_produtos_movimentados', { p_limit: limit })
      if (error) throw error
      return (data ?? []) as TopProduto[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export type ConsumoMensal = {
  mes: string       // 'Jan/25', 'Fev/25', etc.
  entradas: number
  saidas: number
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function mesKey(date: Date): string {
  return `${MESES_PT[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`
}

function subMonthsDate(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return d
}

export type ProdutoAbc = Pick<EstoqueProduto, 'id' | 'nome' | 'unidade' | 'quantidade_atual' | 'classificacao_abc'> & {
  total_saidas_90d: number
}

/** Dispara fn_recalcular_abc no banco e invalida o cache de produtos */
export function useRecalcularAbc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('fn_recalcular_abc')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-produtos'] }),
  })
}

/** Retorna produtos classificados (A/B/C) com total de saídas nos últimos 90 dias */
export function useCurvaAbc() {
  return useQuery({
    queryKey: ['estoque-curva-abc'],
    queryFn: async () => {
      // Busca produtos ativos com classificação
      const { data: produtos, error: errP } = await supabase
        .from('estoque_produtos')
        .select('id, nome, unidade, quantidade_atual, classificacao_abc')
        .eq('ativo', true)
        .not('classificacao_abc', 'is', null)
        .order('classificacao_abc')
      if (errP) throw errP

      // Busca totais de saída dos últimos 90 dias
      const { data: saidas, error: errS } = await supabase
        .from('estoque_movimentacoes')
        .select('produto_id, quantidade')
        .in('tipo', ['saida', 'perda'])
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      if (errS) throw errS

      const totaisMap = new Map<string, number>()
      for (const s of saidas ?? []) {
        totaisMap.set(s.produto_id, (totaisMap.get(s.produto_id) ?? 0) + Number(s.quantidade))
      }

      return ((produtos ?? []) as EstoqueProduto[]).map(p => ({
        id: p.id,
        nome: p.nome,
        unidade: p.unidade,
        quantidade_atual: p.quantidade_atual,
        classificacao_abc: p.classificacao_abc,
        total_saidas_90d: totaisMap.get(p.id) ?? 0,
      })) as ProdutoAbc[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useConsumoMensal(meses = 6) {
  return useQuery({
    queryKey: ['estoque-analytics-mensal', meses],
    queryFn: async () => {
      const now = new Date()
      const desde = subMonthsDate(now, meses - 1)
      desde.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select('created_at, quantidade, tipo')
        .gte('created_at', desde.toISOString())
        .order('created_at')
      if (error) throw error

      // Inicializa todos os meses do intervalo com zero
      const map = new Map<string, { entradas: number; saidas: number }>()
      for (let i = meses - 1; i >= 0; i--) {
        map.set(mesKey(subMonthsDate(now, i)), { entradas: 0, saidas: 0 })
      }

      for (const row of (data ?? []) as EstoqueMovimentacao[]) {
        const key = mesKey(new Date(row.created_at))
        const entry = map.get(key)
        if (!entry) continue
        if (row.tipo === 'entrada') entry.entradas += row.quantidade
        else if (row.tipo === 'saida' || row.tipo === 'perda') entry.saidas += row.quantidade
      }

      return Array.from(map.entries()).map(([mes, v]) => ({ mes, ...v })) as ConsumoMensal[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
