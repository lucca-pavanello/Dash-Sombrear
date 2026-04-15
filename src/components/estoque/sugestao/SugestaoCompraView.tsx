import { useState, useMemo } from 'react'
import { Package, AlertTriangle, AlertCircle, DollarSign, Download } from 'lucide-react'
import KpiCard from '@/components/shared/KpiCard'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { useSugestaoCompra } from '@/hooks/useEstoqueSugestao'
import type { SugestaoCompra } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

interface Props {
  toast: (type: ToastType, message: string) => void
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

const ROW_BG: Record<string, string> = {
  critico:       '',
  abaixo_minimo: '',
  atencao:       '',
  ok:            '',
}

const URGENCIA_LABEL: Record<string, string> = {
  critico:       'Crítico',
  abaixo_minimo: 'Abaixo do mínimo',
  atencao:       'Atenção',
  ok:            'OK',
}

const URGENCIA_BADGE: Record<string, string> = {
  critico:       'bg-destructive/10 text-destructive',
  abaixo_minimo: 'bg-muted text-foreground',
  atencao:       'bg-muted text-muted-foreground',
  ok:            'bg-muted text-muted-foreground',
}

export default function SugestaoCompraView({ toast }: Props) {
  const { data = [], isLoading } = useSugestaoCompra()

  const [filtroUrgencia, setFiltroUrgencia]     = useState<string>('todas')
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>('todos')
  const [selecionados, setSelecionados]         = useState<Set<string>>(new Set())

  const totalClasseA    = data.length
  const sugestoesAtivas = data.filter(r => r.urgencia !== 'ok').length
  const criticos        = data.filter(r => r.urgencia === 'critico').length
  const compraEstimada  = data.filter(r => r.urgencia !== 'ok').reduce((s, r) => s + r.custo_estimado, 0)

  const fornecedores = useMemo(() =>
    [...new Set(data.map(r => r.fornecedor_nome ?? 'Sem fornecedor'))].sort()
  , [data])

  const filtrado = useMemo(() =>
    data.filter(r =>
      (filtroUrgencia === 'todas' || r.urgencia === filtroUrgencia) &&
      (filtroFornecedor === 'todos' || (r.fornecedor_nome ?? 'Sem fornecedor') === filtroFornecedor)
    )
  , [data, filtroUrgencia, filtroFornecedor])

  const todosSelecionados = filtrado.length > 0 && selecionados.size === filtrado.length

  function toggleTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(filtrado.map(r => r.id)))
  }

  function toggleItem(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function gerarPedidos() {
    const itens = filtrado.filter(r => selecionados.has(r.id))
    const porFornecedor = new Map<string, SugestaoCompra[]>()

    itens.forEach(item => {
      const key = item.fornecedor_nome ?? 'sem_fornecedor'
      if (!porFornecedor.has(key)) porFornecedor.set(key, [])
      porFornecedor.get(key)!.push(item)
    })

    const hoje = new Date().toISOString().slice(0, 10)
    let count = 0

    porFornecedor.forEach((rows, fornecedor) => {
      const slug = fornecedor
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

      const header = ['SKU', 'Nome', 'Quantidade', 'Custo unitário', 'Total', 'Fornecedor']
      const csvRows = rows.map(r => [
        r.codigo ?? '',
        r.nome,
        String(Math.ceil(r.lec_sugerido)),
        String((r.custo_unitario ?? 0).toFixed(2)).replace('.', ','),
        String((Math.ceil(r.lec_sugerido) * (r.custo_unitario ?? 0)).toFixed(2)).replace('.', ','),
        fornecedor,
      ])

      const csv = [header, ...csvRows].map(r => r.join(';')).join('\r\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pedido_${slug}_${hoje}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      count++
    })

    toast('success', `${count} arquivo(s) gerado(s)`)
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-base font-semibold">O que comprar agora — detalhe completo</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Produtos classe A ranqueados por urgência.{' '}
          <InfoTooltip label="LEC" tip="Lote Econômico de Compra. Quantidade ideal a comprar de cada vez pra gastar menos com pedidos e armazenagem. Calculado pelo sistema com base nas vendas dos últimos 12 meses." />{' '}
          baseado em demanda dos últimos 12 meses.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            title="Total classe A"
            value={String(totalClasseA)}
            subtitle="produtos ativos"
            icon={<Package className="h-4 w-4" />}
            variant="default"
          />
          <KpiCard
            title="Sugestões ativas"
            value={String(sugestoesAtivas)}
            subtitle="abaixo do ideal"
            icon={<AlertTriangle className="h-4 w-4" />}
            variant="amber"
          />
          <KpiCard
            title="Críticos"
            value={String(criticos)}
            subtitle="estoque esgotado"
            icon={<AlertCircle className="h-4 w-4" />}
            variant={criticos > 0 ? 'orange' : 'default'}
          />
          <KpiCard
            title="Compra estimada"
            value={fmtBRL(compraEstimada)}
            subtitle="custo sugestões ativas"
            icon={<DollarSign className="h-4 w-4" />}
            variant="default"
          />
        </div>
      )}

      <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroUrgencia}
              onChange={e => setFiltroUrgencia(e.target.value)}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="todas">Todas urgências</option>
              <option value="critico">Crítico</option>
              <option value="abaixo_minimo">Abaixo do mínimo</option>
              <option value="atencao">Atenção</option>
              <option value="ok">OK</option>
            </select>

            <select
              value={filtroFornecedor}
              onChange={e => setFiltroFornecedor(e.target.value)}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="todos">Todos fornecedores</option>
              {fornecedores.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            {selecionados.size > 0 && (
              <span className="text-xs text-muted-foreground">{selecionados.size} selecionado(s)</span>
            )}
          </div>

          <button
            onClick={gerarPedidos}
            disabled={selecionados.size === 0}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Gerar Pedido ({selecionados.size})
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 rounded-lg skeleton-shimmer" />
            ))}
          </div>
        ) : filtrado.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground px-4">
            Nenhum produto encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={todosSelecionados}
                      onChange={toggleTodos}
                      className="rounded border-input accent-primary"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">Urgência</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">SKU</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">Nome</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Estoque</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Mínimo</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Déficit</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">
                    <InfoTooltip label="LEC sugerido" tip="Lote Econômico de Compra. Quantidade ideal a comprar de cada vez pra gastar menos com pedidos e armazenagem." />
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">Fornecedor</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Lead time</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted-foreground">Custo estimado</th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map(row => (
                  <tr
                    key={row.id}
                    className={`border-b last:border-0 transition-colors hover:brightness-95 ${ROW_BG[row.urgencia] ?? ''}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selecionados.has(row.id)}
                        onChange={() => toggleItem(row.id)}
                        className="rounded border-input accent-primary"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${URGENCIA_BADGE[row.urgencia] ?? ''}`}>
                        {URGENCIA_LABEL[row.urgencia] ?? row.urgencia}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.codigo ?? '—'}</td>
                    <td className="px-3 py-2 max-w-[140px] truncate text-xs font-medium" title={row.nome}>{row.nome}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtNum(row.quantidade_atual)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">{fmtNum(row.quantidade_minima)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums font-medium">
                      {row.deficit > 0
                        ? <span className="text-red-600">{fmtNum(row.deficit)}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums font-medium text-primary">
                      {fmtNum(row.lec_sugerido)}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[120px] truncate" title={row.fornecedor_nome ?? ''}>
                      {row.fornecedor_nome ?? <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {row.prazo_entrega_dias !== null ? `${row.prazo_entrega_dias}d` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums font-medium">
                      {fmtBRL(row.custo_estimado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
