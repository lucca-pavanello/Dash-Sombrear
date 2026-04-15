import { useState, useMemo } from 'react'
import { Search, Plus, Pencil, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useEstoqueLocalizacoes, useUpdateLocalizacao } from '@/hooks/useEstoqueLocalizacoes'
import { NIVEIS_ACESSO } from '@/lib/constants'
import NovaLocalizacaoForm from './NovaLocalizacaoForm'
import { tbl } from './shared/tableStyles'
import type { EstoqueLocalizacao } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

type NivelFilter = 'todos' | 'balcao' | 'acessivel' | 'medio' | 'fundo' | 'deposito'

interface Props {
  toast: (type: ToastType, message: string) => void
}


export default function LocalizacoesTable({ toast }: Props) {
  const [search, setSearch] = useState('')
  const [filtroNivel, setFiltroNivel] = useState<NivelFilter>('todos')
  const [mostrarInativas, setMostrarInativas] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<EstoqueLocalizacao | null>(null)

  const { data: localizacoes = [], isLoading } = useEstoqueLocalizacoes({ includeInactive: mostrarInativas })
  const updateMutation = useUpdateLocalizacao()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return localizacoes
      .filter(l =>
        !q ||
        l.codigo.toLowerCase().includes(q) ||
        l.setor.toLowerCase().includes(q) ||
        (l.prateleira?.toLowerCase().includes(q) ?? false),
      )
      .filter(l => filtroNivel === 'todos' || l.nivel_acesso === filtroNivel)
  }, [localizacoes, search, filtroNivel])

  function handleNovo() {
    setEditando(null)
    setFormOpen(true)
  }

  function handleEditar(l: EstoqueLocalizacao) {
    setEditando(l)
    setFormOpen(true)
  }

  async function handleDesativar(l: EstoqueLocalizacao) {
    try {
      await updateMutation.mutateAsync({ id: l.id, ativo: false })
      toast('success', `Localização "${l.codigo}" removida.`)
    } catch {
      toast('error', 'Erro ao remover localização.')
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pb-3 justify-center">
          <div className={tbl.searchWrap}>
            <Search className={tbl.searchIcon} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar localização por código ou setor..."
              className={tbl.searchInput}
            />
          </div>
          <button onClick={handleNovo} className={cn(tbl.addBtn, 'w-full sm:w-auto justify-center')}>
            <Plus className="h-4 w-4" />
            Nova Localização
          </button>
        </div>

      {/* ── Linha 2: filtros ── */}
      <div className="flex flex-wrap items-center gap-3 pb-1.5 justify-center">
        <div className="w-48">
          <CustomSelect
            value={filtroNivel}
            onChange={(v) => setFiltroNivel(v as NivelFilter)}
            options={[
              { value: 'todos',     label: 'Nível: todos' },
              { value: 'balcao',    label: 'Balcão' },
              { value: 'acessivel', label: 'Acessível' },
              { value: 'medio',     label: 'Médio' },
              { value: 'fundo',     label: 'Fundo' },
              { value: 'deposito',  label: 'Depósito' },
            ]}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={mostrarInativas}
            onClick={() => setMostrarInativas(v => !v)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              mostrarInativas ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
          >
            <span className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
              mostrarInativas ? 'translate-x-[18px]' : 'translate-x-0.5',
            )} />
          </button>
          <span className="text-sm text-muted-foreground">Mostrar inativas</span>
        </label>
      </div>

      {/* Table */}
      <div className={tbl.container}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr className={tbl.theadRow}>
                <th className={cn(tbl.th, 'text-center')}>Código</th>
                <th className={cn(tbl.th, 'text-center')}>Setor</th>
                <th className={cn(tbl.th, 'text-center')}>Prateleira</th>
                <th className={cn(tbl.th, 'text-center')}>Posição</th>
                <th className={cn(tbl.th, 'text-center')}>Nível de acesso</th>
                <th className={cn(tbl.th, 'text-center')}>Produtos</th>
                <th className={cn(tbl.th, 'text-center border-r-0')}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-14 rounded-lg skeleton-shimmer" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {search || filtroNivel !== 'todos' ? 'Nenhuma localização com esse filtro. Tente outra combinação.' : 'Nenhuma localização cadastrada'}
                    </p>
                    {!search && (
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Clique em "Nova Localização" para começar
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const numProdutos = l.estoque_produtos?.[0]?.count ?? 0
                  return (
                    <tr key={l.id} className={tbl.tbodyRow}>
                      {/* Código */}
                      <td className={cn(tbl.td, 'font-mono font-semibold whitespace-nowrap')}>
                        {l.codigo}
                      </td>

                      {/* Setor */}
                      <td className={tbl.td}>
                        <p className="font-medium text-foreground text-center">{l.setor}</p>
                        {l.descricao && (
                          <p className="text-xs text-muted-foreground text-center truncate max-w-[200px] mx-auto">{l.descricao}</p>
                        )}
                      </td>

                      {/* Prateleira */}
                      <td className={cn(tbl.td, 'text-muted-foreground')}>
                        {l.prateleira ?? '—'}
                      </td>

                      {/* Posição */}
                      <td className={cn(tbl.td, 'text-muted-foreground')}>
                        {l.posicao ?? '—'}
                      </td>

                      {/* Nível de acesso */}
                      <td className={tbl.td}>
                        {NIVEIS_ACESSO[l.nivel_acesso] ?? l.nivel_acesso}
                      </td>

                      {/* Nº produtos */}
                      <td className={cn(tbl.td, 'text-center text-muted-foreground')}>
                        {numProdutos}
                      </td>

                      {/* Ações */}
                      <td className={tbl.actionTd}>
                        <div className={cn(tbl.actionGroup, 'justify-center')}>
                          <button
                            onClick={() => handleEditar(l)}
                            title="Editar"
                            className={cn(tbl.actionBtn, 'hover:text-foreground hover:bg-muted/60')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDesativar(l)}
                            title="Remover"
                            disabled={updateMutation.isPending}
                            className={cn(tbl.actionBtn, 'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50')}
                          >
                            <span className="text-xs font-bold leading-none">✕</span>
                          </button>
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
                  <td colSpan={7} className={tbl.tfootCell}>
                    Total — {filtered.length} {filtered.length === 1 ? 'localização' : 'localizações'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <NovaLocalizacaoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        toast={toast}
        editando={editando}
      />
    </>
  )
}
