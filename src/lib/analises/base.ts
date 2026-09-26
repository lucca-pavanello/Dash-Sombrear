/**
 * Fundação da aba Análise — as decisões que todas as seções precisam tomar igual.
 *
 * Existe porque a mesma pergunta já era respondida com números diferentes em lugares
 * diferentes: "Por canal" calcula receita com `valor_cobrado`, Análises calculava sem, e
 * as duas abas da MESMA área mostravam faturamentos que não batiam. Aqui a definição é
 * uma só e as telas importam.
 */

import type { Orcamento } from '@/lib/supabase'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { dentroDe, type Intervalo } from '@/lib/periodos'
// reexportadas abaixo; importadas aqui porque este arquivo também as usa
import { dataVenda } from './venda'

/**
 * `receita` e `ehVenda` saíram deste arquivo em 26/09 para `./venda.ts`, que
 * não importa nada e por isso pode ser carregado dentro de Edge Function — o
 * relatório por período precisa da MESMA definição de receita, e duas cópias
 * já foi o erro que fez esta aba divergir da "Por canal" no mesmo mês.
 *
 * A doutrina continua valendo e vale repetir: o guardião de venda é a flag
 * `fechado`, nunca o total de linhas da tabela. A maioria das linhas de
 * `orcamentos` é uso interno da calculadora pelo balcão
 * (`fonte = 'supervisor-custo'`), não proposta enviada a cliente. Métrica
 * comercial que mistura os dois mundos sai absurda — foi assim que esta aba já
 * exibiu margem de -1851%.
 */
export { receita, ehVenda, ehTeste, chavePedido, type VendaMinima } from './venda'

/**
 * A data que vale para uma conversa.
 *
 * A objeção pertence ao dia em que a pessoa falou, não ao dia em que a linha nasceu:
 * uma conversa aberta em agosto que só reclamou de prazo em setembro é um sinal de
 * setembro. Mesma regra já usada no card de Insights do Agente IA.
 */
export function dataAtividade(l: CrmLead): string {
  const ultima = l.timestamp_ultima_msg ? new Date(l.timestamp_ultima_msg).getTime() : NaN
  const criada = new Date(l.created_at).getTime()
  return Number.isFinite(ultima) && ultima > criada ? (l.timestamp_ultima_msg as string) : l.created_at
}

/** A data que vale para uma venda: a informada na mão no Semanário manda sobre a técnica. */
export { dataVenda } from './venda'

/** `faixa` nulo = "tudo": sem recorte. */
export function noPeriodo(iso: string, faixa: Intervalo | null): boolean {
  return faixa === null || dentroDe(iso, faixa)
}

export function leadsDoPeriodo(leads: CrmLead[], faixa: Intervalo | null): CrmLead[] {
  return leads.filter((l) => noPeriodo(dataAtividade(l), faixa))
}

export function orcamentosDoPeriodo(orcamentos: Orcamento[], faixa: Intervalo | null): Orcamento[] {
  return orcamentos.filter((o) => noPeriodo(dataVenda(o), faixa))
}

/**
 * Denominador mínimo para exibir porcentagem.
 *
 * Com 9 conversas, "11%" e "22%" são a mesma coisa com uma conversa de diferença — o
 * percentual dá aparência de precisão que a amostra não tem. Abaixo disto a tela mostra
 * "4 de 11" e deixa quem lê decidir.
 */
export const MIN_PARA_PCT = 20

export function pctOuNulo(parte: number, total: number): number | null {
  if (total < MIN_PARA_PCT) return null
  return (parte / total) * 100
}

/** Formata "7 de 19" ou "23%" conforme a amostra aguente. */
export function proporcao(parte: number, total: number): string {
  const pct = pctOuNulo(parte, total)
  return pct === null ? `${parte} de ${total}` : `${Math.round(pct)}%`
}
