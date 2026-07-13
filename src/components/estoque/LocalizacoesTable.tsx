import { useState, useMemo, useEffect } from 'react'
import { Search, Plus, Pencil, MapPin, Filter, Download, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { exportCsv, exportXlsx } from '@/lib/exportUtils'
import { cn } from '@/lib/utils'
import { useEstoqueLocalizacoes, useUpdateLocalizacao } from '@/hooks/useEstoqueLocalizacoes'
import { NIVEIS_ACESSO } from '@/lib/constants'
import NovaLocalizacaoForm from './NovaLocalizacaoForm'
import { tbl } from './shared/tableStyles'
import { FilterPopover, isFilterActive } from './shared/FilterPopover'
import { FiltrosAtivosChips } from './shared/FiltrosAtivosChips'
import type { RangeState } from './shared/FilterPopover'
import type { EstoqueLocalizacao } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

const NIVEL_OPTIONS = [
  { value: 'balcao',    label: 'Balcão' },
  { value: 'acessivel', label: 'Acessível' },
  { value: 'medio',     label: 'Médio' },
  { value: 'fundo',     label: 'Fundo' },
  { value: 'deposito',  label: 'Depósito' },
]

const FILTER_TYPES: Record<string, 'multi' | 'range' | 'text'> = {
  setor:      'multi',
  prateleira: 'multi',
  nivel:      'multi',
  num_produtos: 'range',
}

const CHIP_LABELS: Record<string, string> = {
  setor:        'Setor',
  prateleira:   'Prateleira',
  nivel:        'Nível',
  num_produtos: 'Nº Produtos',
}

const CHIP_FORMAT: Record<string, (v: string) => string> = {
  nivel: (v) => NIVEIS_ACESSO[v] ?? v,
}

interface Props {
  toast: (type: ToastType, message: string) => void
}

const PAGE_SIZE = 50

const FILTER_KEY = 'sombrear-estoque-localizacoes-filtros'
function loadLocalizacaoFilters() {
  try { const s = localStorage.getItem(FILTER_KEY); return s ? JSON.parse(s) : {} } catch { return {} }
}

const SORT_KEY_L = 'sombrear-estoque-localizacoes-sort'
type SortKeyL = 'codigo' | 'setor'

export default function LocalizacoesTable({ toast }: Props) {
  const [search, setSearch] = useState(() => { try { return localStorage.getItem(FILTER_KEY + '-search') ?? '' } catch { return '' } })
  const [filtros, setFiltros] = useState<Record<string, unknown>>(loadLocalizacaoFilters)
  const [openFilter, setOpenFilter] = useState<{ key: string; rect: DOMRect } | null>(null)
  const [mostrarInativas, setMostrarInativas] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<EstoqueLocalizacao | null>(null)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: SortKeyL; dir: 'asc' | 'desc' }>(() => {
    try {
      const s = localStorage.getItem(SORT_KEY_L)
      return s ? JSON.parse(s) : { key: 'codigo', dir: 'asc' }
    } catch { return { key: 'codigo', dir: 'asc' } }
  })

  const { data: localizacoes = [], isLoading } = useEstoqueLocalizacoes({ includeInactive: mostrarInativas })
  const updateMutation = useUpdateLocalizacao()

  const setorOptions = useMemo(() => {
    const unique = [...new Set(localizacoes.map(l => l.setor))].sort()
    return unique.map(s => ({ value: s, label: s }))
  }, [localizacoes])

  const prateleiraOptions = useMemo(() => {
    const vals = localizacoes.map(l => l.prateleira).filter(Boolean) as string[]
    const unique = [...new Set(vals)].sort()
    const opts = unique.map(p => ({ value: p, label: p }))
    if (localizacoes.some(l => !l.prateleira)) opts.push({ value: 'sem', label: 'Sem prateleira' })
    return opts
  }, [localizacoes])

  useEffect(() => { setPage(1) }, [search, filtros])

  useEffect(() => {
    try { localStorage.setItem(SORT_KEY_L, JSON.stringify(sort)) }
    catch { /* noop */ }
  }, [sort])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return localizacoes
      .filter(l =>
        !q ||
        l.codigo.toLowerCase().includes(q) ||
        l.setor.toLowerCase().includes(q) ||
        (l.prateleira?.toLowerCase().includes(q) ?? false),
      )
      .filter(l => {
        const setores = filtros['setor'] as string[] | undefined
        if (setores?.length && !setores.includes(l.setor)) return false

        const prateleiras = filtros['prateleira'] as string[] | undefined
        if (prateleiras?.length) {
          const noShelf = prateleiras.includes('sem') && !l.prateleira
          const hasShelf = l.prateleira && prateleiras.includes(l.prateleira)
          if (!noShelf && !hasShelf) return false
        }

        const niveis = filtros['nivel'] as string[] | undefined
        if (niveis?.length && !niveis.includes(l.nivel_acesso)) return false

        const numState = filtros['num_produtos'] as RangeState | undefined
        if (numState) {
          const { min, max, apenasZerados } = numState
          const hasMin = min !== '' && min !== undefined
          const hasMax = max !== '' && max !== undefined
          const isActive = hasMin || hasMax || apenasZerados
          if (isActive) {
            const count = l.estoque_produtos?.[0]?.count ?? 0
            if (apenasZerados) return count === 0
            if (hasMin && count < Number(min)) return false
            if (hasMax && count > Number(max)) return false
          }
        }

        return true
      })
  }, [localizacoes, search, filtros])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1
    if (sort.key === 'codigo') return a.codigo.localeCompare(b.codigo, 'pt-BR') * dir
    return a.setor.localeCompare(b.setor, 'pt-BR') * dir
  }), [filtered, sort])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(k: SortKeyL) {
    setSort(s => s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' })
    setPage(1)
  }

  function sortIcon(k: SortKeyL) {
    if (sort.key !== k) return <ChevronsUpDown className="h-3 w-3 opacity-40" />
    return sort.dir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />
  }

  function getExportRows() {
    return filtered.map(l => ({
      'Código': l.codigo,
      'Setor': l.setor,
      'Prateleira': l.prateleira ?? '',
      'Posição': l.posicao ?? '',
      'Nível de Acesso': NIVEIS_ACESSO[l.nivel_acesso] ?? l.nivel_acesso,
      'Nº Produtos': l.estoque_produtos?.[0]?.count ?? 0,
      'Ativo': l.ativo ? 'Sim' : 'Não',
    }))
  }

  function setFiltro(col: string, val: unknown) {
    setFiltros(prev => ({ ...prev, [col]: val }))
  }

  function handleRemoveChip(colKey: string, value?: string) {
    if (value !== undefined) {
      const current = (filtros[colKey] as string[]) ?? []
      setFiltros(prev => ({ ...prev, [colKey]: current.filter(v => v !== value) }))
    } else {
      setFiltros(prev => { const c = { ...prev }; delete c[colKey]; return c })
    }
  }

  function toggleFilter(key: string, e: React.MouseEvent<HTMLTableCellElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setOpenFilter(prev => prev?.key === key ? null : { key, rect })
  }

  function handleNovo() { setEditando(null); setFormOpen(true) }
  function handleEditar(l: EstoqueLocalizacao) { setEditando(l); setFormOpen(true) }

  async function handleDesativar(l: EstoqueLocalizacao) {
    try {
      await updateMutation.mutateAsync({ id: l.id, ativo: false })
      toast('success', `Localização "${l.codigo}" removida.`)
    } catch {
      toast('error', 'Erro ao remover localização.')
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filtros))
      localStorage.setItem(FILTER_KEY + '-search', search)
    } catch { /* noop */ }
  }, [filtros, search])

  const hasFilters = Object.entries(filtros).some(([k, v]) =>
    isFilterActive(FILTER_TYPES[k] ?? 'multi', v),
  )

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pb-3 justify-center">
        <div className={tbl.searchWrap}>
          <Search className={tbl.searchIcon} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar localização por código ou setor…"
            className={tbl.searchInput}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none self-center">
          <button
            type="button" role="switch" aria-checked={mostrarInativas}
            onClick={() => setMostrarInativas(v => !v)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              mostrarInativas ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
          >
            <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
              mostrarInativas ? 'translate-x-[18px]' : 'translate-x-0.5')} />
          </button>
          <span className="text-sm text-muted-foreground">Mostrar inativas</span>
        </label>
        <div className="flex items-center gap-1">
          <button onClick={() => exportCsv(`localizacoes-${Date.now()}.csv`, getExportRows())}
            disabled={filtered.length === 0}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all disabled:opacity-40"
            title={`Exportar ${filtered.length} localizações como CSV`}>
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={() => exportXlsx(`localizacoes-${Date.now()}.xlsx`, getExportRows())}
            disabled={filtered.length === 0}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all disabled:opacity-40"
            title={`Exportar ${filtered.length} localizações como XLSX`}>
            <Download className="h-3.5 w-3.5" /> XLSX
          </button>
        </div>
        <button onClick={handleNovo} className={cn(tbl.addBtn, 'w-full sm:w-auto justify-center')}>
          <Plus className="h-4 w-4" />
          Nova Localização
        </button>
      </div>

      {/* ── Chips ── */}
      <FiltrosAtivosChips
        filtros={filtros}
        filterTypes={FILTER_TYPES}
        labels={CHIP_LABELS}
        formatLabel={CHIP_FORMAT}
        onRemove={handleRemoveChip}
        onClearAll={() => setFiltros({})}
      />

      {/* Table */}
      <div className={tbl.container}>
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr className={tbl.theadRow}>
                {/* Código — sortable */}
                <th
                  onClick={() => toggleSort('codigo')}
                  className={cn(tbl.th, 'cursor-pointer select-none hover:bg-muted/40 transition-colors')}
                  title="Ordenar por código"
                >
                  <span className="flex items-center gap-1">Código {sortIcon('codigo')}</span>
                </th>

                {/* Setor — filter + sort */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group')}
                  onClick={e => toggleFilter('setor', e)}
                >
                  <div className="flex items-center justify-between gap-0.5 w-full">
                    <span className="flex-1 text-left">Setor</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSort('setor') }}
                      className="shrink-0 rounded p-0.5 hover:bg-primary/10 transition-colors"
                      title="Ordenar por setor"
                    >
                      {sortIcon('setor')}
                    </button>
                    <Filter className={cn('h-3 w-3 shrink-0 transition-colors',
                      isFilterActive('multi', filtros['setor']) ? 'text-primary fill-primary/30' : 'text-muted-foreground/30 group-hover:text-muted-foreground/60'
                    )} />
                  </div>
                  <FilterPopover open={openFilter?.key === 'setor'} anchorRect={openFilter?.key === 'setor' ? openFilter.rect : null}
                    label="Setor" filterType="multi" options={setorOptions}
                    value={filtros['setor'] ?? []} onChange={v => setFiltro('setor', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* Prateleira */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group')}
                  onClick={e => toggleFilter('prateleira', e)}
                >
                  <FiltroHeader label="Prateleira" active={isFilterActive('multi', filtros['prateleira'])} />
                  <FilterPopover open={openFilter?.key === 'prateleira'} anchorRect={openFilter?.key === 'prateleira' ? openFilter.rect : null}
                    label="Prateleira" filterType="multi" options={prateleiraOptions}
                    value={filtros['prateleira'] ?? []} onChange={v => setFiltro('prateleira', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* Posição — sem filtro (texto livre, busca cobre) */}
                <th className={tbl.th}>Posição</th>

                {/* Nível de acesso */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group')}
                  onClick={e => toggleFilter('nivel', e)}
                >
                  <FiltroHeader label="Nível de acesso" active={isFilterActive('multi', filtros['nivel'])} />
                  <FilterPopover open={openFilter?.key === 'nivel'} anchorRect={openFilter?.key === 'nivel' ? openFilter.rect : null}
                    label="Nível de acesso" filterType="multi" options={NIVEL_OPTIONS}
                    value={filtros['nivel'] ?? []} onChange={v => setFiltro('nivel', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* Nº Produtos */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group')}
                  onClick={e => toggleFilter('num_produtos', e)}
                >
                  <FiltroHeader label="Produtos" active={isFilterActive('range', filtros['num_produtos'])} />
                  <FilterPopover open={openFilter?.key === 'num_produtos'} anchorRect={openFilter?.key === 'num_produtos' ? openFilter.rect : null}
                    label="Nº Produtos" filterType="range"
                    rangeOpts={{ showApenasZerados: true, apenasZeradosLabel: 'Apenas vazias (0 produtos)' }}
                    value={filtros['num_produtos'] ?? {}} onChange={v => setFiltro('num_produtos', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* Ações — sem filtro */}
                <th className={cn(tbl.th, 'border-r-0')}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-lg skeleton-shimmer" />)}
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {search || hasFilters ? 'Nenhuma localização com esse filtro. Tente outra combinação.' : 'Nenhuma localização cadastrada'}
                    </p>
                    {!search && !hasFilters && (
                      <button
                        onClick={handleNovo}
                        className="mt-3 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand hover:opacity-90 active:scale-95 transition-all"
                      >
                        + Nova Localização
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginated.map(l => {
                  const numProdutos = l.estoque_produtos?.[0]?.count ?? 0
                  return (
                    <tr key={l.id} className={tbl.tbodyRow}>
                      <td className={cn(tbl.td, 'font-mono font-semibold whitespace-nowrap')}>{l.codigo}</td>
                      <td className={tbl.td}>
                        <p className="font-medium text-foreground text-center">{l.setor}</p>
                        {l.descricao && (
                          <p className="text-xs text-muted-foreground text-center truncate max-w-[200px] mx-auto">{l.descricao}</p>
                        )}
                      </td>
                      <td className={cn(tbl.td, 'text-muted-foreground')}>{l.prateleira ?? '—'}</td>
                      <td className={cn(tbl.td, 'text-muted-foreground')}>{l.posicao ?? '—'}</td>
                      <td className={tbl.td}>{NIVEIS_ACESSO[l.nivel_acesso] ?? l.nivel_acesso}</td>
                      <td className={cn(tbl.td, 'text-center text-muted-foreground')}>{numProdutos}</td>
                      <td className={tbl.actionTd}>
                        <div className={cn(tbl.actionGroup, 'justify-center')}>
                          <button onClick={() => handleEditar(l)} title="Editar"
                            className={cn(tbl.actionBtn, 'hover:text-foreground hover:bg-muted/60')}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDesativar(l)} title="Remover"
                            disabled={updateMutation.isPending}
                            className={cn(tbl.actionBtn, 'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50')}>
                            <span className="text-xs font-bold leading-none">✕</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className={tbl.tfootRow}>
                  <td colSpan={7} className={tbl.tfootCell}>
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        {sorted.length > PAGE_SIZE
                          ? <>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} de {sorted.length} {sorted.length !== 1 ? 'localizações' : 'localização'}{sorted.length < localizacoes.length ? <> <span className="text-muted-foreground/50">(de {localizacoes.length} total)</span></> : null}</>
                          : sorted.length < localizacoes.length
                            ? <>{sorted.length} <span className="text-muted-foreground/50">de {localizacoes.length}</span> {sorted.length === 1 ? 'localização' : 'localizações'}</>
                            : <>Total — {sorted.length} {sorted.length === 1 ? 'localização' : 'localizações'}</>
                        }
                      </span>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-2 text-xs">
                          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40 transition-colors">← Ant</button>
                          <span className="text-muted-foreground">{page} / {totalPages}</span>
                          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40 transition-colors">Próx →</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <NovaLocalizacaoForm open={formOpen} onClose={() => setFormOpen(false)} toast={toast} editando={editando} />
    </>
  )
}

function FiltroHeader({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-1.5 w-full">
      <span>{label}</span>
      <Filter className={cn(
        'h-3 w-3 shrink-0 transition-colors',
        active ? 'text-primary fill-primary/30' : 'text-muted-foreground/30 group-hover:text-muted-foreground/60',
      )} />
    </div>
  )
}
