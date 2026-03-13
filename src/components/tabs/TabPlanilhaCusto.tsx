import { useState, useMemo, useEffect } from 'react'
import { Search, ChevronDown, X, Download, Receipt } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import SkeletonCard from '@/components/shared/SkeletonCard'

interface Props {
  data: Orcamento[]
  loading: boolean
}

const FILTER_KEY = 'sombrear-planilha-custo-filters'

const PERIODOS = [
  { value: 'todos', label: 'Tudo' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'custom', label: 'Período' },
]

const selectClass = 'w-full rounded-lg border bg-card pl-3 pr-8 py-2.5 text-sm outline-none ring-ring focus:ring-2 cursor-pointer appearance-none'
const dateClass = 'flex-1 min-w-[130px] rounded-lg border bg-card px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2'

function loadFilters() {
  try {
    const s = localStorage.getItem(FILTER_KEY)
    return s ? JSON.parse(s) : {}
  } catch { return {} }
}

function SelectField({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative flex-1 min-w-[140px]">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    </div>
  )
}

export default function TabPlanilhaCusto({ data, loading }: Props) {
  const saved = loadFilters()
  const [search, setSearch] = useState('')
  const [responsavel, setResponsavel] = useState(saved.responsavel ?? 'todos')
  const [modelo, setModelo] = useState(saved.modelo ?? 'todos')
  const [periodo, setPeriodo] = useState(saved.periodo ?? 'mes')
  const [dateFrom, setDateFrom] = useState(saved.dateFrom ?? '')
  const [dateTo, setDateTo] = useState(saved.dateTo ?? '')
  const [apenasComCusto, setApenasComCusto] = useState(saved.apenasComCusto ?? true)

  const debouncedSearch = useDebounce(search, 220)

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify({ responsavel, modelo, periodo, dateFrom, dateTo, apenasComCusto }))
  }, [responsavel, modelo, periodo, dateFrom, dateTo, apenasComCusto])

  function clearFilters() {
    setSearch('')
    setResponsavel('todos')
    setModelo('todos')
    setPeriodo('mes')
    setDateFrom('')
    setDateTo('')
    setApenasComCusto(true)
  }

  const responsaveis = useMemo(() => [...new Set(data.map((o) => o.responsavel))].filter(Boolean).sort(), [data])
  const modelos = useMemo(() => [...new Set(data.map((o) => o.modelo))].filter(Boolean).sort(), [data])

  const filtered = useMemo(() => {
    let result = data.filter((o) => {
      // período
      if (periodo !== 'todos' && o.created_at) {
        const d = new Date(o.created_at)
        const now = new Date()
        if (periodo === 'hoje' && d.toDateString() !== now.toDateString()) return false
        if (periodo === 'semana' && (now.getTime() - d.getTime()) / 86400000 > 7) return false
        if (periodo === 'mes' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false
        if (periodo === 'custom') {
          if (dateFrom && d < new Date(dateFrom)) return false
          if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); if (d > end) return false }
        }
      }
      if (apenasComCusto && !(o.custo_tecido != null && o.custo_tecido > 0)) return false
      if (responsavel !== 'todos' && o.responsavel !== responsavel) return false
      if (modelo !== 'todos' && o.modelo !== modelo) return false
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        const match = [o.cliente, o.responsavel, o.modelo, o.tecido].some((v) => v?.toLowerCase().includes(q))
        if (!match) return false
      }
      return true
    })
    return result.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [data, periodo, dateFrom, dateTo, apenasComCusto, responsavel, modelo, debouncedSearch])

  const totais = useMemo(() => {
    const comMargem = filtered.filter((o) => o.margem != null)
    return {
      custoTotal: filtered.reduce((s, o) => s + (o.custo_tecido ?? 0), 0),
      custoAcabamento: filtered.reduce((s, o) => s + (o.custo_acabamento ?? 0), 0),
      valorVenda: filtered.reduce((s, o) => s + (o.valor_venda ?? 0), 0),
      margemMedia: comMargem.length > 0
        ? comMargem.reduce((s, o) => s + (o.margem ?? 0), 0) / comMargem.length
        : null,
    }
  }, [filtered])

  const isFiltered = !!search || responsavel !== 'todos' || modelo !== 'todos' || periodo !== 'mes' || !!dateFrom || !!dateTo || !apenasComCusto

  const chips = [
    search ? { label: search.length > 18 ? `"${search.slice(0, 18)}…"` : `"${search}"`, onRemove: () => setSearch('') } : null,
    responsavel !== 'todos' ? { label: responsavel, onRemove: () => setResponsavel('todos') } : null,
    modelo !== 'todos' ? { label: modelo, onRemove: () => setModelo('todos') } : null,
    !apenasComCusto ? { label: 'Todos (sem custo incl.)', onRemove: () => setApenasComCusto(true) } : null,
    periodo !== 'todos' && periodo !== 'mes' ? {
      label: periodo === 'custom' ? `${dateFrom || '?'} → ${dateTo || '?'}` : PERIODOS.find((p) => p.value === periodo)?.label ?? periodo,
      onRemove: () => { setPeriodo('mes'); setDateFrom(''); setDateTo('') },
    } : null,
  ].filter(Boolean) as { label: string; onRemove: () => void }[]

  function exportXLSX() {
    const rows = filtered.map((o) => ({
        'Data': o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '',
        'Cliente': o.cliente ?? '',
        'Responsável': o.responsavel,
        'Modelo': o.modelo,
        'Tecido': o.tecido,
        'Medidas': o.largura && o.altura ? `${o.largura} x ${o.altura}` : '',
        'Custo Total (R$)': o.custo_tecido ?? '',
        'Custo Acab. (R$)': o.custo_acabamento ?? '',
        'Custo m² (R$)': o.custo_m2 ?? '',
        'Valor Venda (R$)': o.valor_venda ?? '',
        'Margem (%)': o.margem != null ? o.margem.toFixed(1) : '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Planilha de Custo')
      XLSX.writeFile(wb, `planilha-custo-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border bg-card shadow-sm animate-pulse">
          <div className="border-b px-5 py-4"><div className="h-5 w-48 rounded bg-muted" /></div>
          <div className="p-5 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded bg-muted" />)}
          </div>
        </div>
        <SkeletonCard />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Planilha de Custo</h2>
          <p className="text-xs text-muted-foreground">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}{isFiltered ? ' filtrados' : ''}
          </p>
        </div>
        <button
          onClick={exportXLSX}
          className="hidden md:flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand hover:opacity-90 hover:scale-105 active:scale-95 transition-all duration-150"
        >
          <Download className="h-4 w-4" />
          Exportar XLSX
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente, responsável, modelo..."
            className={`w-full rounded-lg border bg-card py-2.5 pl-9 text-sm outline-none ring-ring focus:ring-2 ${search ? 'pr-8' : 'pr-10'}`}
          />
          {search ? (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              /
            </kbd>
          )}
        </div>

        {/* Selects + período */}
        <div className="flex flex-wrap gap-2">
          {/* Período pills */}
          <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
            {PERIODOS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriodo(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 ${
                  periodo === value
                    ? 'bg-card text-primary shadow-sm scale-[1.04]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <SelectField value={responsavel} onChange={setResponsavel}>
            <option value="todos">Todos responsáveis</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </SelectField>

          <SelectField value={modelo} onChange={setModelo}>
            <option value="todos">Todos modelos</option>
            {modelos.map((m) => <option key={m} value={m}>{m}</option>)}
          </SelectField>

          <div className="relative flex-1 min-w-[140px]">
            <select
              value={apenasComCusto ? 'com' : 'todos'}
              onChange={(e) => setApenasComCusto(e.target.value === 'com')}
              className={selectClass}
            >
              <option value="com">Apenas com custo</option>
              <option value="todos">Todos os orçamentos</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Data customizada */}
        {periodo === 'custom' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground shrink-0">De</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={dateClass} />
              <span className="text-xs text-muted-foreground shrink-0">até</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={dateClass} />
            </div>
            {dateFrom && dateTo && dateTo < dateFrom && (
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                ⚠ Data final é anterior à inicial — nenhum resultado será exibido.
              </p>
            )}
          </div>
        )}

        {/* Chips de filtro ativo */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">Filtros ativos:</span>
            {chips.map((chip, i) => (
              <span
                key={`${chip.label}-${i}`}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {chip.label}
                <button onClick={chip.onRemove} className="hover:text-primary/60 transition-colors" aria-label={`Remover filtro ${chip.label}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2 ml-1"
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Data</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Responsável</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Modelo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Tecido</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Custo Total</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Custo Acab.</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Custo m²</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Valor Venda</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Margem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <Receipt className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    Nenhum registro encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                <>
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[140px] truncate" title={o.cliente ?? undefined}>
                        {o.cliente || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{o.responsavel}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{o.modelo}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{o.tecido}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                        {o.custo_tecido ? formatCurrency(o.custo_tecido) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {o.custo_acabamento ? formatCurrency(o.custo_acabamento) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {o.custo_m2 ? formatCurrency(o.custo_m2) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {o.valor_venda ? formatCurrency(o.valor_venda) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {o.margem != null ? (
                          <span className={o.margem >= 30 ? 'text-primary font-medium' : o.margem >= 15 ? 'text-foreground font-medium' : 'text-destructive font-medium'}>
                            {formatPercent(o.margem)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                  {/* Linha de totais */}
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td colSpan={5} className="px-4 py-3 text-muted-foreground text-xs">
                      TOTAL — {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totais.custoTotal)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totais.custoAcabamento)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totais.valorVenda)}</td>
                    <td className="px-4 py-3 text-right">
                      {totais.margemMedia != null ? (
                        <span className={totais.margemMedia >= 30 ? 'text-primary' : totais.margemMedia >= 15 ? 'text-foreground' : 'text-destructive'}>
                          {formatPercent(totais.margemMedia)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile export FAB */}
      <button
        onClick={exportXLSX}
        className="fixed bottom-6 right-4 z-40 md:hidden flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white hover:scale-110 active:scale-90 transition-all duration-200 shadow-brand"
        aria-label="Exportar XLSX"
      >
        <Download className="h-6 w-6" />
      </button>
    </div>
  )
}
