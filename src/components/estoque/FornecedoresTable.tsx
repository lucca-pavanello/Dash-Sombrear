import { useState, useMemo } from 'react'
import { Search, Plus, Pencil, Truck, Clock, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEstoqueFornecedores, useUpdateFornecedor } from '@/hooks/useEstoqueFornecedores'
import NovoFornecedorForm from './NovoFornecedorForm'
import { tbl } from './shared/tableStyles'
import { FilterPopover, isFilterActive } from './shared/FilterPopover'
import { FiltrosAtivosChips } from './shared/FiltrosAtivosChips'
import type { RangeState } from './shared/FilterPopover'
import type { EstoqueFornecedor } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

const FILTER_TYPES: Record<string, 'multi' | 'range' | 'text'> = {
  prazo_entrega: 'range',
}

const CHIP_LABELS: Record<string, string> = {
  prazo_entrega: 'Prazo entrega',
}

interface Props {
  toast: (type: ToastType, message: string) => void
}

export default function FornecedoresTable({ toast }: Props) {
  const [search, setSearch] = useState('')
  const [filtros, setFiltros] = useState<Record<string, unknown>>({})
  const [openFilter, setOpenFilter] = useState<{ key: string; rect: DOMRect } | null>(null)
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
        const state = filtros['prazo_entrega'] as RangeState | undefined
        if (!state) return true
        const { min, max, apenasZerados, incluirVazios } = state
        const hasMin = min !== '' && min !== undefined
        const hasMax = max !== '' && max !== undefined
        const isActive = hasMin || hasMax || apenasZerados
        if (!isActive) return true

        const dias = f.prazo_entrega_dias
        if (apenasZerados) return !dias || dias === 0
        if (!dias || dias === 0) return incluirVazios ?? false
        if (hasMin && dias < Number(min)) return false
        if (hasMax && dias > Number(max)) return false
        return true
      })
  }, [fornecedores, search, filtros])

  function setFiltro(col: string, val: unknown) {
    setFiltros(prev => ({ ...prev, [col]: val }))
  }

  function handleRemoveChip(colKey: string) {
    setFiltros(prev => { const c = { ...prev }; delete c[colKey]; return c })
  }

  function toggleFilter(key: string, e: React.MouseEvent<HTMLTableCellElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setOpenFilter(prev => prev?.key === key ? null : { key, rect })
  }

  function handleNovo() { setEditando(null); setFormOpen(true) }
  function handleEditar(f: EstoqueFornecedor) { setEditando(f); setFormOpen(true) }

  async function handleDesativar(f: EstoqueFornecedor) {
    try {
      await updateMutation.mutateAsync({ id: f.id, ativo: false })
      toast('success', `Fornecedor "${f.nome}" removido.`)
    } catch {
      toast('error', 'Erro ao remover fornecedor.')
    }
  }

  const hasFilters = Object.values(filtros).some(v => v && isFilterActive('range', v))

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pb-3 justify-center">
        <div className={tbl.searchWrap}>
          <Search className={tbl.searchIcon} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar fornecedor por nome, contato ou CNPJ..."
            className={tbl.searchInput}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none self-center">
          <button
            type="button" role="switch" aria-checked={mostrarInativos}
            onClick={() => setMostrarInativos(v => !v)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              mostrarInativos ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
          >
            <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
              mostrarInativos ? 'translate-x-[18px]' : 'translate-x-0.5')} />
          </button>
          <span className="text-sm text-muted-foreground">Mostrar inativos</span>
        </label>
        <button onClick={handleNovo} className={cn(tbl.addBtn, 'w-full sm:w-auto justify-center')}>
          <Plus className="h-4 w-4" />
          Novo Fornecedor
        </button>
      </div>

      {/* ── Chips ── */}
      <FiltrosAtivosChips
        filtros={filtros}
        filterTypes={FILTER_TYPES}
        labels={CHIP_LABELS}
        onRemove={handleRemoveChip}
        onClearAll={() => setFiltros({})}
      />

      {/* Table */}
      <div className={tbl.container}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '640px' }}>
            <thead>
              <tr className={tbl.theadRow}>
                <th className={tbl.th}>Fornecedor / Contato</th>
                <th className={tbl.th}>Telefone</th>
                <th className={tbl.th}>CNPJ</th>
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group')}
                  onClick={e => toggleFilter('prazo_entrega', e)}
                >
                  <div className="flex items-center justify-between gap-1.5 w-full">
                    <span>Prazo entrega</span>
                    <Filter className={cn('h-3 w-3 shrink-0 transition-colors',
                      isFilterActive('range', filtros['prazo_entrega'])
                        ? 'text-primary fill-primary/30'
                        : 'text-muted-foreground/30 group-hover:text-muted-foreground/60'
                    )} />
                  </div>
                  <FilterPopover
                    open={openFilter?.key === 'prazo_entrega'}
                    anchorRect={openFilter?.key === 'prazo_entrega' ? openFilter.rect : null}
                    label="Prazo entrega" hint="Dias corridos até a entrega do pedido."
                    filterType="range"
                    rangeOpts={{ showIncluirVazios: true, incluirVaziosLabel: 'Incluir sem prazo definido' }}
                    value={filtros['prazo_entrega'] ?? {}}
                    onChange={v => setFiltro('prazo_entrega', v)}
                    onClose={() => setOpenFilter(null)}
                  />
                </th>
                <th className={cn(tbl.th, 'border-r-0')}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-lg skeleton-shimmer" />)}
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
                      <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Fornecedor" para começar</p>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map(f => (
                  <tr key={f.id} className={tbl.tbodyRow}>
                    <td className={tbl.td}>
                      <p className="font-semibold text-foreground">{f.nome}</p>
                      {f.contato && <p className="text-xs text-muted-foreground">{f.contato}</p>}
                      {f.email && <p className="text-xs text-muted-foreground/60">{f.email}</p>}
                    </td>
                    <td className={cn(tbl.td, 'text-muted-foreground whitespace-nowrap')}>{f.telefone ?? '—'}</td>
                    <td className={cn(tbl.td, 'font-mono text-xs text-muted-foreground whitespace-nowrap')}>{f.cnpj ?? '—'}</td>
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
                    <td className={tbl.actionTd}>
                      <div className={cn(tbl.actionGroup, 'justify-center')}>
                        <button onClick={() => handleEditar(f)} title="Editar"
                          className={cn(tbl.actionBtn, 'hover:text-foreground hover:bg-muted/60')}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDesativar(f)} title="Remover"
                          disabled={updateMutation.isPending}
                          className={cn(tbl.actionBtn, 'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50')}>
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

      <NovoFornecedorForm open={formOpen} onClose={() => setFormOpen(false)} toast={toast} editando={editando} />
    </>
  )
}
