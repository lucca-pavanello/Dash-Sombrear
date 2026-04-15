import { useState, useMemo } from 'react'
import { Search, Plus, Pencil, Truck, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEstoqueFornecedores, useUpdateFornecedor } from '@/hooks/useEstoqueFornecedores'
import NovoFornecedorForm from './NovoFornecedorForm'
import { tbl } from './shared/tableStyles'
import type { EstoqueFornecedor } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

interface Props {
  toast: (type: ToastType, message: string) => void
}

export default function FornecedoresTable({ toast }: Props) {
  const { data: fornecedores = [], isLoading } = useEstoqueFornecedores()
  const updateMutation = useUpdateFornecedor()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<EstoqueFornecedor | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return fornecedores
    return fornecedores.filter(
      (f) =>
        f.nome.toLowerCase().includes(q) ||
        (f.contato?.toLowerCase().includes(q) ?? false) ||
        (f.cnpj?.includes(q) ?? false),
    )
  }, [fornecedores, search])

  function handleNovo() {
    setEditando(null)
    setFormOpen(true)
  }

  function handleEditar(f: EstoqueFornecedor) {
    setEditando(f)
    setFormOpen(true)
  }

  async function handleDesativar(f: EstoqueFornecedor) {
    try {
      await updateMutation.mutateAsync({ id: f.id, ativo: false })
      toast('success', `Fornecedor "${f.nome}" removido.`)
    } catch {
      toast('error', 'Erro ao remover fornecedor.')
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
              placeholder="Buscar fornecedor por nome, contato ou CNPJ..."
              className={tbl.searchInput}
            />
          </div>
          <button onClick={handleNovo} className={tbl.addBtn}>
            <Plus className="h-4 w-4" />
            Novo Fornecedor
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '640px' }}>
            <thead>
              <tr className={tbl.theadRow}>
                <th className={cn(tbl.th, 'text-left')}>Fornecedor / Contato</th>
                <th className={cn(tbl.th, 'text-left')}>Telefone</th>
                <th className={cn(tbl.th, 'text-left')}>CNPJ</th>
                <th className={cn(tbl.th, 'text-right')}>Prazo entrega</th>
                <th className={cn(tbl.th, 'text-right border-r-0')}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-14 rounded-lg skeleton-shimmer" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">
                      {search ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
                    </p>
                    {!search && (
                      <p className="text-xs text-gray-400 mt-1">
                        Clique em "Novo Fornecedor" para começar
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((f) => (
                  <tr key={f.id} className={tbl.tbodyRow}>
                    {/* Nome + contato */}
                    <td className={tbl.td}>
                      <p className="font-semibold text-gray-900">{f.nome}</p>
                      {f.contato && (
                        <p className="text-xs text-gray-500">{f.contato}</p>
                      )}
                      {f.email && (
                        <p className="text-xs text-gray-400">{f.email}</p>
                      )}
                    </td>

                    {/* Telefone */}
                    <td className={cn(tbl.td, 'text-gray-500 whitespace-nowrap')}>
                      {f.telefone ?? '—'}
                    </td>

                    {/* CNPJ */}
                    <td className={cn(tbl.td, 'font-mono text-xs text-gray-500 whitespace-nowrap')}>
                      {f.cnpj ?? '—'}
                    </td>

                    {/* Prazo */}
                    <td className={cn(tbl.td, 'text-right')}>
                      {f.prazo_entrega_dias != null ? (
                        <span className="inline-flex items-center justify-end gap-1.5 text-sm text-gray-500">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {f.prazo_entrega_dias} {f.prazo_entrega_dias === 1 ? 'dia' : 'dias'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className={tbl.actionTd}>
                      <div className={tbl.actionGroup}>
                        <button
                          onClick={() => handleEditar(f)}
                          title="Editar"
                          className={cn(tbl.actionBtn, 'hover:text-gray-700 hover:bg-gray-100')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDesativar(f)}
                          title="Remover"
                          disabled={updateMutation.isPending}
                          className={cn(tbl.actionBtn, 'hover:text-red-600 hover:bg-red-50 disabled:opacity-50')}
                        >
                          <span className="text-xs font-bold leading-none">✕</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className={tbl.tfootRow}>
                  <td colSpan={5} className={tbl.tfootCell}>
                    Total — {filtered.length} fornecedor{filtered.length !== 1 ? 'es' : ''}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <NovoFornecedorForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        toast={toast}
        editando={editando}
      />
    </>
  )
}
