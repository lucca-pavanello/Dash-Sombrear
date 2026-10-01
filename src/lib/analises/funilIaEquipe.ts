/**
 * Funil IA x equipe (Lucca, 01/10/2026): cada lado com as suas fases e, no fim, os
 * convertidos somando os dois.
 *
 * Um lead pode passar pelos dois lados (a Amanda atende e cota, depois a equipe assume e
 * cota de novo), então ele conta nos dois. Por isso a soma dos lados pode passar do total,
 * e a tela diz quantos contam duas vezes. Quem fecha a venda é sempre a equipe; o lado do
 * convertido diz de quem foi o orçamento que ele recebeu.
 */

import type { CrmLead, OrcamentoChat } from '@/hooks/useAgenteIA'

export type Atendimento = { ia_respondeu: boolean; equipe_respondeu: boolean }

export type EtapaIaEquipe = { chave: 'atendeu' | 'orcamento' | 'medicao'; rotulo: string; ia: number; equipe: number }

export type FunilIaEquipe = {
  conversas: number
  etapas: EtapaIaEquipe[]
  convertidos: {
    total: number
    /** convertidos que receberam orçamento da IA (podem ter recebido da equipe também) */
    ia: number
    equipe: number
    nosDois: number
    /** convertidos sem orçamento no chat: preço passado por fora (balcão, telefone) */
    semOrcamento: number
  }
}

export function calcularFunilIaEquipe({ leads, atendimento, orcamentosChat, idsConvertidos, cotouForaDoChat }: {
  /** os leads da tela, já filtrados por período e canal */
  leads: CrmLead[]
  atendimento: Map<string, Atendimento>
  orcamentosChat: Pick<OrcamentoChat, 'lead_id' | 'autor'>[]
  idsConvertidos: Set<string>
  /** a IA passou preço fora da mensagem lida (valor cotado do CRM, calculadora) */
  cotouForaDoChat: (lead: CrmLead) => boolean
}): FunilIaEquipe {
  const cotouIa = new Set<string>()
  const cotouEquipe = new Set<string>()
  for (const o of orcamentosChat) {
    if (o.lead_id) (o.autor === 'ia' ? cotouIa : cotouEquipe).add(o.lead_id)
  }

  const c = { atendeuIa: 0, atendeuEq: 0, orcIa: 0, orcEq: 0, medIa: 0, medEq: 0 }
  const conv = { total: 0, ia: 0, equipe: 0, nosDois: 0, semOrcamento: 0 }
  for (const l of leads) {
    const a = atendimento.get(l.id)
    const ia = cotouIa.has(l.id) || cotouForaDoChat(l)
    const eq = cotouEquipe.has(l.id)
    if (a?.ia_respondeu) c.atendeuIa++
    if (a?.equipe_respondeu) c.atendeuEq++
    if (ia) c.orcIa++
    if (eq) c.orcEq++
    if (l.data_medicao_instalacao?.trim()) c.medIa++
    if (l.medicao_equipe?.trim()) c.medEq++
    if (!idsConvertidos.has(l.id)) continue
    conv.total++
    if (ia) conv.ia++
    if (eq) conv.equipe++
    if (ia && eq) conv.nosDois++
    if (!ia && !eq) conv.semOrcamento++
  }

  return {
    conversas: leads.length,
    etapas: [
      { chave: 'atendeu', rotulo: 'Atendeu', ia: c.atendeuIa, equipe: c.atendeuEq },
      { chave: 'orcamento', rotulo: 'Mandou orçamento', ia: c.orcIa, equipe: c.orcEq },
      { chave: 'medicao', rotulo: 'Medição agendada', ia: c.medIa, equipe: c.medEq },
    ],
    convertidos: conv,
  }
}
