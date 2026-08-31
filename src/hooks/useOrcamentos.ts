import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { supabase, type Orcamento, type Pedido } from '@/lib/supabase'
import { inicioDaJanela, useJanela } from '@/lib/janelaDados'

export type RealtimeStatus = 'connecting' | 'connected' | 'error'

export type HistoricoEntry = {
  id: string
  orcamento_id: string
  changed_at: string
  changed_by: string
  snapshot: Record<string, unknown>
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch { /* browser pode bloquear sem interação prévia */ }
}

export function useOrcamentos(
  onInsert?: (record: Orcamento) => void,
  onUpdate?: () => void,
) {
  const qc = useQueryClient()
  const onInsertRef = useRef(onInsert)
  onInsertRef.current = onInsert
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const currentUserIdRef = useRef<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let destroyed = false

    supabase.auth.getUser().then(({ data: authData }) => {
      if (destroyed) return
      const userId = authData.user?.id ?? null
      currentUserIdRef.current = userId

      // Sem sessão não abre subscription (a RLS bloquearia tudo mesmo)
      if (!userId) return

      channel = supabase
        .channel('orcamentos-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orcamentos',
            // SEM filtro por user_id de propósito: 492 dos 498 orçamentos em
            // produção (13/08/2026) vêm do n8n com user_id NULO, então o filtro
            // antigo silenciava exatamente os que mais importam chegar na hora.
            // Quem pode ver o quê já é decidido pela RLS da tabela.
          },
          (payload) => {
            qc.invalidateQueries({ queryKey: ['orcamentos'] })
            if (payload.eventType === 'INSERT') {
              playNotificationSound()
              onInsertRef.current?.(payload.new as Orcamento)
            } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
              onUpdateRef.current?.()
            }
          },
        )
        .subscribe((status, err) => {
          if (destroyed) return
          if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRealtimeStatus('error')
            console.error('[useOrcamentos] realtime error:', err)
          }
        })
    })

    return () => {
      destroyed = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [qc])

  const janela = useJanela()

  const query = useQuery({
    queryKey: ['orcamentos', janela],
    queryFn: async () => {
      // Busca limitada por período no servidor (src/lib/janelaDados.ts) e
      // paginada: o PostgREST devolve no máximo 1.000 linhas por resposta e
      // NÃO avisa que cortou — sem paginar, o dash esconderia os mais antigos
      // em silêncio assim que a loja passasse desse volume.
      const desde = inicioDaJanela(janela)
      const PAGINA = 1000
      const todos: Orcamento[] = []
      for (let inicio = 0; ; inicio += PAGINA) {
        let q = supabase
          .from('orcamentos')
          .select('*')
          .order('created_at', { ascending: false })
          .range(inicio, inicio + PAGINA - 1)
        if (desde) q = q.gte('created_at', desde)
        const { data, error } = await q
        if (error) throw error
        const lote = (data ?? []) as Orcamento[]
        todos.push(...lote)
        if (lote.length < PAGINA) break
      }
      /* O harness de QA grava 8 orçamentos de mentira (cliente QA_HARNESS)
         toda vez que roda — 7h todo dia — e só apaga uns 4 minutos depois,
         quando termina de conferir. Nessa janela eles apareceriam na fila do
         Acompanhar, nos KPIs e no faturamento como se fossem clientes. */
      return todos.filter(o => o.cliente !== 'QA_HARNESS')
    },
    // Polling de fallback. A publication supabase_realtime já inclui
    // `orcamentos` (conferido em 13/08/2026), então com o canal conectado o
    // polling é só rede de segurança e pode ser espaçado; se o canal cair,
    // ele volta a ser o mecanismo real de atualização.
    refetchInterval: realtimeStatus === 'connected' ? 120000 : 30000,
  })
  return { ...query, realtimeStatus, janela }
}

export function useMonthlyComparison() {
  return useQuery({
    queryKey: ['orcamentos-monthly-comparison'],
    queryFn: async () => {
      // Datas calculadas dentro do queryFn para serem atualizadas a cada refetch
      // (evita virada de mês silenciosa se a página ficar aberta por horas)
      const now = new Date()
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

      const { data } = await supabase
        .from('orcamentos')
        .select('valor_venda, instalacao, created_at')
        .eq('fechado', true)
        .gte('created_at', firstOfLastMonth)

      const currentMonth = (data ?? [])
        .filter((o) => new Date(o.created_at) >= new Date(firstOfThisMonth))
        .reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)

      const previousMonth = (data ?? [])
        .filter((o) => new Date(o.created_at) < new Date(firstOfThisMonth))
        .reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)

      return { currentMonth, previousMonth }
    },
    refetchInterval: 60000,
  })
}

export function useAddOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Orcamento, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('orcamentos').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

export function useUpdateOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Orcamento> & { id: string }) => {
      const { data, error } = await supabase.from('orcamentos').update(payload).eq('id', id).select().single()
      if (error) {
        console.error('[useUpdateOrcamento] Supabase error:', error)
        throw error
      }
      return data as Orcamento
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

export function useDeleteOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orcamentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

/**
 * Metadados de pedido (numero_pedido/data_pedido/origem/forma de pagamento)
 * que agrupam itens de `orcamentos` pelo campo `pedido_id`. Dinheiro nunca
 * mora aqui — cada item continua com seu valor_cobrado/valor_parceiro_pago.
 */
export function usePedidos() {
  return useQuery({
    queryKey: ['pedidos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pedidos').select('*')
      if (error) throw error
      return (data ?? []) as Pedido[]
    },
    staleTime: 30_000,
  })
}

export function useCreatePedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Pedido, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('pedidos').insert(payload).select().single()
      if (error) throw error
      return data as Pedido
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
  })
}

export function useUpdatePedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Pedido> & { id: string }) => {
      const { data, error } = await supabase.from('pedidos').update(payload).eq('id', id).select().single()
      if (error) throw error
      return data as Pedido
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['orcamentos'] })
    },
  })
}

/** Vincula um conjunto de itens soltos (ou de pedidos diferentes) a um pedido novo, de uma vez. */
export function useVincularItensAoPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, pedido }: { ids: string[]; pedido: Omit<Pedido, 'id' | 'created_at'> }) => {
      const { data: novo, error: erroPedido } = await supabase.from('pedidos').insert(pedido).select().single()
      if (erroPedido) throw erroPedido
      const { error: erroVinculo } = await supabase
        .from('orcamentos').update({ pedido_id: novo.id }).in('id', ids)
      if (erroVinculo) throw erroVinculo
      return novo as Pedido
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['orcamentos'] })
    },
  })
}

/** Apaga um pedido inteiro: cada item vai pra lixeira (orcamentos_excluidos) antes de sumir. */
export function useExcluirPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pedidoId, itens }: { pedidoId: string; itens: Orcamento[] }) => {
      const { data: perfil } = await supabase.auth.getUser()
      for (const item of itens) {
        const { error: erroLixeira } = await supabase.from('orcamentos_excluidos').insert({
          orcamento_id: item.id,
          excluido_por: perfil?.user?.email ?? null,
          motivo: 'pedido excluído pelo Semanário',
          dados: item,
        })
        if (erroLixeira) throw erroLixeira
        const { error } = await supabase.from('orcamentos').delete().eq('id', item.id)
        if (error) throw error
      }
      const { error: erroPedido } = await supabase.from('pedidos').delete().eq('id', pedidoId)
      if (erroPedido) throw erroPedido
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['orcamentos'] })
    },
  })
}

export function useOrcamentoHistorico(orcamentoId: string | null) {
  return useQuery({
    queryKey: ['orcamento-historico', orcamentoId],
    queryFn: async () => {
      if (!orcamentoId) return [] as HistoricoEntry[]
      const { data, error } = await supabase
        .from('orcamento_historico')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('changed_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as HistoricoEntry[]
    },
    enabled: !!orcamentoId,
  })
}

export function useAddHistorico() {
  return useMutation({
    mutationFn: async ({ orcamento_id, snapshot }: { orcamento_id: string; snapshot: object }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const changed_by = user?.email ?? 'desconhecido'
      const { error } = await supabase
        .from('orcamento_historico')
        .insert({ orcamento_id, changed_by, snapshot })
      if (error) throw error
    },
  })
}
