import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { formatCurrency } from '@/lib/utils'
import { Calculator, AlertCircle, ChevronDown, ChevronUp, Search, X, Download } from 'lucide-react'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import { useCustosInternos } from '@/hooks/useCustosInternos'
import { useDebounce } from '@/hooks/useDebounce'
import { CustomSelect } from '@/components/ui/CustomSelect'
import DatePicker from '@/components/ui/DatePicker'

interface Props {
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

export default function TabCalculoCusto({ isLoading, error }: Props) {
  // — todos os hooks primeiro, antes de qualquer early return —
  const [custosOpen, setCustosOpen] = useState(true)

  // filtros custos internos
  const [searchCI, setSearchCI] = useState('')
  const [responsavelCI, setResponsavelCI] = useState('todos')
  const [modeloCI, setModeloCI] = useState('todos')
  const [periodoCI, setPeriodoCI] = useState('todos')
  const [dateFromCI, setDateFromCI] = useState('')
  const [dateToCI, setDateToCI] = useState('')
  const debouncedSearchCI = useDebounce(searchCI, 220)

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

  const custosDoMes = useMemo(() => {
    const now = new Date()
    return custosInternos.filter((c) => {
      const d = new Date(c.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
  }, [custosInternos])

  const custoTotalMes = useMemo(() =>
    custosDoMes.reduce((s, c) => s + (c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0), 0),
    [custosDoMes])

  const custosNaSemana = useMemo(() =>
    filterByPeriod(custosInternos, 'semana', (c) => c.created_at).length,
    [custosInternos])

  const custoTotalGeral = useMemo(() =>
    custosInternos.reduce((s, c) => s + (c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0), 0),
    [custosInternos])

  const custoPorModelo = useMemo(() => {
    const map: Record<string, { count: number; total: number; tecidos: Record<string, number> }> = {}
    for (const c of custosInternos) {
      if (!map[c.modelo]) map[c.modelo] = { count: 0, total: 0, tecidos: {} }
      map[c.modelo].count++
      map[c.modelo].total += (c.custo_material ?? 0) + (c.custo_acabamento ?? 0) + (c.custo_instalacao ?? 0)
      if (c.tecido) map[c.modelo].tecidos[c.tecido] = (map[c.modelo].tecidos[c.tecido] ?? 0) + 1
    }
    return Object.entries(map)
      .map(([modelo, s]) => ({
        modelo,
        count: s.count,
        total: s.total,
        media: s.count > 0 ? s.total / s.count : 0,
        topTecido: Object.entries(s.tecidos).sort(([, a], [, b]) => b - a)[0] ?? null,
      }))
      .sort((a, b) => b.total - a.total)
  }, [custosInternos])

  // early returns depois de todos os hooks
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

  return (
    <div className="space-y-6">

      {/* KPIs */}
      {!custosLoading && custosInternos.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Custo Total no Mês', value: formatCurrency(custoTotalMes), sub: `${custosDoMes.length} cálculo${custosDoMes.length !== 1 ? 's' : ''} este mês` },
            { label: 'Cálculos na Semana', value: String(custosNaSemana), sub: 'registros nos últimos 7 dias' },
            { label: 'Custo Total Geral', value: formatCurrency(custoTotalGeral), sub: `${custosInternos.length} cálculo${custosInternos.length !== 1 ? 's' : ''} no total` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm cursor-default">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="font-display mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Custo por Modelo */}
      {!custosLoading && custoPorModelo.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b px-5 py-4">
            <h3 className="font-display text-sm font-medium tracking-wide">Custo por Modelo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{custosInternos.length} cálculo{custosInternos.length !== 1 ? 's' : ''} registrados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 560 }}>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-5 py-3.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">Modelo</th>
                  <th className="px-5 py-3.5 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wide">Qtd.</th>
                  <th className="px-5 py-3.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide">Custo Total</th>
                  <th className="px-5 py-3.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide">Custo Médio</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide">Top Tecido</th>
                </tr>
              </thead>
              <tbody>
                {custoPorModelo.map(({ modelo, count, total, media, topTecido }) => (
                  <tr key={modelo} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium">{modelo}</td>
                    <td className="px-5 py-3.5 text-center tabular-nums text-muted-foreground">{count}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-medium">{formatCurrency(total)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{formatCurrency(media)}</td>
                    <td className="px-5 py-3.5">
                      {topTecido
                        ? <span className="inline-flex items-center gap-1.5 text-xs"><span>{topTecido[0]}</span><span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary leading-none">{topTecido[1]}×</span></span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-widest">Total</td>
                  <td className="px-5 py-3 text-center tabular-nums">{custosInternos.length}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-primary">{formatCurrency(custoTotalGeral)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{custosInternos.length > 0 ? formatCurrency(custoTotalGeral / custosInternos.length) : '—'}</td>
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

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
