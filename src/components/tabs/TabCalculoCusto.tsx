import { useState, useMemo, useEffect, useRef } from 'react'
import { formatCurrency } from '@/lib/utils'
import { AlertCircle, ChevronDown, ChevronUp, Search, X, Download, SlidersHorizontal, Plus, FileDown, Columns3 } from 'lucide-react'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import { useCustosInternos } from '@/hooks/useCustosInternos'
import { useDebounce } from '@/hooks/useDebounce'
import { CustomSelect } from '@/components/ui/CustomSelect'
import DatePicker from '@/components/ui/DatePicker'
import NovoCustoInternoForm from '@/components/custos/NovoCustoInternoForm'
import type { ToastType } from '@/hooks/useToast'

interface Props {
  isLoading?: boolean
  error?: boolean
  toast?: (type: ToastType, message: string) => void
}

const PERIODOS = [
  { value: 'todos', label: 'Tudo' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'custom', label: 'Período' },
]

const FILTERS_OPEN_KEY = 'sombrear-custos-filters-open'
const TABLE_OPEN_KEY = 'sombrear-custos-table-open'
const COLS_KEY = 'sombrear-custos-cols'
const CUSTO_FILTER_KEY = 'sombrear-custos-filtros'

type CustoColId = 'data' | 'cliente' | 'responsavel' | 'modelo' | 'ambiente' | 'tecido' | 'lxa' | 'qtd' | 'custo_mat' | 'custo_m2' | 'custo_acab' | 'custo_inst' | 'total'

const CUSTO_COL_DEFS: { id: CustoColId; label: string; optional: boolean; align: 'left' | 'center' | 'right' }[] = [
  { id: 'data',       label: 'Data',        optional: false, align: 'left' },
  { id: 'cliente',    label: 'Cliente',     optional: false, align: 'left' },
  { id: 'responsavel',label: 'Responsável', optional: false, align: 'left' },
  { id: 'modelo',     label: 'Modelo',      optional: false, align: 'left' },
  { id: 'ambiente',   label: 'Ambiente',    optional: true,  align: 'left' },
  { id: 'tecido',     label: 'Tecido',      optional: true,  align: 'left' },
  { id: 'lxa',        label: 'L × A',       optional: true,  align: 'center' },
  { id: 'qtd',        label: 'Qtd',         optional: true,  align: 'center' },
  { id: 'custo_mat',  label: 'Custo Mat.',  optional: false, align: 'right' },
  { id: 'custo_m2',   label: 'Custo M²',   optional: true,  align: 'right' },
  { id: 'custo_acab', label: 'Custo Acab.', optional: true,  align: 'right' },
  { id: 'custo_inst', label: 'Custo Inst.', optional: true,  align: 'right' },
  { id: 'total',      label: 'Total',       optional: false, align: 'right' },
]

const CUSTO_COL_DEFAULTS: Record<CustoColId, boolean> = {
  data: true, cliente: true, responsavel: true, modelo: true,
  ambiente: false, tecido: true, lxa: true, qtd: false,
  custo_mat: true, custo_m2: false, custo_acab: true, custo_inst: true, total: true,
}

function loadCustoColVis(): Record<CustoColId, boolean> {
  try {
    const s = localStorage.getItem(COLS_KEY)
    return s ? { ...CUSTO_COL_DEFAULTS, ...JSON.parse(s) } : { ...CUSTO_COL_DEFAULTS }
  } catch { return { ...CUSTO_COL_DEFAULTS } }
}

export default function TabCalculoCusto({ isLoading, error, toast }: Props) {
  const [custosOpen, setCustosOpen] = useState(() => {
    try { return localStorage.getItem(TABLE_OPEN_KEY) !== 'false' }
    catch { return true }
  })
  const [filtersOpen, setFiltersOpen] = useState(() => {
    try { return localStorage.getItem(FILTERS_OPEN_KEY) !== 'false' }
    catch { return true }
  })
  const [formOpen, setFormOpen] = useState(false)
  const [colVis, setColVis] = useState<Record<CustoColId, boolean>>(loadCustoColVis)
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem(COLS_KEY, JSON.stringify(colVis)) }
    catch { /* noop */ }
  }, [colVis])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false)
    }
    if (colsOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [colsOpen])

  const vis = (id: CustoColId) => colVis[id] !== false
  const visibleCustoCols = CUSTO_COL_DEFS.filter(c => vis(c.id))

  const [searchCI, setSearchCI]           = useState(() => { try { return localStorage.getItem(CUSTO_FILTER_KEY + '-search')      ?? ''      } catch { return ''      } })
  const [responsavelCI, setResponsavelCI] = useState(() => { try { return localStorage.getItem(CUSTO_FILTER_KEY + '-responsavel') ?? 'todos' } catch { return 'todos' } })
  const [modeloCI, setModeloCI]           = useState(() => { try { return localStorage.getItem(CUSTO_FILTER_KEY + '-modelo')       ?? 'todos' } catch { return 'todos' } })
  const [periodoCI, setPeriodoCI]         = useState(() => { try { return localStorage.getItem(CUSTO_FILTER_KEY + '-periodo')      ?? 'todos' } catch { return 'todos' } })
  const [dateFromCI, setDateFromCI]       = useState(() => { try { return localStorage.getItem(CUSTO_FILTER_KEY + '-dateFrom')    ?? ''      } catch { return ''      } })
  const [dateToCI, setDateToCI]           = useState(() => { try { return localStorage.getItem(CUSTO_FILTER_KEY + '-dateTo')      ?? ''      } catch { return ''      } })
  const debouncedSearchCI = useDebounce(searchCI, 220)

  useEffect(() => {
    try { localStorage.setItem(TABLE_OPEN_KEY, String(custosOpen)) }
    catch { /* noop */ }
  }, [custosOpen])

  useEffect(() => {
    try { localStorage.setItem(FILTERS_OPEN_KEY, String(filtersOpen)) }
    catch { /* noop */ }
  }, [filtersOpen])

  useEffect(() => {
    try {
      localStorage.setItem(CUSTO_FILTER_KEY + '-search',      searchCI)
      localStorage.setItem(CUSTO_FILTER_KEY + '-responsavel', responsavelCI)
      localStorage.setItem(CUSTO_FILTER_KEY + '-modelo',      modeloCI)
      localStorage.setItem(CUSTO_FILTER_KEY + '-periodo',     periodoCI)
      localStorage.setItem(CUSTO_FILTER_KEY + '-dateFrom',    dateFromCI)
      localStorage.setItem(CUSTO_FILTER_KEY + '-dateTo',      dateToCI)
    } catch { /* noop */ }
  }, [searchCI, responsavelCI, modeloCI, periodoCI, dateFromCI, dateToCI])

  // Keyboard shortcut: "/" focuses search
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const active = document.activeElement
      const inField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')
      if (e.key === '/' && !inField) {
        e.preventDefault()
        document.getElementById('custos-search')?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const { data: custosInternos = [], isLoading: custosLoading, isError: custosError, refetch: custosRefetch } = useCustosInternos()

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

  const isFilteredCI = !!searchCI || responsavelCI !== 'todos' || modeloCI !== 'todos' || periodoCI !== 'todos' || !!dateFromCI || !!dateToCI

  const chips = [
    searchCI ? { label: searchCI.length > 18 ? `"${searchCI.slice(0, 18)}…"` : `"${searchCI}"`, onRemove: () => setSearchCI('') } : null,
    responsavelCI !== 'todos' ? { label: responsavelCI, onRemove: () => setResponsavelCI('todos') } : null,
    modeloCI !== 'todos' ? { label: modeloCI, onRemove: () => setModeloCI('todos') } : null,
    periodoCI !== 'todos' ? {
      label: periodoCI === 'custom' ? `${dateFromCI || '?'} → ${dateToCI || '?'}` : (PERIODOS.find((p) => p.value === periodoCI)?.label ?? periodoCI),
      onRemove: () => { setPeriodoCI('todos'); setDateFromCI(''); setDateToCI('') },
    } : null,
  ].filter(Boolean) as { label: string; onRemove: () => void }[]

  const activeCount = chips.length

  if (isLoading) {
    return (
      <div className="rounded-xl border-2 bg-card shadow-sm animate-pulse">
        <div className="border-b px-5 py-4"><div className="h-5 w-48 rounded bg-muted" /></div>
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-muted" />)}
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

  function clearFiltersCI() {
    setSearchCI(''); setResponsavelCI('todos'); setModeloCI('todos')
    setPeriodoCI('todos'); setDateFromCI(''); setDateToCI('')
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

  async function exportXlsxCI() {
    const XLSX = await import('xlsx')
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

  async function exportPdfCI() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])
    const doc = new jsPDF({ orientation: 'landscape' })
    const now = new Date()
    const orange: [number, number, number] = [232, 112, 26]

    doc.setFillColor(...orange)
    doc.rect(0, 0, 297, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.text('Sombrear — Planilha de Custos', 10, 10)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${isFilteredCI ? 'Com filtros aplicados · ' : ''}${filteredCI.length} registro${filteredCI.length !== 1 ? 's' : ''} · ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      10, 17
    )

    autoTable(doc, {
      startY: 26,
      head: [['Data', 'Cliente', 'Responsável', 'Modelo', 'Ambiente', 'Tecido', 'L×A', 'Qtd', 'Custo Mat.', 'Custo M²', 'Custo Acab.', 'Custo Inst.', 'Total']],
      body: filteredCI.map((c) => {
        const total = (c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0)
        const lxa = c.largura != null && c.altura != null ? `${c.largura} × ${c.altura}` : '—'
        return [
          new Date(c.created_at).toLocaleDateString('pt-BR'),
          c.cliente ?? '—',
          c.responsavel ?? '—',
          c.modelo,
          c.ambiente ?? '—',
          c.tecido ?? '—',
          lxa,
          String(c.quantidade ?? '—'),
          c.custo_material != null ? formatCurrency(c.custo_material) : '—',
          c.custo_m2 != null ? formatCurrency(c.custo_m2) : '—',
          c.custo_acabamento != null ? formatCurrency(c.custo_acabamento) : '—',
          c.custo_instalacao != null ? formatCurrency(c.custo_instalacao) : '—',
          formatCurrency(total),
        ]
      }),
      foot: [[
        '', '', '', '', '', '', '',
        `${filteredCI.length} reg.`,
        formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_material ?? 0), 0)),
        '',
        formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_acabamento ?? 0), 0)),
        formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_instalacao ?? 0), 0)),
        formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0), 0)),
      ]],
      theme: 'striped',
      headStyles: { fillColor: orange, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      footStyles: { fontStyle: 'bold', fillColor: [245, 245, 245] as [number, number, number], textColor: [40, 40, 40] as [number, number, number], fontSize: 8 },
      columnStyles: { 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' }, 12: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 8, right: 8 },
    })

    doc.save(`custos-internos-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  return (
    <div className="space-y-4">

      {/* Cabeçalho de seção — fora dos cards, igual ao padrão de Orçamentos */}
      <div className="text-center">
        <h2 className="font-display text-base font-semibold">Planilha de Custos</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {filteredCI.length} registro{filteredCI.length !== 1 ? 's' : ''}{isFilteredCI ? ' filtrados' : ''}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCustosOpen(v => !v)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title={custosOpen ? 'Minimizar tabela' : 'Expandir tabela'}
          >
            {custosOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        {toast && (
          <button
            onClick={() => setFormOpen(true)}
            className="hidden md:flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand hover:opacity-90 hover:scale-105 active:scale-95 transition-all duration-150"
          >
            <Plus className="h-4 w-4" />
            Novo Custo
          </button>
        )}
      </div>

      {/* FiltersBar standalone */}
      <div className="rounded-xl border-2 border-border bg-card shadow-sm">
        {/* Busca sempre visível + toggle filtros */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <input
              id="custos-search"
              value={searchCI}
              onChange={(e) => setSearchCI(e.target.value)}
              placeholder="Buscar cliente, responsável, modelo, ambiente…"
              className={`w-full rounded-lg border border-border bg-background py-2 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all duration-150 ${searchCI ? 'pr-8' : 'pr-10'}`}
            />
            {searchCI ? (
              <button
                onClick={() => setSearchCI('')}
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

          <button
            onClick={() => setFiltersOpen(v => !v)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all duration-150 active:scale-95 ${
              filtersOpen || activeCount > 0
                ? 'border-primary/40 bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-muted/40'
            }`}
            title={filtersOpen ? 'Recolher filtros' : 'Expandir filtros'}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
            {activeCount > 0 && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white px-1">
                {activeCount}
              </span>
            )}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Painel expansível */}
        {filtersOpen && (
          <div className="border-t border-border/50 bg-muted/20 px-4 pb-4 pt-3 flex flex-col gap-3 rounded-b-xl">
            {/* Período */}
            <div className="flex gap-0.5 rounded-lg bg-card border border-border p-1 shadow-sm w-fit">
              {PERIODOS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPeriodoCI(value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 whitespace-nowrap ${
                    periodoCI === value
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Selects */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex-1 min-w-[160px]">
                <CustomSelect
                  value={responsavelCI}
                  onChange={setResponsavelCI}
                  options={[{ value: 'todos', label: 'Todos responsáveis' }, ...responsaveisCI.map(r => ({ value: r, label: r }))]}
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <CustomSelect
                  value={modeloCI}
                  onChange={setModeloCI}
                  options={[{ value: 'todos', label: 'Todos modelos' }, ...modelosCI.map(m => ({ value: m, label: m }))]}
                />
              </div>
            </div>

            {/* Data customizada */}
            {periodoCI === 'custom' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-muted-foreground shrink-0">De</span>
                  <DatePicker value={dateFromCI} onChange={setDateFromCI} placeholder="Data inicial" max={dateToCI || undefined} />
                  <span className="text-xs font-medium text-muted-foreground shrink-0">até</span>
                  <DatePicker value={dateToCI} onChange={setDateToCI} placeholder="Data final" min={dateFromCI || undefined} />
                </div>
                {dateFromCI && dateToCI && dateToCI < dateFromCI && (
                  <p className="text-xs font-medium text-destructive flex items-center gap-1">
                    ⚠ Data final é anterior à inicial — nenhum resultado será exibido.
                  </p>
                )}
              </div>
            )}

            {/* Chips */}
            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-xs text-muted-foreground shrink-0">Ativos:</span>
                {chips.map((chip, i) => (
                  <span
                    key={`${chip.label}-${i}`}
                    className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {chip.label}
                    <button onClick={chip.onRemove} className="hover:text-primary/60 transition-colors" aria-label={`Remover filtro ${chip.label}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  onClick={clearFiltersCI}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2 ml-1"
                >
                  Limpar tudo
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card da tabela */}
      {custosOpen && <div className="rounded-xl border-2 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-display text-sm font-medium tracking-wide">Planilha de Custos Internos</h2>
          <div className="flex items-center gap-2">
            {/* Seletor de colunas */}
            <div ref={colsRef} className="relative">
              <button
                onClick={() => setColsOpen(v => !v)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-95 ${colsOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                title="Mostrar/ocultar colunas"
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Colunas</span>
              </button>
              {colsOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-border bg-card shadow-elevated p-2 flex flex-col gap-0.5">
                  {CUSTO_COL_DEFS.filter(c => c.optional).map(c => (
                    <label key={c.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer hover:bg-muted/60 transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={vis(c.id)}
                        onChange={() => setColVis(v => ({ ...v, [c.id]: !v[c.id] }))}
                        className="accent-primary h-3.5 w-3.5"
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {/* Exports */}
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button onClick={exportCsvCI} disabled={filteredCI.length === 0} title={`Exportar ${filteredCI.length} registros como CSV`} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                <Download className="h-3.5 w-3.5" />CSV
              </button>
              <button onClick={exportXlsxCI} disabled={filteredCI.length === 0} title={`Exportar ${filteredCI.length} registros como XLSX`} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                <Download className="h-3.5 w-3.5" />XLSX
              </button>
              <button onClick={exportPdfCI} disabled={filteredCI.length === 0} title={`Exportar ${filteredCI.length} registros como PDF`} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                <FileDown className="h-3.5 w-3.5" />PDF
              </button>
            </div>
          </div>
        </div>

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
            ) : filteredCI.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum registro encontrado com os filtros aplicados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {visibleCustoCols.map(c => (
                        <th key={c.id} className={"whitespace-nowrap px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80"}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCI.map((c, i) => {
                      const total = (c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0)
                      const lxa = c.largura != null && c.altura != null
                        ? `${c.largura.toFixed(2).replace('.', ',')} × ${c.altura.toFixed(2).replace('.', ',')}`
                        : null
                      const stripe = i % 2 === 1 ? 'bg-muted/[0.15]' : ''
                      return (
                        <tr key={c.id} className={`border-b last:border-0 hover:bg-primary/[0.04] transition-colors ${stripe}`}>
                          {vis('data')        && <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>}
                          {vis('cliente')     && <td className="px-4 py-3 font-medium">{c.cliente ?? <span className="text-muted-foreground/30">—</span>}</td>}
                          {vis('responsavel') && <td className="px-4 py-3">{c.responsavel ?? <span className="text-muted-foreground/30">—</span>}</td>}
                          {vis('modelo')      && <td className="px-4 py-3 font-medium">{c.modelo}</td>}
                          {vis('ambiente')    && <td className="px-4 py-3">{c.ambiente ? <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{c.ambiente}</span> : <span className="text-muted-foreground/20">—</span>}</td>}
                          {vis('tecido')      && <td className="px-4 py-3 text-muted-foreground">{c.tecido ?? <span className="opacity-30">—</span>}</td>}
                          {vis('lxa')         && <td className="px-4 py-3 text-center whitespace-nowrap">{lxa ?? <span className="text-muted-foreground/20">—</span>}</td>}
                          {vis('qtd')         && <td className="px-4 py-3 text-center">{c.quantidade ?? <span className="text-muted-foreground/20">—</span>}</td>}
                          {vis('custo_mat')   && <td className="px-4 py-3 text-center whitespace-nowrap font-medium">{c.custo_material != null ? formatCurrency(c.custo_material) : <span className="text-muted-foreground/20">—</span>}</td>}
                          {vis('custo_m2')    && <td className="px-4 py-3 text-center whitespace-nowrap">{c.custo_m2 != null ? formatCurrency(c.custo_m2) : <span className="text-muted-foreground/20">—</span>}</td>}
                          {vis('custo_acab')  && <td className="px-4 py-3 text-center whitespace-nowrap">{c.custo_acabamento != null ? formatCurrency(c.custo_acabamento) : <span className="text-muted-foreground/20">—</span>}</td>}
                          {vis('custo_inst')  && <td className="px-4 py-3 text-center whitespace-nowrap">{c.custo_instalacao != null ? formatCurrency(c.custo_instalacao) : <span className="text-muted-foreground/20">—</span>}</td>}
                          {vis('total')       && <td className="px-4 py-3 text-center whitespace-nowrap font-bold text-primary">{formatCurrency(total)}</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/30">
                      <td colSpan={visibleCustoCols.findIndex(c => c.id === 'custo_mat')} className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Totais — {filteredCI.length} registro{filteredCI.length !== 1 ? 's' : ''}
                      </td>
                      {vis('custo_mat')  && <td className="px-4 py-2.5 text-center font-semibold whitespace-nowrap">{formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_material ?? 0), 0))}</td>}
                      {vis('custo_m2')   && <td className="px-4 py-2.5" />}
                      {vis('custo_acab') && <td className="px-4 py-2.5 text-center font-semibold whitespace-nowrap">{formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_acabamento ?? 0), 0))}</td>}
                      {vis('custo_inst') && <td className="px-4 py-2.5 text-center font-semibold whitespace-nowrap">{formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_instalacao ?? 0), 0))}</td>}
                      {vis('total')      && <td className="px-4 py-2.5 text-center font-bold text-primary whitespace-nowrap">{formatCurrency(filteredCI.reduce((s, c) => s + (c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0), 0))}</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
        </>
      </div>}

      {/* Mobile FABs */}
      <div className="fixed bottom-6 right-4 z-40 md:hidden flex flex-col gap-3 items-end">
        {toast && (
          <button
            onClick={() => setFormOpen(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white hover:scale-110 active:scale-90 transition-all duration-200 shadow-brand"
            aria-label="Novo Custo"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
        <button
          onClick={exportXlsxCI}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:scale-110 active:scale-90 transition-all duration-200 shadow-sm"
          aria-label="Exportar XLSX"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>

      {toast && (
        <NovoCustoInternoForm toast={toast} open={formOpen} onClose={() => setFormOpen(false)} />
      )}
    </div>
  )
}
