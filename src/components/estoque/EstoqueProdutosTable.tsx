import { useState, useMemo } from 'react'
import { Search, X, Plus, Pencil, PackageX, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { useEstoqueProdutos, useDeactivateEstoqueProduto } from '@/hooks/useEstoqueProdutos'
import { useEstoqueLocalizacoes } from '@/hooks/useEstoqueLocalizacoes'
import { TIPOS_PRODUTO, CLASSES_ABC } from '@/lib/constants'
import type { EstoqueProduto } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

type TipoMov = 'entrada' | 'saida' | 'ajuste' | 'perda'
type TipoFilter = 'todos' | 'tecido' | 'ferragem' | 'acessorio'
type AbcFilter = 'todas' | 'A' | 'B' | 'C' | 'sem_dados'

interface Props {
  toast: (type: ToastType, message: string) => void
  onNovoProduto: () => void
  onEditar: (p: EstoqueProduto) => void
  onMovimentar: (p: EstoqueProduto, tipo: TipoMov) => void
}

const ABC_BADGE: Record<string, string> = {
  A:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B:         'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  C:         'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  sem_dados: 'bg-muted text-muted-foreground',
}

export default function EstoqueProdutosTable({ toast, onNovoProduto, onEditar, onMovimentar }: Props) {
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos')
  const [abcFilter, setAbcFilter] = useState<AbcFilter>('todas')
  const [localizacaoFilter, setLocalizacaoFilter] = useState<string>('todas')
  const [mostrarInativos, setMostrarInativos] = useState(false)

  const { data: produtos = [], isLoading } = useEstoqueProdutos({ includeInactive: mostrarInativos })
  const { data: localizacoes = [] } = useEstoqueLocalizacoes()
  const deactivate = useDeactivateEstoqueProduto()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return produtos.filter((p) => {
      if (q && !p.nome.toLowerCase().includes(q) && !p.codigo?.toLowerCase().includes(q)) return false
      if (tipoFilter !== 'todos' && p.estoque_categorias?.tipo !== tipoFilter) return false
      if (abcFilter !== 'todas' && (p.classificacao_abc ?? 'sem_dados') !== abcFilter) return false
      if (localizacaoFilter === 'sem') {
        if (p.localizacao_id != null) return false
      } else if (localizacaoFilter !== 'todas') {
        if (p.localizacao_id !== localizacaoFilter) return false
      }
      return true
    })
  }, [produtos, search, tipoFilter, abcFilter, localizacaoFilter])

  async function handleDesativar(p: EstoqueProduto) {
    if (!window.confirm(`Desativar "${p.nome}"? O produto não aparecerá mais no estoque.`)) return
    try {
      await deactivate.mutateAsync(p.id)
      toast('success', `Produto "${p.nome}" desativado.`)
    } catch {
      toast('error', 'Erro ao desativar produto.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-xl skeleton-shimmer" />
        ))}
      </div>
    )
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
            placeholder="Buscar por nome ou SKU..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tipo */}
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value as TipoFilter)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-all"
        >
          <option value="todos">Todos os tipos</option>
          <option value="tecido">Tecido</option>
          <option value="ferragem">Ferragem</option>
          <option value="acessorio">Acessório</option>
        </select>

        {/* Classe ABC */}
        <select
          value={abcFilter}
          onChange={(e) => setAbcFilter(e.target.value as AbcFilter)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-all"
        >
          <option value="todas">Todas as classes</option>
          <option value="A">Classe A</option>
          <option value="B">Classe B</option>
          <option value="C">Classe C</option>
          <option value="sem_dados">Sem dados</option>
        </select>

        {/* Localização */}
        <select
          value={localizacaoFilter}
          onChange={(e) => setLocalizacaoFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-all"
        >
          <option value="todas">Todas as localizações</option>
          <option value="sem">Sem localização</option>
          {localizacoes.map((l) => (
            <option key={l.id} value={l.id}>{l.codigo} – {l.setor}</option>
          ))}
        </select>

        {/* Toggle inativos */}
        <button
          type="button"
          role="switch"
          aria-checked={mostrarInativos}
          onClick={() => setMostrarInativos((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all',
            mostrarInativos
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
          )}
        >
          <span className={cn(
            'inline-block h-4 w-7 rounded-full transition-colors relative',
            mostrarInativos ? 'bg-primary' : 'bg-muted-foreground/30'
          )}>
            <span className={cn(
              'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
              mostrarInativos ? 'translate-x-3.5' : 'translate-x-0.5'
            )} />
          </span>
          Inativos
        </button>

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
        <table className="w-full text-sm" style={{ minWidth: '960px' }}>
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SKU</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Tipo</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Unidade</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estoque atual</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Localização</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Custo médio</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Preço venda</th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">ABC</th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const abc = p.classificacao_abc ?? 'sem_dados'
                const inativo = !p.ativo
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/20 transition-colors',
                      inativo && 'opacity-50'
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {p.codigo ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.nome}</span>
                        {inativo && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            Inativo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {TIPOS_PRODUTO[p.estoque_categorias?.tipo ?? ''] ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell uppercase">
                      {p.unidade}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      {p.quantidade_atual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{p.unidade}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      {p.localizacao?.codigo ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap hidden xl:table-cell">
                      {p.custo_unitario != null ? formatCurrency(p.custo_unitario) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap hidden xl:table-cell">
                      {p.preco_venda != null ? formatCurrency(p.preco_venda) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', ABC_BADGE[abc])}>
                        {CLASSES_ABC[abc] ?? abc}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <ActionBtn
                          icon={<TrendingUp className="h-3.5 w-3.5" />}
                          label="Registrar entrada"
                          className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          onClick={() => onMovimentar(p, 'entrada')}
                        />
                        <ActionBtn
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          label="Editar"
                          className="text-muted-foreground hover:bg-muted"
                          onClick={() => onEditar(p)}
                        />
                        {p.ativo && (
                          <ActionBtn
                            icon={<PackageX className="h-3.5 w-3.5" />}
                            label="Desativar"
                            className="text-muted-foreground/60 hover:bg-muted hover:text-destructive"
                            onClick={() => handleDesativar(p)}
                          />
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
              <tr className="border-t border-border" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                <td colSpan={4} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total — {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
                </td>
                <td colSpan={6} />
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
      className={cn('rounded-lg p-1.5 transition-colors', className)}
    >
      {icon}
    </button>
  )
}
