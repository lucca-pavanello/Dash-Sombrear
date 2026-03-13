import { useState, useMemo } from 'react'
import { Download, Receipt } from 'lucide-react'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency, formatPercent } from '@/lib/utils'
import SkeletonCard from '@/components/shared/SkeletonCard'
import { filterByPeriod, type Periodo } from '@/hooks/usePeriodFilter'

interface Props {
  data: Orcamento[]
  loading: boolean
}

const PERIODOS: { value: Periodo | 'hoje'; label: string }[] = [
  { value: 'tudo', label: 'Todo período' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mês' },
]

export default function TabPlanilhaCusto({ data, loading }: Props) {
  const [responsavel, setResponsavel] = useState('todos')
  const [modelo, setModelo] = useState('todos')
  const [periodo, setPeriodo] = useState<Periodo | 'hoje'>('mes')
  const [apenasComCusto, setApenasComCusto] = useState(true)

  const responsaveis = useMemo(() => [...new Set(data.map((o) => o.responsavel))].filter(Boolean).sort(), [data])
  const modelos = useMemo(() => [...new Set(data.map((o) => o.modelo))].filter(Boolean).sort(), [data])

  const filtered = useMemo(() => {
    let result: Orcamento[]
    if (periodo === 'hoje') {
      const hoje = new Date().toDateString()
      result = data.filter((o) => o.created_at && new Date(o.created_at).toDateString() === hoje)
    } else {
      result = filterByPeriod(data, periodo)
    }
    if (apenasComCusto) result = result.filter((o) => o.custo_tecido != null && o.custo_tecido > 0)
    if (responsavel !== 'todos') result = result.filter((o) => o.responsavel === responsavel)
    if (modelo !== 'todos') result = result.filter((o) => o.modelo === modelo)
    return result.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [data, periodo, apenasComCusto, responsavel, modelo])

  const totais = useMemo(() => ({
    custoTotal: filtered.reduce((s, o) => s + (o.custo_tecido ?? 0), 0),
    custoAcabamento: filtered.reduce((s, o) => s + (o.custo_acabamento ?? 0), 0),
    valorVenda: filtered.reduce((s, o) => s + (o.valor_venda ?? 0), 0),
    margemMedia: filtered.filter((o) => o.margem != null).length > 0
      ? filtered.filter((o) => o.margem != null).reduce((s, o) => s + (o.margem ?? 0), 0) / filtered.filter((o) => o.margem != null).length
      : null,
  }), [filtered])

  function exportXLSX() {
    import('xlsx').then((XLSX) => {
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
    })
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Planilha de Custo</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={exportXLSX}
          className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar XLSX
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as Periodo | 'hoje')}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {PERIODOS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <select
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="todos">Todos responsáveis</option>
          {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <select
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="todos">Todos modelos</option>
          {modelos.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm cursor-pointer select-none hover:bg-muted/40 transition-colors">
          <input
            type="checkbox"
            checked={apenasComCusto}
            onChange={(e) => setApenasComCusto(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-foreground">Apenas com custo</span>
        </label>
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
                          <span className={o.margem >= 30 ? 'text-green-600 font-medium' : o.margem >= 15 ? 'text-yellow-600 font-medium' : 'text-red-500 font-medium'}>
                            {formatPercent(o.margem)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                  {/* Linha de totais */}
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td colSpan={5} className="px-4 py-3 text-muted-foreground">Total ({filtered.length})</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totais.custoTotal)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totais.custoAcabamento)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totais.valorVenda)}</td>
                    <td className="px-4 py-3 text-right">
                      {totais.margemMedia != null ? formatPercent(totais.margemMedia) : '—'}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
