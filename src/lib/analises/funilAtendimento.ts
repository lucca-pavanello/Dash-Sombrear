/**
 * Funil do atendimento (Lucca, 02/10/2026): uma fila só, e cada etapa diz de quem ela é.
 *
 *  - Atendeu: da IA. A Amanda faz toda a recepção.
 *  - Orçamento: dos dois. A IA manda primeiro; a equipe também pode mandar (e a IA vai
 *    aprendendo a orçar cortina). A barra mostra quanto foi só IA, só equipe e os dois.
 *  - Medição: da equipe. A Amanda não oferece horário de visita, então só vale o que a
 *    equipe marcou no WhatsApp (`medicao_equipe`). `data_medicao_instalacao` é a
 *    preferência que a IA anotou, não visita combinada, e fica fora.
 *  - Converteu: da equipe, marcado principalmente pelo Fechamento (venda lançada com o
 *    telefone do lead). Conta LEAD, não venda: quem foi marcado no WhatsApp e também
 *    lançado no Fechamento conta uma vez só. O resto aparece como "só marcado no
 *    WhatsApp", que é o aviso de que falta lançar.
 *
 * Substitui o funil espelhado IA x equipe de 01/10.
 */

import type { CrmLead, OrcamentoChat } from '@/hooks/useAgenteIA'

export type Atendimento = { ia_respondeu: boolean; equipe_respondeu: boolean }

export type Dono = 'ia' | 'ambos' | 'equipe'

export type FunilAtendimento = {
  conversas: number
  atendeu: { total: number; soEquipe: number }
  orcamento: { total: number; soIa: number; ambos: number; soEquipe: number }
  medicao: { total: number }
  converteu: { total: number; noFechamento: number; soMarcado: number }
}

export function calcularFunilAtendimento({ leads, atendimento, orcamentosChat, idsConvertidos, vendaNoFechamento, cotouForaDoChat }: {
  /** os leads da tela, já filtrados por período e canal */
  leads: CrmLead[]
  atendimento: Map<string, Atendimento>
  orcamentosChat: Pick<OrcamentoChat, 'lead_id' | 'autor'>[]
  /** marcados como convertidos OU com venda no Fechamento (src/lib/analises/conversao.ts) */
  idsConvertidos: Set<string>
  /** leads com venda lançada no Fechamento, casada pelo telefone */
  vendaNoFechamento: Set<string>
  /** a IA passou preço fora da mensagem lida (valor cotado do CRM, calculadora) */
  cotouForaDoChat: (lead: CrmLead) => boolean
}): FunilAtendimento {
  const cotouIa = new Set<string>()
  const cotouEquipe = new Set<string>()
  for (const o of orcamentosChat) {
    if (o.lead_id) (o.autor === 'ia' ? cotouIa : cotouEquipe).add(o.lead_id)
  }

  const f: FunilAtendimento = {
    conversas: leads.length,
    atendeu: { total: 0, soEquipe: 0 },
    orcamento: { total: 0, soIa: 0, ambos: 0, soEquipe: 0 },
    medicao: { total: 0 },
    converteu: { total: 0, noFechamento: 0, soMarcado: 0 },
  }
  for (const l of leads) {
    const a = atendimento.get(l.id)
    if (a?.ia_respondeu) f.atendeu.total++
    else if (a?.equipe_respondeu) f.atendeu.soEquipe++

    const ia = cotouIa.has(l.id) || cotouForaDoChat(l)
    const eq = cotouEquipe.has(l.id)
    if (ia || eq) {
      f.orcamento.total++
      if (ia && eq) f.orcamento.ambos++
      else if (ia) f.orcamento.soIa++
      else f.orcamento.soEquipe++
    }

    if (l.medicao_equipe?.trim()) f.medicao.total++

    if (idsConvertidos.has(l.id)) {
      f.converteu.total++
      if (vendaNoFechamento.has(l.id)) f.converteu.noFechamento++
      else f.converteu.soMarcado++
    }
  }
  return f
}
