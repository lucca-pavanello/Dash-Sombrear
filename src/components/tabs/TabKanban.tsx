import { useMemo, useState } from 'react'
import { Kanban } from 'lucide-react'
import type { Orcamento } from '@/lib/supabase'
import { RESPONSAVEIS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import KanbanBoard from '@/components/kanban/KanbanBoard'

interface Props {
  data: Orcamento[]
  loading: boolean
  toast: (type: 'success' | 'error', message: string) => void
}

export default function TabKanban({ data, loading, toast }: Props) {
  const [responsavel, setResponsavel] = useState<string>('todos')

  const filtered = useMemo(() => {
    if (responsavel === 'todos') return data
    return data.filter(o => o.responsavel === responsavel)
  }, [data, responsavel])

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Kanban className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-semibold">Kanban de Orçamentos</h2>
          <span className="text-xs text-muted-foreground">— arraste os cards para mover entre etapas</span>
        </div>

        {/* Filtro responsável */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium">Responsável:</label>
          <select
            value={responsavel}
            onChange={e => setResponsavel(e.target.value)}
            className="rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 ring-ring focus:border-primary transition-all"
          >
            <option value="todos">Todos</option>
            {RESPONSAVEIS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : (
        <KanbanBoard data={filtered} toast={toast} />
      )}

      <p className={cn('mt-4 text-center text-xs text-muted-foreground/50 hidden md:block')}>
        Dica: pressione e arraste um card para movê-lo entre as etapas
      </p>
    </div>
  )
}
