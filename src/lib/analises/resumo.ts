/**
 * A manchete do período — uma frase, montada em código.
 *
 * Substitui o bloco "Análise Automática" que escrevia sete linhas genéricas letra por
 * letra num efeito de máquina de escrever. Quem abre a aba quer ler o resultado, não
 * esperar o texto aparecer; e sete frases no topo não são hierarquia, são sete empates.
 * Aqui é uma frase e no máximo três observações, todas com número verificável.
 */

import { formatCurrency } from '@/lib/utils'
import type { LinhaObjecao } from './objecoes'
import type { LinhaDemanda } from './demanda'
import type { ResumoDinheiro } from './dinheiro'
import type { Funil } from './funil'

export type Observacao = { texto: string; tom: 'neutro' | 'bom' | 'atencao' }

export function manchete(
  rotuloPeriodo: string,
  funil: Funil,
  dinheiro: ResumoDinheiro,
): string {
  const conversas = funil.etapas[0]?.valor ?? 0
  if (conversas === 0 && dinheiro.pedidos === 0) {
    return `Nenhum pedido e nenhuma conversa ${rotuloPeriodo.toLowerCase()}.`
  }
  // dinheiro primeiro: quem abre esta aba decide investimento, não escala de atendimento
  const partePedido = dinheiro.pedidos === 0
    ? 'Nenhum pedido fechado ainda'
    : `${formatCurrency(dinheiro.receita)} fechados em ${dinheiro.pedidos} pedido${dinheiro.pedidos > 1 ? 's' : ''}`
  const parteConversa = conversas === 0
    ? ''
    : `, de ${conversas} conversa${conversas > 1 ? 's' : ''} atendida${conversas > 1 ? 's' : ''} pela Amanda`
  return `${rotuloPeriodo}: ${partePedido}${parteConversa}.`
}

export function observacoes(
  objecoes: LinhaObjecao[],
  demanda: LinhaDemanda[],
  dinheiro: ResumoDinheiro,
  analisadas: number,
): Observacao[] {
  const saida: Observacao[] = []

  if (dinheiro.margemMedia != null && dinheiro.comMargem >= 3) {
    saida.push({
      tom: dinheiro.margemMedia >= 50 ? 'bom' : 'neutro',
      texto: `Margem média de ${dinheiro.margemMedia.toFixed(1)}% nos ${dinheiro.comMargem} pedidos com custo calculado.`,
    })
  }

  // a assimetria que mais importa: família que puxa conversa e não vira receita
  const orfa = demanda
    .filter((d) => d.identificado && d.conversas >= 5 && d.pctReceita < 1)
    .sort((a, b) => b.conversas - a.conversas)[0]
  if (orfa) {
    saida.push({
      tom: 'atencao',
      texto: `${orfa.rotulo} é ${Math.round(orfa.pctDemanda)}% das conversas e não gerou receita nenhuma no período.`,
    })
  }

  const topo = objecoes[0]
  if (topo && analisadas > 0) {
    saida.push({
      tom: 'atencao',
      texto: `${topo.objecao.rotulo.toLowerCase()} apareceu em ${topo.n} de ${analisadas} conversas lidas — ${topo.objecao.dica.toLowerCase()}`,
    })
  }

  return saida.slice(0, 3)
}
