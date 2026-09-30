/**
 * Cotado e convertido: uma definição só para Agente IA, Por canal e Análises.
 *
 * Antes cada tela tinha a sua. "Cotado" era texto não vazio numa, número maior que
 * zero na outra; "convertido" aceitava venda de qualquer data com o mesmo telefone,
 * inclusive uma compra de antes de a pessoa falar com a Stella.
 */

import type { Orcamento } from '@/lib/supabase'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { STATUS_CONVERTIDO } from '@/hooks/useAgenteIA'
import { valorNumerico } from '@/lib/utils'
import { diaDaCasa } from '@/lib/fusoCasa'
import { dataVenda, ehTeste, ehVenda } from './venda'

/** A Stella passou preço na conversa: valor cotado maior que zero ("0" e "null" não contam). */
export function recebeuPreco(valor: string | null | undefined): boolean {
  return valorNumerico(valor) > 0
}

/** Marcado na mão como convertido (botão "Converteu" ou status do agente). */
export function marcadoConvertido(status: string | null | undefined): boolean {
  const v = status?.toLowerCase().trim() ?? ''
  return v === STATUS_CONVERTIDO || v === 'fechado'
}

/**
 * Leads que compraram na loja: uma venda fechada com o telefone deles, feita no dia
 * em que a pessoa chegou ou depois. Venda anterior ao lead é cliente antigo voltando,
 * não conversão do atendimento.
 */
export function leadsQueCompraram(
  orcamentos: Orcamento[],
  acharLead: (telefone: string | null | undefined) => CrmLead | undefined,
): Set<string> {
  const ids = new Set<string>()
  for (const o of orcamentos) {
    if (!ehVenda(o) || ehTeste(o)) continue
    const lead = acharLead(o.telefone)
    if (!lead) continue
    const diaVenda = diaDaCasa(dataVenda(o))
    const diaLead = diaDaCasa(lead.created_at)
    if (diaVenda && diaLead && diaVenda >= diaLead) ids.add(lead.id)
  }
  return ids
}

export function ehConvertido(lead: CrmLead, compraram: Set<string>): boolean {
  return marcadoConvertido(lead.status_lead) || compraram.has(lead.id)
}
