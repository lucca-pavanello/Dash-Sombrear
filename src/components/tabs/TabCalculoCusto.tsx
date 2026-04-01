import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Calculator, TrendingDown, Calendar, BarChart2, AlertCircle, ChevronDown, ChevronUp, LayoutGrid, Search, X, Download } from 'lucide-react'
import SkeletonCard from '@/components/shared/SkeletonCard'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import { useCustosInternos } from '@/hooks/useCustosInternos'
import { useDebounce } from '@/hooks/useDebounce'
import { CustomSelect } from '@/components/ui/CustomSelect'
import DatePicker from '@/components/ui/DatePicker'

interface Props {
  data: Orcamento[]
  isLoading?: boolean
  error?: boolean
}

const PERIODOS = [
  { value: 'todos', label: 'Tudo' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'custom', label: 'Período' },
]

export default function TabCalculoCusto({ data, isLoading, error }: Props) {
  // — todos os hooks primeiro, antes de qualquer early return —
  const [custosOpen, setCustosOpen] = useState(true)
  const [modeloOpen, setModeloOpen] = useState(true)

  // filtros orcamentos
  const [search, setSearch] = useState('')
  const [responsavel, setResponsavel] = useState('todos')
  const [modelo, setModelo] = useState('todos')
  const [periodo, setPeriodo] = useState('todos')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const debouncedSearch = useDebounce(search, 220)

  // filtros custos internos
  const [searchCI, setSearchCI] = useState('')
  const [responsavelCI, setResponsavelCI] = useState('todos')
  const [modeloCI, setModeloCI] = useState('todos')
  const [periodoCI, setPeriodoCI] = useState('todos')
  const [dateFromCI, setDateFromCI] = useState('')
  const [dateToCI, setDateToCI] = useState('')
  const debouncedSearchCI = useDebounce(searchCI, 220)

  const { data: custosInternos = [], isLoading: custosLoading, isError: custosError, refetch: custosRefetch } = useCustosInternos()

  const comCusto = useMemo(() => data.filter((o) => o.custo_tecido != null && o.custo_tecido > 0), [data])

  const hoje = new Date()
  const comCustoMes = useMemo(() => filterByPeriod(comCusto, 'mes', (o) => o.created_at), [comCusto])
  const totalMes = useMemo(() => comCustoMes.reduce((s, o) => s + (o.custo_tecido ?? 0), 0), [comCustoMes])
  const usosSemana = useMemo(() => filterByPeriod(comCusto, 'semana', (o) => o.created_at).length, [comCusto])
  const diasDecorridos = hoje.getDate()
  const mediaDiaria = diasDecorridos > 0 ? totalMes / diasDecorridos : 0

  const responsaveis = useMemo(() => [...new Set(comCusto.map((o) => o.responsavel))].filter(Boolean).sort(), [comCusto])
  const modelos = useMemo(() => [...new Set(comCusto.map((o) => o.modelo))].filter(Boolean).sort(), [comCusto])

  const filteredCusto = useMemo(() => {
    const byPeriod = filterByPeriod(comCusto, periodo, (o) => o.created_at, dateFrom, dateTo)
    return byPeriod.filter((o) => {
      if (responsavel !== 'todos' && o.responsavel !== responsavel) return false
      if (modelo !== 'todos' && o.modelo !== modelo) return false
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        return [o.cliente, o.responsavel, o.modelo, o.tecido].some((v) => v?.toLowerCase().includes(q))
      }
      return true
    }).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [comCusto, periodo, dateFrom, dateTo, responsavel, modelo, debouncedSearch])

  const custoPorModelo = useMemo(() =>
    filteredCusto.reduce<Record<string, { total: number; count: number }>>((acc, o) => {
      const k = o.modelo
      if (!acc[k]) acc[k] = { total: 0, count: 0 }
      acc[k].total += o.custo_tecido ?? 0
      acc[k].count += 1
      return acc
    }, {}),
  [filteredCusto])

  const responsaveisCI = useMemo(() => [...new Set(custosInternos.map((c) => c.responsavel))].filter(Boolean).sort() as string[], [custosInternos])
  const modelosCI = useMemo(() => [...new Set(custosInternos.map((c) => c.modelo))].filter(Boolean).sort(), [custosInternos])

  const filteredCI = useMemo(() => {
    const byPeriod = filterByPeriod(custosInternos, periodoCI, (c) => c.created_at, dateFromCI, dateToCI)
    return byPeriod.filter((c) => {
      if (responsavelCI !== 'todos' && c.responsavel !== responsavelCI) return false
      if (modeloCI !== 'todos' && c.modelo !== modeloCI) return false
      if (debouncedSearchCI) {
        const q = debouncedSearchCI.toLowerCase()
        return [c.cliente, c.responsavel, c.modelo, c.tecido, c.ambiente].some((v) => v?.toLowerCase().includes(q))
      }
      return true
    })
  }, [custosInternos, periodoCI, dateFromCI, dateToCI, responsavelCI, modeloCI, debouncedSearchCI])

  const isFiltered = !!search || responsavel !== 'todos' || modelo !== 'todos' || periodo !== 'todos' || !!dateFrom || !!dateTo
  const isFilteredCI = !!searchCI || responsavelCI !== 'todos' || modeloCI !== 'todos' || periodoCI !== 'todos' || !!dateFromCI || !!dateToCI

  // early returns depois de todos os hooks
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="rounded-xl border-2 bg-card shadow-sm animate-pulse">
          <div className="border-b px-5 py-4"><div className="h-5 w-48 rounded bg-muted" /></div>
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded bg-muted" />)}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-8 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        <p className="text-sm font-medium text-destructive">Erro ao carregar dados de custo. Tente recarregar a página.</p>
      </div>
    )
  }

  function clearFilters() {
    setSearch(''); setResponsavel('todos'); setModelo('todos')
    setPeriodo('todos'); setDateFrom(''); setDateTo('')
  }
  function clearFiltersCI() {
    setSearchCI(''); setResponsavelCI('todos'); setModeloCI('todos')
    setPeriodoCI('todos'); setDateFromCI(''); setDateToCI('')
  }

  function exportCSV() {
    const headers = ['Data', 'Cliente', 'Responsável', 'Modelo', 'Tecido', 'Custo Total (R$)', 'Custo Acab. (R$)', 'Custo m² (R$)', 'Valor Venda (R$)', 'Margem (%)']
    const rows = filteredCusto.map((o) => [
      o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '',
      o.cliente ?? '', o.responsavel, o.modelo, o.tecido ?? '',
      o.custo_tecido ?? '', o.custo_acabamento ?? '', o.custo_m2 ?? '',
      o.valor_venda ?? '', o.margem != null ? o.margem.toFixed(1) : '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    document.body.appendChild(a); a.href = url
    a.download = `planilha-custos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  function exportXLSX() {
    const rows = filteredCusto.map((o) => ({
      'Data': o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '',
      'Cliente': o.cliente ?? '', 'Responsável': o.responsavel,
      'Modelo': o.modelo, 'Tecido': o.tecido ?? '',
      'Custo Total (R$)': o.custo_tecido ?? '', 'Custo Acab. (R$)': o.custo_acabamento ?? '',
      'Custo m² (R$)': o.custo_m2 ?? '', 'Valor Venda (R$)': o.valor_venda ?? '',
      'Margem (%)': o.margem != null ? o.margem.toFixed(1) : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Planilha Custos')
    XLSX.writeFile(wb, `planilha-custos-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function exportCsvCI() {
    const headers = ['Data', 'Cliente', 'Responsável', 'Modelo', 'Ambiente', 'Tecido', 'Largura', 'Altura', 'Qtd', 'Custo Mat. (R$)', 'Custo M² (R$)', 'Custo Acab. (R$)', 'Custo Inst. (R$)', 'Total (R$)']
    const rows = filteredCI.map((c) => [
      new Date(c.created_at).toLocaleDateString('pt-BR'),
      c.cliente ?? '', c.responsavel ?? '', c.modelo, c.ambiente ?? '', c.tecido ?? '',
      c.largura ?? '', c.altura ?? '', c.quantidade ?? '',
      c.custo_material ?? '', c.custo_m2 ?? '', c.custo_acabamento ?? '', c.custo_instalacao ?? '',
      ((c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0)).toFixed(2),
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    document.body.appendChild(a); a.href = url
    a.download = `custos-internos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  function exportXlsxCI() {
    const rows = filteredCI.map((c) => ({
      'Data': new Date(c.created_at).toLocaleDateString('pt-BR'),
      'Cliente': c.cliente ?? '', 'Responsável': c.responsavel ?? '',
      'Modelo': c.modelo, 'Ambiente': c.ambiente ?? '', 'Tecido': c.tecido ?? '',
      'Largura': c.largura ?? '', 'Altura': c.altura ?? '', 'Qtd': c.quantidade ?? '',
      'Custo Mat. (R$)': c.custo_material ?? '', 'Custo M² (R$)': c.custo_m2 ?? '',
      'Custo Acab. (R$)': c.custo_acabamento ?? '', 'Custo Inst. (R$)': c.custo_instalacao ?? '',
      'Total (R$)': ((c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0)).toFixed(2),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Custos Internos')
    XLSX.writeFile(wb, `custos-internos-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total no Mês', value: formatCurrency(totalMes), icon: TrendingDown },
          { label: 'Usos na Semana', value: usosSemana, icon: Calendar },
          { label: `Média Diária (${diasDecorridos}d)`, value: formatCurrency(mediaDiaria), icon: BarChart2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5 shadow-sm">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-display text-2xl font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Custo por modelo */}
      <div className="rounded-xl border-2 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
          <button onClick={() => setModeloOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-display text-sm font-medium tracking-wide">Custo por Modelo</h2>
              <p className="text-xs text-muted-foreground">
                {filteredCusto.length} orçamento{filteredCusto.length !== 1 ? 's' : ''}{isFiltered ? ' filtrados' : ''}
              </p>
            </div>
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {Object.keys(custoPorModelo).length}
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            <button onClick={exportCSV} className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-all active:scale-95">
              <Download className="h-3.5 w-3.5" />CSV
            </button>
            <button onClick={exportXLSX} className="flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-brand hover:opacity-90 active:scale-95 transition-all">
              <Download className="h-3.5 w-3.5" />XLSX
            </button>
            <button onClick={() => setModeloOpen((v) => !v)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
              {modeloOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {modeloOpen && (
          <>
            {/* Filtros */}
            <div className="border-b px-5 py-3 space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, responsável, modelo, tecido..."
                  className={`w-full rounded-lg border border-border bg-background py-2 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 hover:border-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all ${search ? 'pr-8' : 'pr-3'}`}
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex gap-0.5 rounded-lg bg-card border border-border p-1 shadow-sm">
                  {PERIODOS.map(({ value, label }) => (
                    <button key={value} onClick={() => setPeriodo(value)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-all active:scale-95 whitespace-nowrap ${periodo === value ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
                    >{label}</button>
                  ))}
                </div>
                <div className="flex-1 min-w-[160px]">
                  <CustomSelect value={responsavel} onChange={setResponsavel} options={[{ value: 'todos', label: 'Todos responsáveis' }, ...responsaveis.map((r) => ({ value: r, label: r }))]} />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <CustomSelect value={modelo} onChange={setModelo} options={[{ value: 'todos', label: 'Todos modelos' }, ...modelos.map((m) => ({ value: m, label: m }))]} />
                </div>
              </div>
              {periodo === 'custom' && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-muted-foreground">De</span>
                  <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Data inicial" max={dateTo || undefined} />
                  <span className="text-xs font-medium text-muted-foreground">até</span>
                  <DatePicker value={dateTo} onChange={setDateTo} placeholder="Data final" min={dateFrom || undefined} />
                </div>
              )}
              {isFiltered && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                  {search && <Chip label={`"${search.slice(0, 18)}${search.length > 18 ? '…' : ''}"`} onRemove={() => setSearch('')} />}
                  {responsavel !== 'todos' && <Chip label={responsavel} onRemove={() => setResponsavel('todos')} />}
                  {modelo !== 'todos' && <Chip label={modelo} onRemove={() => setModelo('todos')} />}
                  {periodo !== 'todos' && <Chip label={periodo === 'custom' ? `${dateFrom || '?'} → ${dateTo || '?'}` : (PERIODOS.find((p) => p.value === periodo)?.label ?? periodo)} onRemove={() => { setPeriodo('todos'); setDateFrom(''); setDateTo('') }} />}
                  <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 ml-1">Limpar tudo</button>
                </div>
              )}
            </div>

            {Object.keys(custoPorModelo).length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum orçamento encontrado com os filtros aplicados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-5 py-3 text-left font-medium text-muted-foreground">Modelo</th>
                      <th className="px-5 py-3 text-center font-medium text-muted-foreground">Qtd.</th>
                      <th className="px-5 py-3 text-right font-medium text-muted-foreground">Custo Total</th>
                      <th className="px-5 py-3 text-right font-medium text-muted-foreground">Custo Médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(custoPorModelo).sort(([, a], [, b]) => b.total - a.total).map(([mod, { total, count }]) => (
                      <tr key={mod} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5 font-medium">{mod}</td>
                        <td className="px-5 py-3.5 text-center">{count}</td>
                        <td className="px-5 py-3.5 text-right">{formatCurrency(total)}</td>
                        <td className="px-5 py-3.5 text-right">{formatCurrency(count > 0 ? total / count : 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/30 font-semibold">
                      <td className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wide">Total</td>
                      <td className="px-5 py-3 text-center">{filteredCusto.length}</td>
                      <td className="px-5 py-3 text-right text-primary">{formatCurrency(filteredCusto.reduce((s, o) => s + (o.custo_tecido ?? 0), 0))}</td>
                      <td className="px-5 py-3 text-right">{formatCurrency(filteredCusto.length > 0 ? filteredCusto.reduce((s, o) => s + (o.custo_tecido ?? 0), 0) / filteredCusto.length : 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Planilha de Custos Internos */}
      <div className="rounded-xl border-2 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
          <button onClick={() => setCustosOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left">
            <Calculator className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-display text-sm font-medium tracking-wide">Planilha de Custos Internos</h2>
              <p className="text-xs text-muted-foreground">
                {filteredCI.length} registro{filteredCI.length !== 1 ? 's' : ''}{isFilteredCI ? ' filtrados' : ''}
              </p>
            </div>
            {!custosLoading && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {filteredCI.length}
              </span>
            )}
          </button>
          <div className="flex items-center gap-1.5">
            <button onClick={exportCsvCI} className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-all active:scale-95">
              <Download className="h-3.5 w-3.5" />CSV
            </button>
            <button onClick={exportXlsxCI} className="flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-brand hover:opacity-90 active:scale-95 transition-all">
              <Download className="h-3.5 w-3.5" />XLSX
            </button>
            <button onClick={() => setCustosOpen((v) => !v)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
              {custosOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {custosOpen && (
          <>
            {custosLoading ? (
              <div className="p-5 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}</div>
            ) : custosError ? (
              <div className="flex items-center justify-between gap-3 px-5 py-6">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">Erro ao carregar custos internos.</p>
                </div>
                <button onClick={() => custosRefetch()} className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                  Tentar novamente
                </button>
              </div>
            ) : (
              <>
                {/* Filtros custos internos */}
                <div className="border-b px-5 py-3 space-y-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={searchCI} onChange={(e) => setSearchCI(e.target.value)} placeholder="Buscar cliente, responsável, modelo, ambiente..."
                      className={`w-full rounded-lg border border-border bg-background py-2 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 hover:border-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all ${searchCI ? 'pr-8' : 'pr-3'}`}
                    />
                    {searchCI && <button onClick={() => setSearchCI('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex gap-0.5 rounded-lg bg-card border border-border p-1 shadow-sm">
                      {PERIODOS.map(({ value, label }) => (
                        <button key={value} onClick={() => setPeriodoCI(value)}
                          className={`rounded-md px-3 py-1 text-xs font-semibold transition-all active:scale-95 whitespace-nowrap ${periodoCI === value ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
                        >{label}</button>
                      ))}
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <CustomSelect value={responsavelCI} onChange={setResponsavelCI} options={[{ value: 'todos', label: 'Todos responsáveis' }, ...responsaveisCI.map((r) => ({ value: r, label: r }))]} />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <CustomSelect value={modeloCI} onChange={setModeloCI} options={[{ value: 'todos', label: 'Todos modelos' }, ...modelosCI.map((m) => ({ value: m, label: m }))]} />
                    </div>
                  </div>
                  {periodoCI === 'custom' && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-medium text-muted-foreground">De</span>
                      <DatePicker value={dateFromCI} onChange={setDateFromCI} placeholder="Data inicial" max={dateToCI || undefined} />
                      <span className="text-xs font-medium text-muted-foreground">até</span>
                      <DatePicker value={dateToCI} onChange={setDateToCI} placeholder="Data final" min={dateFromCI || undefined} />
                    </div>
                  )}
                  {isFilteredCI && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                      {searchCI && <Chip label={`"${searchCI.slice(0, 18)}${searchCI.length > 18 ? '…' : ''}"`} onRemove={() => setSearchCI('')} />}
                      {responsavelCI !== 'todos' && <Chip label={responsavelCI} onRemove={() => setResponsavelCI('todos')} />}
                      {modeloCI !== 'todos' && <Chip label={modeloCI} onRemove={() => setModeloCI('todos')} />}
                      {periodoCI !== 'todos' && <Chip label={periodoCI === 'custom' ? `${dateFromCI || '?'} → ${dateToCI || '?'}` : (PERIODOS.find((p) => p.value === periodoCI)?.label ?? periodoCI)} onRemove={() => { setPeriodoCI('todos'); setDateFromCI(''); setDateToCI('') }} />}
                      <button onClick={clearFiltersCI} className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 ml-1">Limpar tudo</button>
                    </div>
                  )}
                </div>

                {filteredCI.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum registro encontrado com os filtros aplicados.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Data</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Cliente</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Responsável</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Modelo</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Ambiente</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Tecido</th>
                          <th className="px-4 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">L × A</th>
                          <th className="px-4 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">Qtd</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Custo Mat.</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Custo M²</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Custo Acab.</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Custo Inst.</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCI.map((c) => {
                          const total = (c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0)
                          const lxa = c.largura != null && c.altura != null
                            ? `${c.largura.toFixed(2).replace('.', ',')} × ${c.altura.toFixed(2).replace('.', ',')}`
                            : '—'
                          return (
                            <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                              <td className="px-4 py-3">{c.cliente ?? '—'}</td>
                              <td className="px-4 py-3">{c.responsavel ?? '—'}</td>
                              <td className="px-4 py-3 font-medium">{c.modelo}</td>
                              <td className="px-4 py-3">{c.ambiente ?? '—'}</td>
                              <td className="px-4 py-3">{c.tecido ?? '—'}</td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">{lxa}</td>
                              <td className="px-4 py-3 text-center">{c.quantidade ?? '—'}</td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">{c.custo_material != null ? formatCurrency(c.custo_material) : '—'}</td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">{c.custo_m2 != null ? formatCurrency(c.custo_m2) : '—'}</td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">{c.custo_acabamento != null ? formatCurrency(c.custo_acabamento) : '—'}</td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">{c.custo_instalacao != null ? formatCurrency(c.custo_instalacao) : '—'}</td>
                              <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-primary">{formatCurrency(total)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-muted/30">
                          <td colSpan={8} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Totais</td>
                          <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_material ?? 0), 0))}</td>
                          <td className="px-4 py-3" />
                          <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_acabamento ?? 0), 0))}</td>
                          <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_instalacao ?? 0), 0))}</td>
                          <td className="px-4 py-3 text-right font-bold text-primary whitespace-nowrap">{formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0), 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {label}
      <button onClick={onRemove}><X className="h-3 w-3" /></button>
    </span>
  )
}
