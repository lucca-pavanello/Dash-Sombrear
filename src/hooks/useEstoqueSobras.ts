import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Sobras: peça pronta que sobrou de produção e não vai ser refeita.
 *
 * Não confundir com `estoque_produtos`, que é saldo escalar de insumo de compra. Aqui
 * cada linha é UMA peça específica, com largura e altura próprias, que existe uma vez só
 * — por isso não tem quantidade: vender é mudar o status, não decrementar.
 */
export type StatusSobra = 'disponivel' | 'reservada' | 'vendida'

export type EstoqueSobra = {
  id: string
  created_at: string
  updated_at: string
  familia: string
  /** '1%' | '3%' | '5%' — só Tela Solar tem; nas outras famílias é null */
  abertura: string | null
  cor: string
  largura_m: number
  altura_m: number
  /** calculada pelo banco (coluna gerada) — nunca recalcular na tela */
  area_m2: number
  status: StatusSobra
  observacao: string | null
  /** folha/página de onde veio na transcrição — serve pra auditar a leitura das fotos */
  origem: string | null
  vendida_em: string | null
  user_id: string | null
}

export function useEstoqueSobras({ incluirVendidas = false } = {}) {
  return useQuery({
    queryKey: ['estoque-sobras', incluirVendidas],
    queryFn: async () => {
      let q = supabase
        .from('estoque_sobras')
        .select('*')
        .order('familia')
        .order('cor')
        .order('area_m2', { ascending: false })
      // o vendedor quer ver o que dá pra vender; vendida/reservada só sob pedido
      if (!incluirVendidas) q = q.eq('status', 'disponivel')
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as EstoqueSobra[]
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

type SobraPayload = Omit<
  EstoqueSobra,
  'id' | 'created_at' | 'updated_at' | 'area_m2' | 'user_id'
>

export function useAddSobra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<SobraPayload>) => {
      const { data, error } = await supabase.from('estoque_sobras').insert(payload).select().single()
      if (error) throw error
      return data as EstoqueSobra
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-sobras'] }),
  })
}

export function useUpdateSobra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<SobraPayload> & { id: string }) => {
      const { data, error } = await supabase
        .from('estoque_sobras')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as EstoqueSobra
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-sobras'] }),
  })
}

/**
 * Marcar como vendida/reservada é o gesto mais frequente da tela, então tem atalho
 * próprio. Ao vender, carimba a data — sem isso não dá pra saber depois quanto tempo a
 * peça ficou parada, que é o número que diz se vale a pena continuar guardando sobra.
 */
export function useDefinirStatusSobra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusSobra }) => {
      const { error } = await supabase
        .from('estoque_sobras')
        .update({
          status,
          vendida_em: status === 'vendida' ? new Date().toISOString().slice(0, 10) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estoque-sobras'] }),
  })
}

/* ── Vocabulário ─────────────────────────────────────────────────────────────
   Os valores vieram da transcrição do caderno e das folhas da loja. Ficam aqui e não
   numa tabela do banco porque mudam raramente e porque o formulário precisa deles como
   sugestão, não como camisa de força: o campo aceita texto livre, então um tecido novo
   entra sem migration. */
export const FAMILIAS_SOBRA = [
  'Tela Solar',
  'Blackout',
  'Blackout Linho',
  'Blackout Napoles',
  'Double Vision',
  'Pinpoint',
  'Translúcido',
  'Palha',
] as const

export const ABERTURAS_SOBRA = ['1%', '3%', '5%'] as const

export const CORES_SOBRA = [
  'Bege', 'Branco', 'Cinza', 'Preto', 'Creme', 'Linho', 'Marrom', 'Gelo', 'Palha',
] as const

export const STATUS_SOBRA: Record<StatusSobra, { rotulo: string; cor: string }> = {
  disponivel: { rotulo: 'Disponível', cor: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  reservada:  { rotulo: 'Reservada',  cor: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  vendida:    { rotulo: 'Vendida',    cor: 'border-border bg-muted/60 text-muted-foreground' },
}

/** "Tela Solar 3% Bege" — o nome que a loja usa falando, montado das partes. */
export function nomeSobra(s: Pick<EstoqueSobra, 'familia' | 'abertura' | 'cor'>): string {
  return [s.familia, s.abertura, s.cor].filter(Boolean).join(' ')
}
