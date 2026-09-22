/**
 * O que trava a venda — contado, não descrito.
 *
 * A contagem vivia dentro de `InsightsAmanda.tsx`. Saiu para cá quando a aba Análise
 * passou a mostrar o mesmo ranking para outro público: duas contagens independentes do
 * mesmo dado é exatamente como "Por canal" e "Análises" acabaram com receitas
 * diferentes. Uma função, duas telas.
 */

import type { CrmLead } from '@/hooks/useAgenteIA'
import { OBJECOES, type Objecao } from '@/lib/insights/taxonomia'
import { variacaoPct, type Intervalo } from '@/lib/periodos'
import { dataAtividade, noPeriodo, pctOuNulo } from './base'

/** Fornecedor, costureira, engano: não é cliente e não diz nada sobre o atendimento. */
const NAO_CLIENTE = 'sem_interesse'

export type BaseObjecoes = {
  /** conversas de cliente no período (já fora os `sem_interesse`) */
  conversas: CrmLead[]
  /**
   * as que já passaram pela taxonomia. Array vazio CONTA: quer dizer "li e não havia
   * objeção", que é diferente de "nunca li".
   */
  analisadas: CrmLead[]
  naoCliente: CrmLead[]
  anteriores: CrmLead[]
}

/**
 * NÃO aplica o corte `isLeadHistorico`, de propósito.
 *
 * Para o funil o corte está certo — lead importado nunca virou orçamento e inflaria o
 * topo. Para objeção, não: medido em 03/09/2026, o corte descartava 36% das objeções
 * detectadas, porque `status_lead='Novo'` é artefato da esteira de importação, não sinal
 * de que a conversa não aconteceu. A reclamação de prazo é real de qualquer jeito.
 */
export function baseObjecoes(
  leads: CrmLead[],
  faixaAtual: Intervalo | null,
  faixaAnterior: Intervalo | null,
): BaseObjecoes {
  const doRecorte = leads.filter((l) => noPeriodo(dataAtividade(l), faixaAtual))
  const naoCliente = doRecorte.filter((l) => l.classificacao_ia === NAO_CLIENTE)
  const conversas = doRecorte.filter((l) => l.classificacao_ia !== NAO_CLIENTE)
  const analisadas = conversas.filter((l) => l.objecao_tags != null)

  const anteriores = faixaAnterior
    ? leads.filter((l) =>
        noPeriodo(dataAtividade(l), faixaAnterior) &&
        l.classificacao_ia !== NAO_CLIENTE &&
        l.objecao_tags != null)
    : []

  return { conversas, analisadas, naoCliente, anteriores }
}

export type LinhaObjecao = {
  objecao: Objecao
  n: number
  /** sobre as conversas ANALISADAS. Null quando a amostra é pequena demais pra %. */
  pct: number | null
  /** participação relativa, só para dimensionar a barra — nunca exibida como número */
  fatia: number
  delta: number | null
}

function contar(leads: CrmLead[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of leads) for (const t of l.objecao_tags ?? []) m.set(t, (m.get(t) ?? 0) + 1)
  return m
}

/**
 * ⚠️ `objecao_tags` é multi-rótulo: uma conversa pode ter três objeções. As
 * porcentagens NÃO somam 100 e o denominador é "conversas analisadas", nunca "objeções".
 * É por isso que a forma visual é lista ranqueada, e nunca pizza ou barra empilhada
 * 100% — as duas prometem partes de um todo que aqui não existe.
 */
export function rankearObjecoes(base: BaseObjecoes): LinhaObjecao[] {
  const atual = contar(base.analisadas)
  const antes = contar(base.anteriores)
  const denominador = base.analisadas.length
  const maior = Math.max(1, ...OBJECOES.map((o) => atual.get(o.id) ?? 0))

  return OBJECOES
    .map((objecao) => {
      const n = atual.get(objecao.id) ?? 0
      return {
        objecao,
        n,
        pct: pctOuNulo(n, denominador),
        fatia: n / maior,
        delta: variacaoPct(n, antes.get(objecao.id) ?? 0),
      }
    })
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
}

export type CoberturaIA = {
  conversas: number
  analisadas: number
  pct: number
  /** ISO da leitura mais recente, de qualquer conversa da base (não só do período) */
  ultimaEm: string | null
  diasParado: number | null
  /** conversas do período que a IA ainda não leu */
  pendentes: number
}

/**
 * Quanto do período a IA já leu — e há quanto tempo ela não lê nada.
 *
 * A edge function `classificar-conversas` só roda quando alguém clica. Ela parou em
 * 07/09/2026 e ninguém percebeu por duas semanas, o que deixou as seções que dependem
 * dela cegas sem avisar. Este número existe para que o silêncio nunca mais passe por
 * "não houve objeção nenhuma".
 */
export function coberturaIA(leads: CrmLead[], base: BaseObjecoes, agora = new Date()): CoberturaIA {
  const datas = leads
    .map((l) => l.classificacao_em)
    .filter((d): d is string => !!d)
    .sort()
  const ultimaEm = datas.length ? datas[datas.length - 1] : null
  const diasParado = ultimaEm
    ? Math.floor((agora.getTime() - new Date(ultimaEm).getTime()) / 86_400_000)
    : null

  return {
    conversas: base.conversas.length,
    analisadas: base.analisadas.length,
    pct: base.conversas.length ? (base.analisadas.length / base.conversas.length) * 100 : 0,
    ultimaEm,
    diasParado,
    pendentes: base.conversas.length - base.analisadas.length,
  }
}

/** Sensibilidade a preço declarada nas conversas — insumo de precificação, não de venda. */
export function sensibilidadePreco(base: BaseObjecoes): { nivel: string; rotulo: string; n: number }[] {
  const rotulos: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
  return ['alta', 'media', 'baixa'].map((nivel) => ({
    nivel,
    rotulo: rotulos[nivel],
    n: base.analisadas.filter((l) => l.sensibilidade_preco === nivel).length,
  }))
}
