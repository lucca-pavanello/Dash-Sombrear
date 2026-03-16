import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { supabase, type Orcamento } from '@/lib/supabase'

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

export function useOrcamentos(onInsert?: (record: Orcamento) => void) {
  const qc = useQueryClient()
  const onInsertRef = useRef(onInsert)
  onInsertRef.current = onInsert
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let destroyed = false

    supabase.auth.getUser().then(({ data: authData }) => {
      if (destroyed) return
      const userId = authData.user?.id ?? null
      currentUserIdRef.current = userId

      // Não abre subscription sem userId — evita escutar dados de todos os usuários
      if (!userId) return

      const filter = `user_id=eq.${userId}`

      channel = supabase
        .channel('orcamentos-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orcamentos',
            filter,
          },
          (payload) => {
            // Client-side fallback check (belt-and-suspenders)
            const eventUserId = (payload.new as Record<string, unknown>)?.user_id
              ?? (payload.old as Record<string, unknown>)?.user_id
            if (currentUserIdRef.current && eventUserId && eventUserId !== currentUserIdRef.current) return

            qc.invalidateQueries({ queryKey: ['orcamentos'] })
            if (payload.eventType === 'INSERT') {
              playNotificationSound()
              onInsertRef.current?.(payload.new as Orcamento)
            }
          },
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') console.error('[useOrcamentos] realtime error:', err)
        })
    })

    return () => {
      destroyed = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [qc])

  return useQuery({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Orcamento[]
    },
  })
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
        .select('valor_venda, instacao, created_at')
        .eq('fechado', true)
        .gte('created_at', firstOfLastMonth)

      const currentMonth = (data ?? [])
        .filter((o) => new Date(o.created_at) >= new Date(firstOfThisMonth))
        .reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)

      const previousMonth = (data ?? [])
        .filter((o) => new Date(o.created_at) < new Date(firstOfThisMonth))
        .reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0)

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
        .limit(5)
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
