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
  // score 0-100 calculado pela Amanda a cada conversa (motor determinístico, não a
  // classificacao_* acima) — QUENTE/MORNO/FRIO/GELADO/DESCARTE. Fica no banco desde a
  // virada do CRM mas nunca teve tela até o Relatório por canal (27/08).
  lead_score: number | null
  lead_temperatura: string | null
  lead_motivo: string | null
  // extraídos do histórico da loja: o que o cliente reclamou / o que destravou a venda
  objecoes: string | null
  gatilhos: string | null
  // o que na conversa colocou o lead no estágio atual (frase curta, do agente)
  status_motivo: string | null
  // de onde a pessoa veio antes do WhatsApp (capturado na primeira mensagem)
  origem: string | null
  origem_bruta: string | null
  origem_campanha: string | null
  // etiquetas da conversa no Chatwoot (texto separado por vírgula). `humano` = a equipe
  // assumiu e a IA está calada ali — é o que o selo "com a equipe" lê
  chatwoot_labels: string | null
  precisa_humano: string | null
  // preenchidos pelo workflow de desfecho, que lê a conversa depois do atendimento humano
  desfecho: string | null
  desfecho_motivo: string | null
  desfecho_valor: number | null
  desfecho_em: string | null
  atendente: string | null
  primeira_resposta_humana_em: string | null
}

/** A equipe assumiu esta conversa: a IA fica calada e quem responde é gente. */
export function estaComEquipe(lead: Pick<CrmLead, 'chatwoot_labels' | 'precisa_humano'>): boolean {
  const labels = (lead.chatwoot_labels ?? '').toLowerCase()
  return labels.split(',').some((l) => l.trim() === 'humano')
    || (lead.precisa_humano ?? '').toLowerCase().trim() === 'sim'
}

/**
 * Conversa que já estava rolando fora do funil ativo da Stella — importada só
 * pra dar contexto à IA, nunca é lead "novo" de verdade. Duas origens conhecidas
 * hoje, tratadas do mesmo jeito porque têm o mesmo efeito no relatório:
 *  - `status_lead = 'historico'`: WhatsApp antigo da loja, importado de propósito.
 *  - `status_lead = 'Novo'` (capitalizado, fora do vocabulário "1".."4" do agente
 *    vivo — ver `SeloStatus.tsx`): confirmado em produção (03/09) que é gerado por
 *    uma esteira diferente da extração ao vivo — 41% dos leads do banco (58/142)
 *    tinham esse status, `ultimo_valor_cotado`/`modelo_interesse` SEMPRE vazios
 *    mesmo quando o resumo já mostra orçamento enviado, e ~2/3 marcados
 *    "IA observando" — o dono da loja conversando pessoalmente com cliente que
 *    JÁ TINHA pedido em andamento (NFe, pagamento), não gente nova entrando.
 * Sem excluir os dois, cada leva vira um monte de "leads novos" que nunca vira
 * orçamento — inflando Leads sem nunca engordar Orçados/Vendas no funil.
 */
export function isLeadHistorico(lead: Pick<CrmLead, 'status_lead'>): boolean {
  const v = (lead.status_lead ?? '').toLowerCase().trim()
  return v === 'historico' || v === 'novo'
}

/**
 * Telefone tolerante a formato pra casar uma venda da LOJA (digitada por gente,
 * em `orcamentos.telefone`) com o lead do CRM que a originou (`whatsapp`,
 * sempre no formato cru do WhatsApp). Tira o "55" do Brasil e o 9º dígito
 * extra do celular, sobrando DDD + 8 dígitos — o bastante pra bater os dois
 * lados sem exigir que a loja digite o telefone igualzinho ao WhatsApp.
 */
export function normalizarTelefone(v: string | null | undefined): string {
  let d = String(v ?? '').replace(/\D/g, '')
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11) d = d.slice(0, 2) + d.slice(3)
  return d
}

/** Telefone normalizado → lead, pra casar venda de balcão com quem já tinha conversado. */
export function mapaLeadsPorTelefone(leads: CrmLead[]): Map<string, CrmLead> {
  const mapa = new Map<string, CrmLead>()
  for (const l of leads) {
    const tel = normalizarTelefone(l.whatsapp ?? l.identificador_usuario)
    if (tel && !mapa.has(tel)) mapa.set(tel, l)
  }
  return mapa
}

/** Acha o lead de origem de uma venda pelo telefone — undefined se não bater com ninguém. */
export function acharLeadPorTelefone(mapa: Map<string, CrmLead>, telefone: string | null | undefined): CrmLead | undefined {
  const tel = normalizarTelefone(telefone)
  return tel ? mapa.get(tel) : undefined
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

/** Marca a origem na mão — usada enquanto/onde a captura automática não alcança */
export function useDefinirOrigem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, origem }: { id: string; origem: string | null }) => {
      const { error } = await supabase
        .from('crm_sombrear_ia')
        .update({ origem, origem_bruta: origem ? 'marcado na mão pelo dash' : null })
        .eq('id', id)
      if (error) throw error
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
