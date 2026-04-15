import { useState, useMemo } from 'react'
import { Search, X, Plus, Pencil, PackageX, TrendingUp, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useEstoqueProdutos, useDeactivateEstoqueProduto } from '@/hooks/useEstoqueProdutos'
import { useEstoqueLocalizacoes } from '@/hooks/useEstoqueLocalizacoes'
import { TIPOS_PRODUTO, CLASSES_ABC } from '@/lib/constants'
import { tbl } from './shared/tableStyles'
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
  sem_dados: 'bg-muted/40 text-muted-foreground/60 italic border border-border',
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

  return (
    <div className={tbl.container}>
      {/* ── Linha 1: busca + botão novo ── */}
      <div className={tbl.toolbar}>
        <div className={tbl.searchWrap}>
          <Search className={tbl.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou SKU..."
            className={cn(tbl.searchInput, 'pr-8')}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button onClick={onNovoProduto} className={tbl.addBtn}>
          <Plus className="h-4 w-4" />
          Novo Produto
        </button>
      </div>

      {/* ── Linha 2: filtros ── */}
      <div className={tbl.filterRow}>
        {/* Tipo */}
        <div className="w-44">
          <CustomSelect
            value={tipoFilter}
            onChange={(v) => setTipoFilter(v as TipoFilter)}
            options={[
              { value: 'todos',     label: 'Tipo: todos' },
              { value: 'tecido',    label: 'Tecido' },
              { value: 'ferragem',  label: 'Ferragem' },
              { value: 'acessorio', label: 'Acessório' },
            ]}
          />
        </div>

        {/* Classe ABC */}
        <div className="w-44">
          <CustomSelect
            value={abcFilter}
            onChange={(v) => setAbcFilter(v as AbcFilter)}
            options={[
              { value: 'todas',     label: 'Classe: todas' },
              { value: 'A',         label: 'Classe A' },
              { value: 'B',         label: 'Classe B' },
              { value: 'C',         label: 'Classe C' },
              { value: 'sem_dados', label: 'Sem dados' },
            ]}
          />
        </div>

        {/* Localização */}
        <div className="w-52">
          <CustomSelect
            value={localizacaoFilter}
            onChange={setLocalizacaoFilter}
            options={[
              { value: 'todas', label: 'Localização: todas' },
              { value: 'sem',   label: 'Sem localização' },
              ...localizacoes.map((l) => ({ value: l.id, label: `${l.codigo} – ${l.setor}` })),
            ]}
          />
        </div>

        {/* Toggle inativos */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={mostrarInativos}
            onClick={() => setMostrarInativos((v) => !v)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              mostrarInativos ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
          >
            <span className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
              mostrarInativos ? 'translate-x-[18px]' : 'translate-x-0.5',
            )} />
          </button>
          <span className="text-sm text-muted-foreground">Mostrar inativos</span>
        </label>
      </div>

      {/* ── Tabela ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '960px' }}>
          <thead>
            <tr className={tbl.theadRow}>
              <th className={cn(tbl.th, 'text-center pl-6')}>SKU</th>
              <th className={cn(tbl.th, 'text-center')}>Nome</th>
              <th className={cn(tbl.th, 'text-center hidden md:table-cell')}>Tipo</th>
              <th className={cn(tbl.th, 'text-center hidden lg:table-cell')}>Unidade</th>
              <th className={cn(tbl.th, 'text-center')}>Estoque atual</th>
              <th className={cn(tbl.th, 'text-center hidden lg:table-cell')}>Localização</th>
              <th className={cn(tbl.th, 'text-center hidden xl:table-cell')}>
                <InfoTooltip label="Custo médio" tip="Custo Médio Ponderado. Custo médio de cada unidade considerando todas as compras anteriores com pesos diferentes. Atualizado automaticamente a cada nova entrada." />
              </th>
              <th className={cn(tbl.th, 'text-center hidden xl:table-cell')}>Preço venda</th>
              <th className={cn(tbl.th, 'text-center hidden sm:table-cell')}>
                <InfoTooltip label="ABC" tip="Classifica produtos pelo quanto geram de receita. Classe A = 20% dos produtos que dão 80% do dinheiro. Princípio de Pareto." />
              </th>
              <th className={cn(tbl.th, 'text-center pr-6 border-r-0')}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-4">
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-14 rounded-lg skeleton-shimmer" />
                    ))}
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado ainda'}
                  </p>
                  {!search && (
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Clique em "Novo Produto" para começar
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const abc = p.classificacao_abc ?? 'sem_dados'
                const inativo = !p.ativo
                return (
                  <tr
                    key={p.id}
                    className={cn(tbl.tbodyRow, inativo && 'opacity-50')}
                  >
                    <td className={cn(tbl.td, 'pl-6 font-mono text-xs text-muted-foreground whitespace-nowrap')}>
                      {p.codigo ?? '—'}
                    </td>
                    <td className={tbl.td}>
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium text-foreground">{p.nome}</span>
                        {inativo && (
                          <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            Inativo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cn(tbl.td, 'text-muted-foreground hidden md:table-cell')}>
                      {TIPOS_PRODUTO[p.estoque_categorias?.tipo ?? ''] ?? '—'}
                    </td>
                    <td className={cn(tbl.td, 'text-muted-foreground uppercase hidden lg:table-cell')}>
                      {p.unidade}
                    </td>
                    <td className={cn(tbl.td, 'text-center font-semibold whitespace-nowrap')}>
                      {p.quantidade_atual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                      <span className="ml-1 text-xs font-normal text-muted-foreground/60">{p.unidade}</span>
                    </td>
                    <td className={cn(tbl.td, 'font-mono text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap')}>
                      {p.localizacao?.codigo ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className={cn(tbl.td, 'text-center whitespace-nowrap hidden xl:table-cell')}>
                      {p.custo_unitario != null ? formatCurrency(p.custo_unitario) : <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className={cn(tbl.td, 'text-center whitespace-nowrap hidden xl:table-cell')}>
                      {p.preco_venda != null ? formatCurrency(p.preco_venda) : <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className={cn(tbl.td, 'text-center hidden sm:table-cell')}>
                      <span className={cn(
                        abc === 'sem_dados'
                          ? 'inline-flex h-6 px-2 items-center justify-center rounded-full text-xs italic'
                          : 'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                        ABC_BADGE[abc],
                      )}>
                        {CLASSES_ABC[abc] ?? abc}
                      </span>
                    </td>
                    <td className={cn(tbl.actionTd, 'pr-6')}>
                      <div className={tbl.actionGroup}>
                        <ActionBtn
                          icon={<TrendingUp className="h-4 w-4" />}
                          label="Registrar entrada"
                          className="hover:text-primary hover:bg-primary/10"
                          onClick={() => onMovimentar(p, 'entrada')}
                        />
                        <ActionBtn
                          icon={<Pencil className="h-4 w-4" />}
                          label="Editar"
                          className="hover:text-foreground hover:bg-muted/60"
                          onClick={() => onEditar(p)}
                        />
                        {p.ativo && (
                          <ActionBtn
                            icon={<PackageX className="h-4 w-4" />}
                            label="Desativar"
                            className="hover:text-red-600 hover:bg-red-50"
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
              <tr className={tbl.tfootRow}>
                <td colSpan={4} className={cn(tbl.tfootCell, 'pl-6')}>
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
      className={cn(
        'rounded-lg h-8 w-8 p-0 flex items-center justify-center text-muted-foreground/60 transition-colors',
        className,
      )}
    >
      {icon}
    </button>
  )
}
