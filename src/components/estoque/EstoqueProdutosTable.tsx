import { useState, useMemo } from 'react'
import { Search, X, Plus, Pencil, PackageX, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
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
  A:         'bg-primary/10 text-primary',
  B:         'bg-muted text-foreground',
  C:         'bg-muted/60 text-muted-foreground',
  sem_dados: 'bg-muted text-muted-foreground italic',
}

const COL_DIVIDER = 'border-l border-border/40'

// Pills de filtro: opções fixas com poucas entradas
const TIPO_PILLS: { value: TipoFilter; label: string }[] = [
  { value: 'todos',     label: 'Todos' },
  { value: 'tecido',    label: 'Tecido' },
  { value: 'ferragem',  label: 'Ferragem' },
  { value: 'acessorio', label: 'Acessório' },
]

const ABC_PILLS: { value: AbcFilter; label: string }[] = [
  { value: 'todas',     label: 'Todas' },
  { value: 'A',         label: 'A' },
  { value: 'B',         label: 'B' },
  { value: 'C',         label: 'C' },
  { value: 'sem_dados', label: '—' },
]

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
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 border-b px-5 py-3.5">

        {/* Linha 1 — busca + botão novo */}
        <div className="flex items-center gap-2">
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
          <button
            onClick={onNovoProduto}
            className="flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </button>
        </div>

        {/* Linha 2 — filtros por pills + localização select + toggle */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

          {/* Tipo — pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground mr-0.5">Tipo</span>
            {TIPO_PILLS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTipoFilter(value)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all',
                  tipoFilter === value
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-4 border-l border-border/60" />

          {/* Classe ABC — pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground mr-0.5">Classe</span>
            {ABC_PILLS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setAbcFilter(value)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all',
                  abcFilter === value
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-4 border-l border-border/60" />

          {/* Localização — select (dados dinâmicos) */}
          <select
            value={localizacaoFilter}
            onChange={(e) => setLocalizacaoFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs outline-none focus:border-primary transition-all text-foreground"
          >
            <option value="todas">Localização: todas</option>
            <option value="sem">Sem localização</option>
            {localizacoes.map((l) => (
              <option key={l.id} value={l.id}>{l.codigo} – {l.setor}</option>
            ))}
          </select>

          <div className="h-4 border-l border-border/60" />

          {/* Toggle inativos */}
          <button
            type="button"
            role="switch"
            aria-checked={mostrarInativos}
            onClick={() => setMostrarInativos((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all',
              mostrarInativos
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
          >
            <span className={cn(
              'inline-block h-3.5 w-6 rounded-full transition-colors relative shrink-0',
              mostrarInativos ? 'bg-primary' : 'bg-muted-foreground/30'
            )}>
              <span className={cn(
                'absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-transform',
                mostrarInativos ? 'translate-x-2.5' : 'translate-x-0.5'
              )} />
            </span>
            Inativos
          </button>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '960px' }}>
          <thead>
            <tr className="border-b-2 border-border bg-muted/70">
              <th className="pl-6 pr-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-widest text-foreground/60">SKU</th>
              <th className={cn('px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-widest text-foreground/60', COL_DIVIDER)}>Nome</th>
              <th className={cn('px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-widest text-foreground/60 hidden md:table-cell', COL_DIVIDER)}>Tipo</th>
              <th className={cn('px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-widest text-foreground/60 hidden lg:table-cell', COL_DIVIDER)}>Unidade</th>
              <th className={cn('px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-widest text-foreground/60', COL_DIVIDER)}>Estoque atual</th>
              <th className={cn('px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-widest text-foreground/60 hidden lg:table-cell', COL_DIVIDER)}>Localização</th>
              <th className={cn('px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-widest text-foreground/60 hidden xl:table-cell', COL_DIVIDER)}>
                <InfoTooltip label="Custo médio" tip="Custo Médio Ponderado. Custo médio de cada unidade considerando todas as compras anteriores com pesos diferentes. Atualizado automaticamente a cada nova entrada." />
              </th>
              <th className={cn('px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-widest text-foreground/60 hidden xl:table-cell', COL_DIVIDER)}>Preço venda</th>
              <th className={cn('px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-widest text-foreground/60 hidden sm:table-cell', COL_DIVIDER)}>
                <InfoTooltip label="ABC" tip="Classifica produtos pelo quanto geram de receita. Classe A = 20% dos produtos que dão 80% do dinheiro. Princípio de Pareto." />
              </th>
              <th className={cn('pl-4 pr-6 py-3.5 text-center text-[11px] font-semibold uppercase tracking-widest text-foreground/60', COL_DIVIDER)}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-10 text-center text-sm text-muted-foreground">
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
                    <td className="pl-6 pr-4 py-3.5 text-center font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {p.codigo ?? '—'}
                    </td>
                    <td className={cn('px-4 py-3.5', COL_DIVIDER)}>
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium">{p.nome}</span>
                        {inativo && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            Inativo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cn('px-4 py-3.5 text-center text-sm text-muted-foreground hidden md:table-cell', COL_DIVIDER)}>
                      {TIPOS_PRODUTO[p.estoque_categorias?.tipo ?? ''] ?? '—'}
                    </td>
                    <td className={cn('px-4 py-3.5 text-center text-sm text-muted-foreground hidden lg:table-cell uppercase', COL_DIVIDER)}>
                      {p.unidade}
                    </td>
                    <td className={cn('px-4 py-3.5 text-center font-semibold whitespace-nowrap', COL_DIVIDER)}>
                      {p.quantidade_atual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{p.unidade}</span>
                    </td>
                    <td className={cn('px-4 py-3.5 text-center font-mono text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap', COL_DIVIDER)}>
                      {p.localizacao?.codigo ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className={cn('px-4 py-3.5 text-center whitespace-nowrap hidden xl:table-cell', COL_DIVIDER)}>
                      {p.custo_unitario != null ? formatCurrency(p.custo_unitario) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={cn('px-4 py-3.5 text-center whitespace-nowrap hidden xl:table-cell', COL_DIVIDER)}>
                      {p.preco_venda != null ? formatCurrency(p.preco_venda) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={cn('px-4 py-3.5 text-center hidden sm:table-cell', COL_DIVIDER)}>
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', ABC_BADGE[abc])}>
                        {CLASSES_ABC[abc] ?? abc}
                      </span>
                    </td>
                    <td className={cn('pl-4 pr-6 py-3.5', COL_DIVIDER)}>
                      <div className="flex items-center justify-center gap-1">
                        <ActionBtn
                          icon={<TrendingUp className="h-3.5 w-3.5" />}
                          label="Registrar entrada"
                          className="text-primary hover:bg-primary/10"
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
                <td colSpan={4} className="pl-6 pr-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
