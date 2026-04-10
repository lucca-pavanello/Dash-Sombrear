import { useState, useMemo } from 'react'
import { Search, X, Plus, TrendingUp, TrendingDown, RefreshCw, Pencil, PackageX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { useDeactivateEstoqueProduto } from '@/hooks/useEstoqueProdutos'
import type { EstoqueProduto, EstoqueProdutoAlerta } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

type TipoMov = 'entrada' | 'saida' | 'ajuste' | 'perda'

interface Props {
  produtos: EstoqueProduto[]
  alertas: EstoqueProdutoAlerta[]
  toast: (type: ToastType, message: string) => void
  onNovoProduto: () => void
  onEditar: (p: EstoqueProduto) => void
  onMovimentar: (p: EstoqueProduto, tipo: TipoMov) => void
}

type StatusFilter = 'todos' | 'alerta' | 'ok'

function getStatus(p: EstoqueProduto): 'zerado' | 'baixo' | 'ok' {
  if (p.quantidade_atual <= 0 && p.quantidade_minima > 0) return 'zerado'
  if (p.quantidade_minima > 0 && p.quantidade_atual <= p.quantidade_minima) return 'baixo'
  return 'ok'
}

const STATUS_BADGE: Record<string, string> = {
  ok:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  baixo:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  zerado: 'bg-destructive/10 text-destructive',
}
const STATUS_LABEL: Record<string, string> = {
  ok: 'OK', baixo: '⚠ Baixo', zerado: '🔴 Zerado',
}

export default function EstoqueProdutosTable({
  produtos, alertas, toast, onNovoProduto, onEditar, onMovimentar,
}: Props) {
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('todas')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')

  const deactivate = useDeactivateEstoqueProduto()

  const alertaIds = useMemo(() => new Set(alertas.map((a) => a.id)), [alertas])

  const categorias = useMemo(() => {
    const cats = new Set<string>()
    produtos.forEach((p) => {
      if (p.estoque_categorias?.nome) cats.add(p.estoque_categorias.nome)
    })
    return Array.from(cats).sort()
  }, [produtos])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return produtos.filter((p) => {
      if (q && !p.nome.toLowerCase().includes(q) && !p.codigo?.toLowerCase().includes(q) && !p.fornecedor?.toLowerCase().includes(q)) return false
      if (categoriaFilter !== 'todas' && p.estoque_categorias?.nome !== categoriaFilter) return false
      if (statusFilter === 'alerta' && !alertaIds.has(p.id)) return false
      if (statusFilter === 'ok' && alertaIds.has(p.id)) return false
      return true
    })
  }, [produtos, search, categoriaFilter, statusFilter, alertaIds])

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
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        {/* Busca */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Categoria */}
        <select
          value={categoriaFilter}
          onChange={(e) => setCategoriaFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-all"
        >
          <option value="todas">Todas categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Status */}
        <div className="flex gap-0.5 rounded-lg bg-card border border-border p-1">
          {(['todos', 'alerta', 'ok'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold transition-all active:scale-95 capitalize',
                statusFilter === s ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              {s === 'todos' ? 'Todos' : s === 'alerta' ? '⚠ Alerta' : '✓ OK'}
            </button>
          ))}
        </div>

        <button
          onClick={onNovoProduto}
          className="flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand hover:opacity-90 hover:scale-105 active:scale-95 transition-all ml-auto"
        >
          <Plus className="h-4 w-4" />
          Novo Produto
        </button>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '800px' }}>
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Categoria</th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Qtd Atual</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Mínimo</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Custo/Un</th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const status = getStatus(p)
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.nome}</p>
                      {p.codigo && <p className="text-xs text-muted-foreground">{p.codigo}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {p.estoque_categorias?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_BADGE[status])}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      {p.quantidade_atual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{p.unidade}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                      {p.quantidade_minima.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {p.unidade}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap hidden xl:table-cell">
                      {p.custo_unitario ? formatCurrency(p.custo_unitario) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <ActionBtn
                          icon={<TrendingUp className="h-3.5 w-3.5" />}
                          label="Entrada"
                          className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          onClick={() => onMovimentar(p, 'entrada')}
                        />
                        <ActionBtn
                          icon={<TrendingDown className="h-3.5 w-3.5" />}
                          label="Saída"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => onMovimentar(p, 'saida')}
                        />
                        <ActionBtn
                          icon={<RefreshCw className="h-3.5 w-3.5" />}
                          label="Ajuste"
                          className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          onClick={() => onMovimentar(p, 'ajuste')}
                        />
                        <ActionBtn
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          label="Editar"
                          className="text-muted-foreground hover:bg-muted"
                          onClick={() => onEditar(p)}
                        />
                        <ActionBtn
                          icon={<PackageX className="h-3.5 w-3.5" />}
                          label="Desativar"
                          className="text-muted-foreground/60 hover:bg-muted hover:text-destructive"
                          onClick={() => handleDesativar(p)}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-border" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                <td colSpan={3} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total — {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function ActionBtn({
  icon, label, onClick, className,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        'rounded-lg p-1.5 transition-colors',
        className
      )}
    >
      {icon}
    </button>
  )
}
