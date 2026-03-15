import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  })
}
