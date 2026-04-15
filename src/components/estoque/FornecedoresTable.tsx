import { useState, useMemo } from 'react'
import { Search, Plus, Pencil, Truck, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEstoqueFornecedores, useUpdateFornecedor } from '@/hooks/useEstoqueFornecedores'
import NovoFornecedorForm from './NovoFornecedorForm'
import { tbl } from './shared/tableStyles'
import { FilterPopover } from './shared/FilterPopover'
import { FiltrosAtivosChips } from './shared/FiltrosAtivosChips'
import type { EstoqueFornecedor } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

const LEAD_TIME_OPTIONS = [
  { value: 'rapido',      label: 'Rápido (até 7 dias)' },
  { value: 'medio',       label: 'Médio (8 a 15 dias)' },
  { value: 'longo',       label: 'Longo (mais de 15 dias)' },
  { value: 'sem_definir', label: 'Sem definir' },
]

const LEAD_TIME_LABELS: Record<string, string> = {
  rapido:      'Rápido (≤7d)',
  medio:       'Médio (8-15d)',
  longo:       'Longo (>15d)',
  sem_definir: 'Sem definir',
}

const CHIP_LABELS: Record<string, string> = { lead_time: 'Lead time' }
const CHIP_FORMAT: Record<string, (v: string) => string> = {
  lead_time: (v) => LEAD_TIME_LABELS[v] ?? v,
}

function getLeadTimeCategoria(dias: number | null | undefined): string {
  if (!dias || dias === 0) return 'sem_definir'
  if (dias <= 7)  return 'rapido'
  if (dias <= 15) return 'medio'
  return 'longo'
}

interface Props {
  toast: (type: ToastType, message: string) => void
}

export default function FornecedoresTable({ toast }: Props) {
  const [search, setSearch] = useState('')
  const [filtros, setFiltros] = useState<Record<string, string[]>>({})
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<EstoqueFornecedor | null>(null)

  const { data: fornecedores = [], isLoading } = useEstoqueFornecedores({ includeInactive: mostrarInativos })
  const updateMutation = useUpdateFornecedor()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return fornecedores
      .filter(f =>
        !q ||
        f.nome.toLowerCase().includes(q) ||
        (f.contato?.toLowerCase().includes(q) ?? false) ||
        (f.cnpj?.includes(q) ?? false),
      )
      .filter(f => {
        const leadTimes = filtros['lead_time'] ?? []
        if (leadTimes.length === 0) return true
        return leadTimes.includes(getLeadTimeCategoria(f.prazo_entrega_dias))
      })
  }, [fornecedores, search, filtros])

  function setFiltro(col: string, vals: string[]) {
    setFiltros(prev => ({ ...prev, [col]: vals }))
  }

  function removeFiltro(col: string, val: string) {
    setFiltros(prev => ({ ...prev, [col]: (prev[col] ?? []).filter(v => v !== val) }))
  }

  function handleNovo() {
    setEditando(null)
    setFormOpen(true)
  }

  function handleEditar(f: EstoqueFornecedor) {
    setEditando(f)
    setFormOpen(true)
  }

  async function handleDesativar(f: EstoqueFornecedor) {
    try {
      await updateMutation.mutateAsync({ id: f.id, ativo: false })
      toast('success', `Fornecedor "${f.nome}" removido.`)
    } catch {
      toast('error', 'Erro ao remover fornecedor.')
    }
  }

  const hasFilters = Object.values(filtros).some(v => v.length > 0)

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pb-3 justify-center">
        <div className={tbl.searchWrap}>
          <Search className={tbl.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fornecedor por nome, contato ou CNPJ..."
            className={tbl.searchInput}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none self-center">
          <button
            type="button"
            role="switch"
            aria-checked={mostrarInativos}
            onClick={() => setMostrarInativos(v => !v)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              mostrarInativos ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
          >
            <span className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
              mostrarInativos ? 'translate-x-[18px]' : 'translate-x-0.5',
            )} />
          </button>
          <span className="text-sm text-muted-foreground">Mostrar inativos</span>
        </label>
        <button onClick={handleNovo} className={cn(tbl.addBtn, 'w-full sm:w-auto justify-center')}>
          <Plus className="h-4 w-4" />
          Novo Fornecedor
        </button>
      </div>

      {/* ── Chips de filtros ativos ── */}
      <FiltrosAtivosChips
        filtros={filtros}
        labels={CHIP_LABELS}
        formatLabel={CHIP_FORMAT}
        onRemove={removeFiltro}
        onClearAll={() => setFiltros({})}
      />

      {/* Table */}
      <div className={tbl.container}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '640px' }}>
            <thead>
              <tr className={tbl.theadRow}>
                <th className={cn(tbl.th, 'text-center')}>Fornecedor / Contato</th>
                <th className={cn(tbl.th, 'text-center')}>Telefone</th>
                <th className={cn(tbl.th, 'text-center')}>CNPJ</th>
                <th className={cn(tbl.th, 'text-center')}>
                  <FilterPopover
                    label="Prazo entrega"
                    options={LEAD_TIME_OPTIONS}
                    selected={filtros['lead_time'] ?? []}
                    onChange={(v) => setFiltro('lead_time', v)}
                  />
                </th>
                <th className={cn(tbl.th, 'text-center border-r-0')}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-14 rounded-lg skeleton-shimmer" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {search || hasFilters ? 'Nenhum fornecedor com esse filtro. Tente outra combinação.' : 'Nenhum fornecedor cadastrado'}
                    </p>
                    {!search && (
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Clique em "Novo Fornecedor" para começar
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((f) => (
                  <tr key={f.id} className={tbl.tbodyRow}>
                    {/* Nome + contato */}
                    <td className={tbl.td}>
                      <p className="font-semibold text-foreground">{f.nome}</p>
                      {f.contato && (
                        <p className="text-xs text-muted-foreground">{f.contato}</p>
                      )}
                      {f.email && (
                        <p className="text-xs text-muted-foreground/60">{f.email}</p>
                      )}
                    </td>

                    {/* Telefone */}
                    <td className={cn(tbl.td, 'text-muted-foreground whitespace-nowrap')}>
                      {f.telefone ?? '—'}
                    </td>

                    {/* CNPJ */}
                    <td className={cn(tbl.td, 'font-mono text-xs text-muted-foreground whitespace-nowrap')}>
                      {f.cnpj ?? '—'}
                    </td>

                    {/* Prazo */}
                    <td className={cn(tbl.td, 'text-center')}>
                      {f.prazo_entrega_dias != null ? (
                        <span className="inline-flex items-center justify-end gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {f.prazo_entrega_dias} {f.prazo_entrega_dias === 1 ? 'dia' : 'dias'}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className={tbl.actionTd}>
                      <div className={cn(tbl.actionGroup, 'justify-center')}>
                        <button
                          onClick={() => handleEditar(f)}
                          title="Editar"
                          className={cn(tbl.actionBtn, 'hover:text-foreground hover:bg-muted/60')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDesativar(f)}
                          title="Remover"
                          disabled={updateMutation.isPending}
                          className={cn(tbl.actionBtn, 'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50')}
                        >
                          <span className="text-xs font-bold leading-none">✕</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className={tbl.tfootRow}>
                  <td colSpan={5} className={tbl.tfootCell}>
                    Total — {filtered.length} fornecedor{filtered.length !== 1 ? 'es' : ''}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <NovoFornecedorForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        toast={toast}
        editando={editando}
      />
    </>
  )
}
