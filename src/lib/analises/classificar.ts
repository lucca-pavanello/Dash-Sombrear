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
      if (error) throw new Error(error.message)
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
