import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface PontoPedidoRow {
  produto_id: string
  sku: string
  nome: string
  classe_abc: string | null
  estoque_atual: number
  fornecedor_nome: string | null
  demanda_diaria: number
  lead_time_dias: number
  estoque_seguranca: number
  ponto_pedido: number
  cobertura_dias: number
  nivel_alerta: 'ruptura' | 'critico' | 'atencao' | 'ok' | 'sem_dados'
}

export function useEstoquePontoPedido() {
  return useQuery<PontoPedidoRow[]>({
    queryKey: ['estoque-ponto-pedido'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_vw_ponto_pedido')
        .select('*')
      if (error) throw error
      return (data ?? []) as PontoPedidoRow[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
