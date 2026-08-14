import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Resumos por período escritos pela IA — a "estante" da aba Relatórios.
 *
 * Quem fabrica é um workflow n8n (Dash | Relatorios por periodo (IA)): os números
 * são calculados por código a partir do CRM e o Gemini só escreve a prosa.
 * Semanais e mensais entram sozinhos; período avulso é pedido por aqui
 * (`relatorios_pedidos`) e fica pronto em até ~2 minutos.
 */

export type KpisRelatorio = {
  periodo?: { tipo: string; inicio: string; fim: string }
  leads_novos?: number
  por_origem?: Record<string, number>
  por_temperatura?: Record<string, number>
  cotados?: number
  passados_pro_humano?: number
  fechados?: number
  receita_fechada?: number
  perdidos_ou_sumiram?: number
  objecoes_top?: string[]
  sla_medio_horas?: number | null
  aguardando_atendente_agora?: number
}

export type RelatorioIA = {
  id: string
  tipo: 'semanal' | 'mensal' | 'anual' | 'custom'
  periodo_inicio: string
  periodo_fim: string
  texto: string | null
  kpis: KpisRelatorio | null
  gerado_em: string
}

export type PedidoRelatorio = {
  id: string
  periodo_inicio: string
  periodo_fim: string
  status: 'pendente' | 'pronto'
  criado_em: string
}

export function useRelatoriosIA() {
  return useQuery({
    queryKey: ['relatorios-ia'],
    queryFn: async (): Promise<RelatorioIA[]> => {
      const { data, error } = await supabase
        .from('relatorios_ia')
        .select('*')
        .order('gerado_em', { ascending: false })
        .limit(60)
      if (error) throw error
      return (data ?? []) as RelatorioIA[]
    },
  })
}

/**
 * Pedidos ainda na fila. Enquanto houver um pendente, esta query se re-busca
 * sozinha a cada 10s — e derruba o cache da estante junto, então o resumo
 * novo aparece sem a pessoa fazer nada.
 */
export function usePedidosPendentes() {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['relatorios-pedidos-pendentes'],
    queryFn: async (): Promise<PedidoRelatorio[]> => {
      const { data, error } = await supabase
        .from('relatorios_pedidos')
        .select('*')
        .eq('status', 'pendente')
        .order('criado_em', { ascending: false })
      if (error) throw error
      const pendentes = (data ?? []) as PedidoRelatorio[]
      if (pendentes.length === 0) {
        // acabou de esvaziar: o resumo deve ter chegado — atualiza a estante
        qc.invalidateQueries({ queryKey: ['relatorios-ia'] })
      }
      return pendentes
    },
    refetchInterval: (query) =>
      (query.state.data?.length ?? 0) > 0 ? 10_000 : false,
  })
}

export function usePedirRelatorio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ inicio, fim }: { inicio: string; fim: string }) => {
      const { error } = await supabase
        .from('relatorios_pedidos')
        .insert({ periodo_inicio: inicio, periodo_fim: fim })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relatorios-pedidos-pendentes'] })
    },
  })
}
