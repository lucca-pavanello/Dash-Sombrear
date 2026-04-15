import { useState, useMemo } from 'react'
import { Search, X, Plus, Pencil, PackageX, TrendingUp, Package, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { useEstoqueProdutos, useDeactivateEstoqueProduto } from '@/hooks/useEstoqueProdutos'
import { useEstoqueLocalizacoes } from '@/hooks/useEstoqueLocalizacoes'
import { TIPOS_PRODUTO } from '@/lib/constants'
import { tbl } from './shared/tableStyles'
import { FilterPopover, isFilterActive } from './shared/FilterPopover'
import { FiltrosAtivosChips } from './shared/FiltrosAtivosChips'
import type { RangeState } from './shared/FilterPopover'
import type { EstoqueProduto } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

type TipoMov = 'entrada' | 'saida' | 'ajuste' | 'perda'

interface Props {
  toast: (type: ToastType, message: string) => void
  onNovoProduto: () => void
  onEditar: (p: EstoqueProduto) => void
  onMovimentar: (p: EstoqueProduto, tipo: TipoMov) => void
}

const TIPO_OPTIONS = [
  { value: 'tecido',    label: 'Tecido' },
  { value: 'ferragem',  label: 'Ferragem' },
  { value: 'acessorio', label: 'Acessório' },
]

const ABC_OPTIONS = [
  { value: 'A',         label: 'Classe A' },
  { value: 'B',         label: 'Classe B' },
  { value: 'C',         label: 'Classe C' },
  { value: 'sem_dados', label: 'Sem dados' },
]

const FILTER_TYPES: Record<string, 'multi' | 'range' | 'text'> = {
  tipo:          'multi',
  unidade:       'multi',
  estoque_atual: 'range',
  localizacao:   'multi',
  custo_medio:   'range',
  preco_venda:   'range',
  abc:           'multi',
}

const CHIP_LABELS: Record<string, string> = {
  tipo:          'Tipo',
  unidade:       'Unidade',
  estoque_atual: 'Estoque',
  localizacao:   'Localização',
  custo_medio:   'Custo médio',
  preco_venda:   'Preço venda',
  abc:           'ABC',
}

const BASE_CHIP_FORMAT: Record<string, (v: string) => string> = {
  tipo: (v) => TIPOS_PRODUTO[v] ?? v,
  abc:  (v) => v === 'sem_dados' ? 'Sem dados' : `Classe ${v}`,
}

function applyFilter(key: string, p: EstoqueProduto, state: unknown): boolean {
  if (key === 'tipo') {
    const s = state as string[]
    return s.length === 0 || s.includes(p.estoque_categorias?.tipo ?? '')
  }
  if (key === 'unidade') {
    const s = state as string[]
    return s.length === 0 || s.includes(p.unidade)
  }
  if (key === 'estoque_atual') {
    const s = state as RangeState
    if (s.apenasZerados) return p.quantidade_atual === 0
    const min = s.min !== '' && s.min !== undefined ? Number(s.min) : null
    const max = s.max !== '' && s.max !== undefined ? Number(s.max) : null
    if (min !== null && p.quantidade_atual < min) return false
    if (max !== null && p.quantidade_atual > max) return false
    return true
  }
  if (key === 'localizacao') {
    const s = state as string[]
    if (s.length === 0) return true
    const noLoc = s.includes('sem') && p.localizacao_id == null
    const hasLoc = p.localizacao_id != null && s.includes(p.localizacao_id)
    return noLoc || hasLoc
  }
  if (key === 'custo_medio') {
    const s = state as RangeState
    if (s.apenasZerados) return !p.custo_unitario || p.custo_unitario === 0
    if (p.custo_unitario == null) return s.incluirVazios ?? false
    const min = s.min !== '' && s.min !== undefined ? Number(s.min) : null
    const max = s.max !== '' && s.max !== undefined ? Number(s.max) : null
    if (min !== null && p.custo_unitario < min) return false
    if (max !== null && p.custo_unitario > max) return false
    return true
  }
  if (key === 'preco_venda') {
    const s = state as RangeState
    if (s.apenasZerados) return !p.preco_venda || p.preco_venda === 0
    if (p.preco_venda == null) return s.incluirVazios ?? false
    const min = s.min !== '' && s.min !== undefined ? Number(s.min) : null
    const max = s.max !== '' && s.max !== undefined ? Number(s.max) : null
    if (min !== null && p.preco_venda < min) return false
    if (max !== null && p.preco_venda > max) return false
    return true
  }
  if (key === 'abc') {
    const s = state as string[]
    if (s.length === 0) return true
    return s.includes(p.classificacao_abc ?? 'sem_dados')
  }
  return true
}

export default function EstoqueProdutosTable({ toast, onNovoProduto, onEditar, onMovimentar }: Props) {
  const [search, setSearch] = useState('')
  const [filtros, setFiltros] = useState<Record<string, unknown>>({})
  const [openFilter, setOpenFilter] = useState<{ key: string; rect: DOMRect } | null>(null)
  const [mostrarInativos, setMostrarInativos] = useState(false)

  const { data: produtos = [], isLoading } = useEstoqueProdutos({ includeInactive: mostrarInativos })
  const { data: localizacoes = [] } = useEstoqueLocalizacoes()
  const deactivate = useDeactivateEstoqueProduto()

  const unidadeOptions = useMemo(() => {
    const unique = [...new Set(produtos.map(p => p.unidade))].sort()
    return unique.map(u => ({ value: u, label: u.toUpperCase() }))
  }, [produtos])

  const localizacaoOptions = useMemo(() => [
    { value: 'sem', label: 'Sem localização' },
    ...localizacoes.map(l => ({ value: l.id, label: `${l.codigo} – ${l.setor}` })),
  ], [localizacoes])

  const chipFormatMap = useMemo(() => ({
    ...BASE_CHIP_FORMAT,
    localizacao: (v: string) => {
      if (v === 'sem') return 'Sem localização'
      return localizacaoOptions.find(o => o.value === v)?.label ?? v
    },
  }), [localizacaoOptions])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return produtos.filter(p => {
      if (q && !p.nome.toLowerCase().includes(q) && !p.codigo?.toLowerCase().includes(q)) return false
      for (const [key, state] of Object.entries(filtros)) {
        if (!state) continue
        if (Array.isArray(state) && state.length === 0) continue
        if (!applyFilter(key, p, state)) return false
      }
      return true
    })
  }, [produtos, search, filtros])

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

  function colIsActive(key: string) {
    return isFilterActive(FILTER_TYPES[key] ?? 'multi', filtros[key])
  }

  function toggleFilter(key: string, e: React.MouseEvent<HTMLTableCellElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setOpenFilter(prev => prev?.key === key ? null : { key, rect })
  }

  async function handleDesativar(p: EstoqueProduto) {
    if (!window.confirm(`Desativar "${p.nome}"? O produto não aparecerá mais no estoque.`)) return
    try {
      await deactivate.mutateAsync(p.id)
      toast('success', `Produto "${p.nome}" desativado.`)
    } catch {
      toast('error', 'Erro ao desativar produto.')
    }
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pb-2 justify-center">
        <div className={tbl.searchWrap}>
          <Search className={tbl.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou SKU..."
            className={cn(tbl.searchInput, 'pr-8')}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
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
        <button onClick={onNovoProduto} className={cn(tbl.addBtn, 'w-full sm:w-auto justify-center')}>
          <Plus className="h-4 w-4" />
          Novo Produto
        </button>
      </div>

      {/* ── Chips ── */}
      <FiltrosAtivosChips
        filtros={filtros}
        filterTypes={FILTER_TYPES}
        labels={CHIP_LABELS}
        formatLabel={chipFormatMap}
        onRemove={handleRemoveChip}
        onClearAll={() => setFiltros({})}
      />

      {/* ── Tabela ── */}
      <div className={tbl.container}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '960px' }}>
            <thead>
              <tr className={tbl.theadRow}>
                {/* SKU — sem filtro */}
                <th className={cn(tbl.th, 'pl-6')}>SKU</th>
                {/* Nome — sem filtro */}
                <th className={tbl.th}>Nome</th>

                {/* Tipo */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group hidden md:table-cell')}
                  onClick={(e) => toggleFilter('tipo', e)}
                >
                  <FiltroHeader label="Tipo" active={colIsActive('tipo')} />
                  <FilterPopover open={openFilter?.key === 'tipo'} anchorRect={openFilter?.key === 'tipo' ? openFilter.rect : null}
                    label="Tipo" filterType="multi" options={TIPO_OPTIONS}
                    value={filtros['tipo'] ?? []} onChange={(v) => setFiltro('tipo', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* Unidade */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group hidden lg:table-cell')}
                  onClick={(e) => toggleFilter('unidade', e)}
                >
                  <FiltroHeader label="Unidade" active={colIsActive('unidade')} />
                  <FilterPopover open={openFilter?.key === 'unidade'} anchorRect={openFilter?.key === 'unidade' ? openFilter.rect : null}
                    label="Unidade" filterType="multi" options={unidadeOptions}
                    value={filtros['unidade'] ?? []} onChange={(v) => setFiltro('unidade', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* Estoque atual */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group')}
                  onClick={(e) => toggleFilter('estoque_atual', e)}
                >
                  <FiltroHeader label="Estoque atual" active={colIsActive('estoque_atual')} />
                  <FilterPopover open={openFilter?.key === 'estoque_atual'} anchorRect={openFilter?.key === 'estoque_atual' ? openFilter.rect : null}
                    label="Estoque atual" filterType="range"
                    rangeOpts={{ showApenasZerados: true, apenasZeradosLabel: 'Apenas valor zero' }}
                    value={filtros['estoque_atual'] ?? {}} onChange={(v) => setFiltro('estoque_atual', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* Localização */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group hidden lg:table-cell')}
                  onClick={(e) => toggleFilter('localizacao', e)}
                >
                  <FiltroHeader label="Localização" active={colIsActive('localizacao')} />
                  <FilterPopover open={openFilter?.key === 'localizacao'} anchorRect={openFilter?.key === 'localizacao' ? openFilter.rect : null}
                    label="Localização" filterType="multi" options={localizacaoOptions}
                    value={filtros['localizacao'] ?? []} onChange={(v) => setFiltro('localizacao', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* Custo médio */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group hidden xl:table-cell')}
                  onClick={(e) => toggleFilter('custo_medio', e)}
                >
                  <FiltroHeader label="Custo médio" active={colIsActive('custo_medio')} />
                  <FilterPopover open={openFilter?.key === 'custo_medio'} anchorRect={openFilter?.key === 'custo_medio' ? openFilter.rect : null}
                    label="Custo médio" hint="Custo Médio Ponderado — atualizado a cada nova entrada." filterType="range"
                    rangeOpts={{ showIncluirVazios: true, incluirVaziosLabel: 'Incluir sem custo definido' }}
                    value={filtros['custo_medio'] ?? {}} onChange={(v) => setFiltro('custo_medio', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* Preço venda */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group hidden xl:table-cell')}
                  onClick={(e) => toggleFilter('preco_venda', e)}
                >
                  <FiltroHeader label="Preço venda" active={colIsActive('preco_venda')} />
                  <FilterPopover open={openFilter?.key === 'preco_venda'} anchorRect={openFilter?.key === 'preco_venda' ? openFilter.rect : null}
                    label="Preço venda" filterType="range"
                    rangeOpts={{ showIncluirVazios: true, incluirVaziosLabel: 'Incluir sem preço definido' }}
                    value={filtros['preco_venda'] ?? {}} onChange={(v) => setFiltro('preco_venda', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* ABC */}
                <th
                  className={cn(tbl.th, 'cursor-pointer hover:bg-muted/60 select-none group hidden sm:table-cell')}
                  onClick={(e) => toggleFilter('abc', e)}
                >
                  <FiltroHeader label="ABC" active={colIsActive('abc')} />
                  <FilterPopover open={openFilter?.key === 'abc'} anchorRect={openFilter?.key === 'abc' ? openFilter.rect : null}
                    label="ABC" hint="Classificação de Pareto — A=80% da receita, B=15%, C=5%." filterType="multi" options={ABC_OPTIONS}
                    value={filtros['abc'] ?? []} onChange={(v) => setFiltro('abc', v)} onClose={() => setOpenFilter(null)} />
                </th>

                {/* Ações — sem filtro */}
                <th className={cn(tbl.th, 'pr-6 border-r-0')}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-lg skeleton-shimmer" />)}
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado ainda'}
                    </p>
                    {!search && (
                      <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Produto" para começar</p>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const abc = p.classificacao_abc ?? 'sem_dados'
                  const inativo = !p.ativo
                  return (
                    <tr key={p.id} className={cn(tbl.tbodyRow, inativo && 'opacity-50')}>
                      <td className={cn(tbl.td, 'pl-6 font-mono text-xs text-muted-foreground whitespace-nowrap')}>
                        {p.codigo ?? '—'}
                      </td>
                      <td className={tbl.td}>
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-medium text-foreground">{p.nome}</span>
                          {inativo && (
                            <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              Inativo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={cn(tbl.td, 'text-muted-foreground hidden md:table-cell')}>
                        {TIPOS_PRODUTO[p.estoque_categorias?.tipo ?? ''] ?? '—'}
                      </td>
                      <td className={cn(tbl.td, 'text-muted-foreground uppercase hidden lg:table-cell')}>
                        {p.unidade}
                      </td>
                      <td className={cn(tbl.td, 'text-center font-semibold whitespace-nowrap')}>
                        {p.quantidade_atual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                        <span className="ml-1 text-xs font-normal text-muted-foreground/60">{p.unidade}</span>
                      </td>
                      <td className={cn(tbl.td, 'font-mono text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap')}>
                        {p.localizacao?.codigo ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className={cn(tbl.td, 'text-center whitespace-nowrap hidden xl:table-cell')}>
                        {p.custo_unitario != null ? formatCurrency(p.custo_unitario) : <span className="text-muted-foreground/60">—</span>}
                      </td>
                      <td className={cn(tbl.td, 'text-center whitespace-nowrap hidden xl:table-cell')}>
                        {p.preco_venda != null ? formatCurrency(p.preco_venda) : <span className="text-muted-foreground/60">—</span>}
                      </td>
                      <td className={cn(tbl.td, 'text-center hidden sm:table-cell')}>
                        {abc === 'sem_dados' ? '—' : abc}
                      </td>
                      <td className={cn(tbl.actionTd, 'pr-6')}>
                        <div className={cn(tbl.actionGroup, 'justify-center')}>
                          <ActionBtn icon={<TrendingUp className="h-4 w-4" />} label="Registrar entrada"
                            className="hover:text-primary hover:bg-primary/10" onClick={() => onMovimentar(p, 'entrada')} />
                          <ActionBtn icon={<Pencil className="h-4 w-4" />} label="Editar"
                            className="hover:text-foreground hover:bg-muted/60" onClick={() => onEditar(p)} />
                          {p.ativo && (
                            <ActionBtn icon={<PackageX className="h-4 w-4" />} label="Desativar"
                              className="hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleDesativar(p)} />
                          )}
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
                  <td colSpan={4} className={cn(tbl.tfootCell, 'pl-6')}>
                    Total — {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function ActionBtn({ icon, label, onClick, className }: {
  icon: React.ReactNode; label: string; onClick: () => void; className?: string
}) {
  return (
    <button title={label} onClick={onClick}
      className={cn('rounded-lg h-8 w-8 p-0 flex items-center justify-center text-muted-foreground/60 transition-colors', className)}>
      {icon}
    </button>
  )
}
