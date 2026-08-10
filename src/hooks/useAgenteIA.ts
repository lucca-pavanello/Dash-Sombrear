import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Status usado pelo n8n quando a IA passa o preço e o cliente quer atendimento humano
export const STATUS_AGUARDANDO = 'aguardando_atendimento'
export const STATUS_CONVERTIDO  = 'convertido'

export type CrmLead = {
  id: string
  created_at: string
  identificador_usuario: string | null
  whatsapp: string | null
  nome: string | null
  inicio_atendimento: string | null
  status_lead: string | null
  resumo_conversa: string | null
  ultimo_valor_cotado: string | null
  endereco_cep: string | null
  data_medicao_instalacao: string | null
  timestamp_ultima_msg: string | null
  id_conta_chatwoot: string | null
  id_conversa_chatwoot: string | null
  id_lead_chatwoot: string | null
  inbox_id_chatwoot: string | null
  modelo_interesse: string | null
  ambiente: string | null
  medidas_coletadas: string | null
  quantidade: string | null
  tecido_cor: string | null
  acabamento_desejado: string | null
  precisa_instalacao: string | null
  cidade: string | null
  tipo_imovel: string | null
  orcamento_aceito: boolean | null
  // veredito da IA sobre a conversa (edge function classificar-conversas)
  classificacao_ia: string | null
  classificacao_motivo: string | null
  classificacao_temperatura: string | null
  classificacao_em: string | null
  // extraídos do histórico da loja: o que o cliente reclamou / o que destravou a venda
  objecoes: string | null
  gatilhos: string | null
}

export type OrcamentoIA = {
  id: string
  cliente_id: string | null
  created_at: string
  modelo: string | null
  ambiente: string | null
  largura: number | null
  altura: number | null
  quantidade: number | null
  tecido: string | null
  acabamento: string | null
  custo_total_base: number | null
  custo_acabamento_total: number | null
  valor_venda_total_base: number | null
  valor_venda_acabamento_total: number | null
  valor_colocacao: number | null
  resumo_calculo: string | null
  identificador_whats: string | null
}

// Realtime dos leads do agente (WhatsApp/n8n): novos registros aparecem sozinhos,
// sem precisar remontar a aba. Espelha o padrão de useOrcamentos.
export function useAgenteIARealtime({ enabled = true, onNewLead }: {
  enabled?: boolean
  onNewLead?: (lead: CrmLead) => void
} = {}) {
  const qc = useQueryClient()
  const onNewLeadRef = useRef(onNewLead)
  onNewLeadRef.current = onNewLead

  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('agente-ia-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_sombrear_ia' },
        (payload) => {
          qc.invalidateQueries({ queryKey: ['crm-sombrear-ia'] })
          if (payload.eventType === 'INSERT') onNewLeadRef.current?.(payload.new as CrmLead)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orcamentos_sombrear_ia' },
        () => qc.invalidateQueries({ queryKey: ['orcamentos-sombrear-ia'] }),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc, enabled])
}

export function useCrmLeads() {
  return useQuery({
    queryKey: ['crm-sombrear-ia'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_sombrear_ia')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        throw error
      }
      return data as CrmLead[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
    // Fallback caso o realtime caia — o canal agente-ia-realtime é o mecanismo primário
    refetchInterval: 180000,
  })
}

export function useMarcarConvertido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_sombrear_ia')
        .update({ status_lead: STATUS_CONVERTIDO })
        .eq('id', id)
      if (error) {
        throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-sombrear-ia'] }),
  })
}

export function useOrcamentosIA() {
  return useQuery({
    queryKey: ['orcamentos-sombrear-ia'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamentos_sombrear_ia')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        throw error
      }
      return data as OrcamentoIA[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval: 180000,
  })
}
