import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { acharRegraPreco, precoDoAnuncio } from '@/lib/precoMl'

// a conta de dinheiro vive em lib/precoMl.ts (pura e testável); aqui só se reexporta
// pra quem consome o hook não precisar saber de dois lugares
export { precoDoAnuncio }
export const acharPrecoMl = acharRegraPreco

/**
 * Preço das sobras no Mercado Livre.
 *
 * Tabela separada das ~25 `precos_*` de propósito: aquelas calculam venda sob medida a
 * partir de vão + modelo + markup. Sobra é peça pronta com preço de liquidação, que não
 * sai de fórmula — quem define é a loja.
 *
 * Regra do valor: `max(area_m2 × preco_m2, preco_minimo)`. O piso existe porque peça
 * pequena não pode sair por um valor que não paga a comissão do ML nem o trabalho de
 * embalar e despachar.
 */
export type PrecoMl = {
  id: string
  created_at: string
  updated_at: string
  familia: string
  abertura: string | null
  /** null = vale para todas as cores dessa família/abertura */
  cor: string | null
  preco_m2: number
  preco_minimo: number
  ativo: boolean
  atualizado_por: string | null
}

export function usePrecosMl() {
  return useQuery({
    queryKey: ['precos-ml'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_ml')
        .select('*')
        .order('familia')
        .order('abertura', { nullsFirst: true })
        .order('cor', { nullsFirst: true })
      if (error) throw error
      return (data ?? []) as PrecoMl[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

type PrecoPayload = Omit<PrecoMl, 'id' | 'created_at' | 'updated_at'>

export function useSalvarPrecoMl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PrecoPayload> & { id?: string }) => {
      const { data: sess } = await supabase.auth.getSession()
      const corpo = {
        ...payload,
        atualizado_por: sess.session?.user?.email ?? null,
        updated_at: new Date().toISOString(),
      }
      const q = id
        ? supabase.from('precos_ml').update(corpo).eq('id', id)
        : supabase.from('precos_ml').insert(corpo)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['precos-ml'] }),
  })
}

export function useExcluirPrecoMl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('precos_ml').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['precos-ml'] }),
  })
}
