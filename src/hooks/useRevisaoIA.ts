/**
 * Revisão diária da Amanda (tabela `revisoes_ia`, migração 0030).
 *
 * A linha nasce 'rodando' e a Edge Function a fecha minutos depois, então a lista
 * se repete sozinha enquanto houver alguma em curso — e só enquanto houver: o resto
 * do tempo ela não fica batendo no banco à toa.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Gravidade, Melhoria, SemResposta } from '@/lib/revisao/dia'

export type ResultadoRevisao = {
  dia: string
  conversas: number
  amostra: { conversa: string; lead_id: string | null; conversa_id: number; nome: string | null }[]
  sem_resposta: SemResposta[]
  analise: { resumo: string; melhorias: Melhoria[] }
  gerado_em: string
}

export type RevisaoIA = {
  id: string
  dia: string
  origem: 'diaria' | 'manual'
  status: 'rodando' | 'pronta' | 'erro'
  erro: string | null
  resultado: ResultadoRevisao | null
  criado_em: string
  concluido_em: string | null
}

export const CHAVE_REVISOES = ['revisoes-ia'] as const

export function useRevisoes() {
  return useQuery({
    queryKey: [...CHAVE_REVISOES],
    queryFn: async (): Promise<RevisaoIA[]> => {
      const { data, error } = await supabase.from('revisoes_ia')
        .select('id, dia, origem, status, erro, resultado, criado_em, concluido_em')
        .order('dia', { ascending: false })
        .order('criado_em', { ascending: false })
        .limit(30)
      if (error) throw new Error(error.message)
      return (data ?? []) as RevisaoIA[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
    // de 6 em 6 segundos só enquanto alguma estiver sendo escrita
    refetchInterval: (q) =>
      (q.state.data as RevisaoIA[] | undefined)?.some(r => r.status === 'rodando') ? 6000 : false,
  })
}

export function usePedirRevisao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dia?: string) => {
      const { data, error } = await supabase.functions.invoke('revisao-diaria', {
        body: dia ? { dia } : {},
      })
      if (error) throw new Error(await motivo(error))
      const r = data as { ok?: boolean; id?: string; error?: string }
      if (r?.error) throw new Error(r.error)
      return r
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...CHAVE_REVISOES] }),
  })
}

/** o corpo do erro traz o motivo; `invoke` sozinho só diria "non-2xx status code" */
async function motivo(error: unknown): Promise<string> {
  const corpo = (error as { context?: Response }).context
  if (corpo && typeof corpo.json === 'function') {
    try {
      const j = await corpo.json()
      if (j?.error) return String(j.error)
    } catch { /* não era JSON */ }
  }
  return error instanceof Error ? error.message : 'Não consegui pedir a revisão.'
}

export const ROTULO_GRAVIDADE: Record<Gravidade, string> = {
  alta: 'Mais importante',
  media: 'Vale ajustar',
  baixa: 'Detalhe',
}
