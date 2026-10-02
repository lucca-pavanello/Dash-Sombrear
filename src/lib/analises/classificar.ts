/**
 * Disparar a leitura das conversas pela IA.
 *
 * Saiu de dentro de `ClassificadorConversas.tsx` porque agora duas telas precisam
 * chamar: o card do Agente IA e a aba Análise, onde a leitura atrasada deixa a seção de
 * objeções cega sem avisar.
 *
 * ⚠️ Na mudança foi corrigido um bug silencioso: o código original invalidava a query
 * `['crm-leads']`, que NÃO EXISTE — a chave real é `['crm-sombrear-ia']`
 * (`useAgenteIA.ts:188`). Na prática a tela só atualizava por acidente, quando o canal
 * realtime do Supabase entregava a mudança. Onde o realtime não estivesse assinado, o
 * botão rodava, o banco mudava e a tela ficava igual.
 */
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const CHAVE_LEADS = ['crm-sombrear-ia'] as const

/** A edge function processa 25 por chamada; o teto existe pra nunca virar laço infinito. */
const MAX_RODADAS = 12

/**
 * `functions.invoke` resume QUALQUER não-2xx como "Edge Function returned a non-2xx
 * status code" e descarta o corpo — que é justamente onde a função escreve o motivo.
 * Em 02/10 isso fez o botão parecer que não fazia nada: a função devolvia 500 dizendo
 * que o modelo não respondeu, e a tela mostrava uma frase genérica sobre status HTTP.
 */
async function motivo(error: unknown): Promise<string> {
  const corpo = (error as { context?: Response }).context
  if (corpo && typeof corpo.json === 'function') {
    try {
      const j = await corpo.json()
      if (j?.error) return String(j.error)
    } catch { /* não era JSON: fica a mensagem original */ }
  }
  return error instanceof Error ? error.message : 'Não consegui ler agora.'
}

export type ResultadoLeitura = {
  total: number
  restantes: number
  mensagem?: string
}

export async function classificarPendentes(
  qc: QueryClient,
  onProgresso?: (feitas: number) => void,
): Promise<ResultadoLeitura> {
  let total = 0
  let restantes = 0
  let mensagem: string | undefined

  try {
    for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
      const { data, error } = await supabase.functions.invoke('classificar-conversas', { body: {} })
      if (error) throw new Error(await motivo(error))
      const r = data as { classificadas?: number; restantes?: number; mensagem?: string; error?: string }
      if (r.error) throw new Error(r.error)

      if (!r.classificadas) {
        if (total === 0) mensagem = r.mensagem ?? 'Nada novo pra ler.'
        break
      }
      total += r.classificadas
      restantes = r.restantes ?? 0
      onProgresso?.(total)
      await qc.invalidateQueries({ queryKey: [...CHAVE_LEADS] })
      if (!r.restantes) { restantes = 0; break }
    }
  } finally {
    if (total > 0) await qc.invalidateQueries({ queryKey: [...CHAVE_LEADS] })
  }

  return { total, restantes, mensagem }
}
