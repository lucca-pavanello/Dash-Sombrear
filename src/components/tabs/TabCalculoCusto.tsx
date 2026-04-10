import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency } from '@/lib/utils'
import { Calculator, AlertCircle, ChevronDown, ChevronUp, Search, X, Download, SlidersHorizontal, Plus, FileText } from 'lucide-react'
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

  const [searchCI, setSearchCI] = useState('')
  const [responsavelCI, setResponsavelCI] = useState('todos')
  const [modeloCI, setModeloCI] = useState('todos')
  const [periodoCI, setPeriodoCI] = useState('todos')
  const [dateFromCI, setDateFromCI] = useState('')
  const [dateToCI, setDateToCI] = useState('')
  const debouncedSearchCI = useDebounce(searchCI, 220)

  useEffect(() => {
    try { localStorage.setItem(TABLE_OPEN_KEY, String(custosOpen)) }
    catch { /* noop */ }
  }, [custosOpen])

  useEffect(() => {
    try { localStorage.setItem(FILTERS_OPEN_KEY, String(filtersOpen)) }
    catch { /* noop */ }
  }, [filtersOpen])

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

  function exportPdfCI() {
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
              placeholder="Buscar cliente, responsável, modelo, ambiente..."
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
            {toast && (
              <button
                onClick={() => setFormOpen(true)}
                className="hidden md:flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-brand hover:opacity-90 active:scale-95 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Custo
              </button>
            )}
            <button onClick={exportCsvCI} className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-all active:scale-95">
              <Download className="h-3.5 w-3.5" />CSV
            </button>
            <button onClick={exportXlsxCI} className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-all active:scale-95">
              <Download className="h-3.5 w-3.5" />XLSX
            </button>
            <button onClick={exportPdfCI} className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-all active:scale-95">
              <FileText className="h-3.5 w-3.5" />PDF
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
            ) : filteredCI.length === 0 ? (
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
      </div>

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
