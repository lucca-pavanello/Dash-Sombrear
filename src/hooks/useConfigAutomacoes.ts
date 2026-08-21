import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Chaves de `config_automacoes` — o liga/desliga das automações do n8n, sem abrir
 * workflow. Escrita protegida por RLS (só admin). Usa a MESMA queryKey do
 * FollowupControle de propósito: os dois leem a tabela inteira, então alternar uma
 * chave num lugar já atualiza o outro.
 */
export const IA_RESPONDE = 'ia_responde'

export function useConfigAutomacoes() {
  return useQuery({
    queryKey: ['config-automacoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('config_automacoes').select('chave, valor')
      if (error) throw error
      return Object.fromEntries(
        (data as { chave: string; valor: string }[]).map((c) => [c.chave, c.valor]),
      ) as Record<string, string>
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export function useDefinirConfigAutomacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: string }) => {
      const { data: sess } = await supabase.auth.getSession()
      const { error } = await supabase
        .from('config_automacoes')
        .update({
          valor,
          atualizado_em: new Date().toISOString(),
          atualizado_por: sess.session?.user?.email ?? null,
        })
        .eq('chave', chave)
      if (error) throw error
    },
    onSuccess: (_r, { chave, valor }) => {
      qc.setQueryData(['config-automacoes'], (prev: Record<string, string> | undefined) =>
        ({ ...(prev ?? {}), [chave]: valor }))
    },
  })
}
