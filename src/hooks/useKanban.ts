import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Orcamento } from '@/lib/supabase'
import { type KanbanStatus, kanbanStatusToFields } from '@/lib/kanban'

export function useUpdateKanbanStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: KanbanStatus }) => {
      const fields = kanbanStatusToFields(status)
      const { data, error } = await supabase
        .from('orcamentos')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Orcamento
    },
    // Optimistic update — card move é instantâneo na UI
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['orcamentos'] })
      const prev = qc.getQueryData<Orcamento[]>(['orcamentos'])
      qc.setQueryData<Orcamento[]>(['orcamentos'], (old = []) =>
        old.map(o => o.id === id ? { ...o, ...kanbanStatusToFields(status) } : o)
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['orcamentos'], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

export function useToggleShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .update({ share_enabled: enabled })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Orcamento
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

export function useOrcamentoPublico(id: string | undefined) {
  return useQuery({
    queryKey: ['orcamento-publico', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não informado')
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('id', id)
        .eq('share_enabled', true)
        .single()
      if (error) throw error
      return data as Orcamento
    },
    enabled: !!id,
    retry: false,
  })
}
