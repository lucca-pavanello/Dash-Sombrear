import { useState, useMemo } from 'react'
import { Search, Plus, Pencil, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEstoqueLocalizacoes, useUpdateLocalizacao } from '@/hooks/useEstoqueLocalizacoes'
import { NIVEIS_ACESSO } from '@/lib/constants'
import NovaLocalizacaoForm from './NovaLocalizacaoForm'
import { tbl } from './shared/tableStyles'
import type { EstoqueLocalizacao } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

interface Props {
  toast: (type: ToastType, message: string) => void
}

const NIVEL_BADGE: Record<string, string> = {
  balcao:    'bg-gray-900 text-white',
  acessivel: 'bg-gray-700 text-white',
  medio:     'bg-gray-200 text-gray-800',
  fundo:     'bg-gray-100 text-gray-600',
  deposito:  'bg-gray-50 text-gray-500 border border-gray-200',
}

export default function LocalizacoesTable({ toast }: Props) {
  const { data: localizacoes = [], isLoading } = useEstoqueLocalizacoes()
  const updateMutation = useUpdateLocalizacao()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<EstoqueLocalizacao | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return localizacoes
    return localizacoes.filter(
      (l) =>
        l.codigo.toLowerCase().includes(q) ||
        l.setor.toLowerCase().includes(q) ||
        (l.prateleira?.toLowerCase().includes(q) ?? false),
    )
  }, [localizacoes, search])

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
      <div className={tbl.container}>
        {/* Toolbar */}
        <div className={tbl.toolbar}>
          <div className={tbl.searchWrap}>
            <Search className={tbl.searchIcon} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar localização por código ou setor..."
              className={tbl.searchInput}
            />
          </div>
          <button onClick={handleNovo} className={tbl.addBtn}>
            <Plus className="h-4 w-4" />
            Nova Localização
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr className={tbl.theadRow}>
                <th className={cn(tbl.th, 'text-left')}>Código</th>
                <th className={cn(tbl.th, 'text-left')}>Setor</th>
                <th className={cn(tbl.th, 'text-left')}>Prateleira</th>
                <th className={cn(tbl.th, 'text-left')}>Posição</th>
                <th className={cn(tbl.th, 'text-left')}>Nível de acesso</th>
                <th className={cn(tbl.th, 'text-right')}>Produtos</th>
                <th className={cn(tbl.th, 'text-right border-r-0')}>Ações</th>
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
                    <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">
                      {search ? 'Nenhuma localização encontrada' : 'Nenhuma localização cadastrada'}
                    </p>
                    {!search && (
                      <p className="text-xs text-gray-400 mt-1">
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
                        <p className="font-medium text-gray-900">{l.setor}</p>
                        {l.descricao && (
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">{l.descricao}</p>
                        )}
                      </td>

                      {/* Prateleira */}
                      <td className={cn(tbl.td, 'text-gray-500')}>
                        {l.prateleira ?? '—'}
                      </td>

                      {/* Posição */}
                      <td className={cn(tbl.td, 'text-gray-500')}>
                        {l.posicao ?? '—'}
                      </td>

                      {/* Nível de acesso */}
                      <td className={tbl.td}>
                        <span className={cn(
                          'inline-flex h-6 px-3 items-center justify-center rounded-full text-xs font-medium',
                          NIVEL_BADGE[l.nivel_acesso] ?? 'bg-gray-100 text-gray-600',
                        )}>
                          {NIVEIS_ACESSO[l.nivel_acesso] ?? l.nivel_acesso}
                        </span>
                      </td>

                      {/* Nº produtos */}
                      <td className={cn(tbl.td, 'text-right text-gray-500')}>
                        {numProdutos}
                      </td>

                      {/* Ações */}
                      <td className={tbl.actionTd}>
                        <div className={tbl.actionGroup}>
                          <button
                            onClick={() => handleEditar(l)}
                            title="Editar"
                            className={cn(tbl.actionBtn, 'hover:text-gray-700 hover:bg-gray-100')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDesativar(l)}
                            title="Remover"
                            disabled={updateMutation.isPending}
                            className={cn(tbl.actionBtn, 'hover:text-red-600 hover:bg-red-50 disabled:opacity-50')}
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
                    Total — {filtered.length} localização{filtered.length !== 1 ? 'ões' : ''}
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
