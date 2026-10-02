/**
 * As contas dos Insights da equipe, fora do componente pra ter teste.
 *
 * Duas famílias de número, e a tela não mistura as duas:
 *  - DADO BRUTO (sem IA): tempo de resposta, esperas longas, áudio, orçamento, medição e
 *    convertido. Sai das mensagens gravadas e do CRM.
 *  - LEITURA DA IA: falhas de atendimento e objeções, etiquetadas no trecho da equipe
 *    (classificar-fases). Conta só conversa já lida e que é de cliente.
 */
import type { CrmLead, EquipeLead, OrcamentoChat, RespostasEquipeLead } from '@/hooks/useAgenteIA'
import { FALHAS, OBJECOES, type Falha, type Objecao } from './taxonomia'

export type FiltroAssunto = 'tudo' | 'venda' | 'pos_venda'

export type Linha<T> = { item: T; n: number; pct: number; anterior: number }

export type ResumoEquipe = {
  /** conversas em que a equipe entrou (fornecedor fica de fora quando a IA já marcou) */
  conversas: CrmLead[]
  naoCliente: number
  venda: number
  posVenda: number
  /** do recorte de assunto escolhido */
  lidas: CrmLead[]
  pendentes: number
  numeros: {
    /** mediana das medianas por conversa, em minutos; null sem resposta no horário */
    medianaResposta: number | null
    respostas: number
    esperasLongas: number
    msgs: number
    audios: number
    orcamentos: number
    medicoes: number
    convertidos: number
  }
  falhas: Linha<Falha>[]
  objecoes: Linha<Objecao>[]
}

function mediana(v: number[]): number | null {
  if (v.length === 0) return null
  const o = [...v].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

/** a leitura ficou pra trás quando a conversa andou depois dela */
export function leituraPendente(l: CrmLead): boolean {
  if (!l.fases_em) return true
  return !!l.timestamp_ultima_msg && new Date(l.timestamp_ultima_msg).getTime() > new Date(l.fases_em).getTime()
}

function ranking<T extends { id: string }>(lista: readonly T[], atual: CrmLead[], anteriores: CrmLead[],
  tags: (l: CrmLead) => string[] | null | undefined): Linha<T>[] {
  const conta = (arr: CrmLead[]) => {
    const m = new Map<string, number>()
    for (const l of arr) for (const t of tags(l) ?? []) m.set(t, (m.get(t) ?? 0) + 1)
    return m
  }
  const agora = conta(atual)
  const antes = conta(anteriores)
  const de = atual.length || 1
  return lista
    .map(item => ({ item, n: agora.get(item.id) ?? 0, pct: ((agora.get(item.id) ?? 0) / de) * 100, anterior: antes.get(item.id) ?? 0 }))
    .filter(r => r.n > 0)
    .sort((a, b) => b.n - a.n)
}

export function resumirEquipe({ leads, anteriores, assunto, numerosPorLead, respostasPorLead, orcamentosChat, idsConvertidos }: {
  /** leads do recorte (período + canal) */
  leads: CrmLead[]
  /** mesmo recorte no período anterior, pra comparar */
  anteriores: CrmLead[]
  assunto: FiltroAssunto
  numerosPorLead: Map<string, EquipeLead>
  respostasPorLead: Map<string, RespostasEquipeLead>
  orcamentosChat: Pick<OrcamentoChat, 'lead_id' | 'autor'>[]
  idsConvertidos: Set<string>
}): ResumoEquipe {
  const comEquipe = (l: CrmLead) => (numerosPorLead.get(l.id)?.msgs_equipe ?? 0) > 0 || l.equipe_assunto != null
  const doAssunto = (l: CrmLead) => assunto === 'tudo' || l.equipe_assunto === assunto
  const lida = (l: CrmLead) => l.equipe_falhas != null && l.equipe_assunto != null && l.equipe_assunto !== 'nao_cliente'

  const todas = leads.filter(comEquipe)
  const naoCliente = todas.filter(l => l.equipe_assunto === 'nao_cliente').length
  const conversas = todas.filter(l => l.equipe_assunto !== 'nao_cliente')
  const recorte = assunto === 'tudo' ? conversas : conversas.filter(doAssunto)
  const lidas = recorte.filter(lida)
  const anterioresLidas = anteriores.filter(l => comEquipe(l) && lida(l) && doAssunto(l))

  const cotouEquipe = new Set(orcamentosChat.filter(o => o.autor === 'equipe' && o.lead_id).map(o => o.lead_id as string))
  const medianas: number[] = []
  const n = { respostas: 0, esperasLongas: 0, msgs: 0, audios: 0, orcamentos: 0, medicoes: 0, convertidos: 0 }
  for (const l of recorte) {
    const r = respostasPorLead.get(l.id)
    if (r && r.respostas > 0 && r.mediana_min != null) {
      medianas.push(Number(r.mediana_min))
      n.respostas += Number(r.respostas)
      n.esperasLongas += Number(r.esperas_longas)
    }
    const e = numerosPorLead.get(l.id)
    if (e) { n.msgs += Number(e.msgs_equipe); n.audios += Number(e.audios_equipe) }
    if (cotouEquipe.has(l.id)) n.orcamentos++
    if (l.medicao_equipe?.trim()) n.medicoes++
    if (idsConvertidos.has(l.id)) n.convertidos++
  }

  return {
    conversas,
    naoCliente,
    venda: conversas.filter(l => l.equipe_assunto === 'venda').length,
    posVenda: conversas.filter(l => l.equipe_assunto === 'pos_venda').length,
    lidas,
    pendentes: recorte.filter(leituraPendente).length,
    numeros: { medianaResposta: mediana(medianas), ...n },
    falhas: ranking(FALHAS, lidas, anterioresLidas, l => l.equipe_falhas),
    objecoes: ranking(OBJECOES, lidas, anterioresLidas, l => l.equipe_objecao_tags),
  }
}

/** "12 min", "1h 20", "2 dias" — tempo de resposta legível */
export function tempoLegivel(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${Math.round(min)} min`
  if (min < 24 * 60) {
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    return m ? `${h}h ${String(m).padStart(2, '0')}` : `${h}h`
  }
  const d = Math.round(min / (24 * 60))
  return `${d} dia${d !== 1 ? 's' : ''}`
}
