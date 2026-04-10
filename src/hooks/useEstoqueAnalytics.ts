import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EstoqueMovimentacao } from '@/lib/supabase'

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
