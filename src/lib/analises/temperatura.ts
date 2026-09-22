/**
 * Termômetro da carteira — quanto do funil está quente agora.
 *
 * A leitura aqui é proporção, não valor absoluto: "dois terços da carteira esfriou" é a
 * informação, e cinco KPIs soltos não contam isso. Por isso uma barra empilhada única,
 * que é a forma certa quando as partes de fato somam o todo (ao contrário das objeções,
 * que são multi-rótulo).
 */

import type { CrmLead } from '@/hooks/useAgenteIA'
import { TEMPERATURAS, acharTemperatura } from '@/components/agente/SeloTemperatura'
import type { Intervalo } from '@/lib/periodos'
import { dataAtividade, noPeriodo } from './base'

export type DegrauTemperatura = {
  id: string
  rotulo: string
  barra: string
  n: number
  pct: number
}

export type Termometro = {
  degraus: DegrauTemperatura[]
  avaliados: number
  total: number
  scoreMedio: number | null
  /** quentes e mornos sem venda casada — o que dá pra fazer hoje */
  paradosQuentes: { lead: CrmLead; dias: number }[]
}

export function termometro(
  leads: CrmLead[],
  faixa: Intervalo | null,
  temVenda: (l: CrmLead) => boolean,
  agora = new Date(),
): Termometro {
  const doPeriodo = leads.filter((l) => noPeriodo(dataAtividade(l), faixa))
  const avaliados = doPeriodo.filter((l) => !!l.lead_temperatura?.trim())

  const contagem = new Map<string, number>()
  for (const l of avaliados) {
    const t = acharTemperatura(l.lead_temperatura)
    contagem.set(t.id, (contagem.get(t.id) ?? 0) + 1)
  }

  const degraus: DegrauTemperatura[] = TEMPERATURAS
    .map((t) => ({
      id: t.id,
      rotulo: t.rotulo,
      barra: t.barra as string,
      n: contagem.get(t.id) ?? 0,
      pct: avaliados.length ? ((contagem.get(t.id) ?? 0) / avaliados.length) * 100 : 0,
    }))
    .filter((d) => d.n > 0)

  // `CLIENTE` existe no banco e não está em TEMPERATURAS: `acharTemperatura` devolve
  // "sem avaliação" e a linha cai fora dos degraus. São 3 conversas hoje; entra na conta
  // de avaliados mas não em nenhum degrau, então o rodapé mostra a sobra em vez de somar
  // 97% e deixar o leitor achando que a barra quebrou.
  const somaDegraus = degraus.reduce((s, d) => s + d.n, 0)
  if (avaliados.length > somaDegraus) {
    degraus.push({
      id: 'ja_cliente',
      rotulo: 'Já é cliente',
      barra: 'bg-emerald-500',
      n: avaliados.length - somaDegraus,
      pct: ((avaliados.length - somaDegraus) / avaliados.length) * 100,
    })
  }

  const comScore = doPeriodo.filter((l) => l.lead_score != null)
  const scoreMedio = comScore.length
    ? comScore.reduce((s, l) => s + (l.lead_score ?? 0), 0) / comScore.length
    : null

  const paradosQuentes = doPeriodo
    .filter((l) => ['quente', 'morno'].includes(acharTemperatura(l.lead_temperatura).id) && !temVenda(l))
    .map((l) => ({
      lead: l,
      dias: Math.floor((agora.getTime() - new Date(dataAtividade(l)).getTime()) / 86_400_000),
    }))
    .sort((a, b) => b.dias - a.dias)

  return { degraus, avaliados: avaliados.length, total: doPeriodo.length, scoreMedio, paradosQuentes }
}
