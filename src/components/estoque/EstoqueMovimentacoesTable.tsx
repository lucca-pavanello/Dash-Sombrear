import { useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEstoqueMovimentacoes } from '@/hooks/useEstoqueMovimentacoes'
import { useEstoqueProdutos } from '@/hooks/useEstoqueProdutos'
import type { MovimentacaoFilters } from '@/hooks/useEstoqueMovimentacoes'

const TIPO_BADGE: Record<string, string> = {
  entrada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  saida:   'bg-destructive/10 text-destructive',
  ajuste:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  perda:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}
const TIPO_LABEL: Record<string, string> = {
  entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', perda: 'Perda',
}
const TIPO_SINAL: Record<string, string> = {
  entrada: '+', saida: '−', perda: '−', ajuste: '=',
}

interface Props {
  defaultTipo?: string
  headerAction?: React.ReactNode
}

export default function EstoqueMovimentacoesTable({ defaultTipo = '', headerAction }: Props) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState(defaultTipo)
  const [produtoFilter, setProdutoFilter] = useState('')

  const filters: MovimentacaoFilters = {
    page,
    tipo: tipoFilter || undefined,
    produto_id: produtoFilter || undefined,
  }

  const { data, isLoading } = useEstoqueMovimentacoes(filters)
  const { data: produtos = [] } = useEstoqueProdutos()

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const PAGE_SIZE = 30
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        {headerAction && <div className="w-full sm:w-auto sm:ml-auto order-last sm:order-none">{headerAction}</div>}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar responsável..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select
          value={produtoFilter}
          onChange={(e) => { setProdutoFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-all"
        >
          <option value="">Todos os produtos</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>

        <select
          value={tipoFilter}
          onChange={(e) => { setTipoFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-all"
        >
          <option value="">Todos os tipos</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
          <option value="ajuste">Ajuste</option>
          <option value="perda">Perda</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '640px' }}>
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto</th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quantidade</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Responsável</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma movimentação encontrada.
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const unidade = m.estoque_produtos?.unidade ?? ''
                const sinal = TIPO_SINAL[m.tipo] ?? ''
                const isNeg = m.tipo === 'saida' || m.tipo === 'perda'
                return (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-medium max-w-[180px] truncate" title={m.estoque_produtos?.nome}>
                      {m.estoque_produtos?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', TIPO_BADGE[m.tipo] ?? '')}>
                        {TIPO_LABEL[m.tipo] ?? m.tipo}
                      </span>
                    </td>
                    <td className={cn('px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums', isNeg ? 'text-destructive' : m.tipo === 'ajuste' ? 'text-blue-600' : 'text-emerald-600')}>
                      {sinal}{m.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{unidade}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">{m.responsavel}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate hidden lg:table-cell" title={m.motivo ?? undefined}>
                      {m.motivo || <span className="italic opacity-50">—</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-medium tabular-nums">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
