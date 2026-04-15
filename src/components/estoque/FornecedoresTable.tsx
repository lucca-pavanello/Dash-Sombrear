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
      {/* Toolbar */}
      <div className="flex items-center gap-3 pb-3">
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
      <div className={tbl.container}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '640px' }}>
            <thead>
              <tr className={tbl.theadRow}>
                <th className={cn(tbl.th, 'text-center')}>Fornecedor / Contato</th>
                <th className={cn(tbl.th, 'text-center')}>Telefone</th>
                <th className={cn(tbl.th, 'text-center')}>CNPJ</th>
                <th className={cn(tbl.th, 'text-center')}>Prazo entrega</th>
                <th className={cn(tbl.th, 'text-center border-r-0')}>Ações</th>
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
                    <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {search ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
                    </p>
                    {!search && (
                      <p className="text-xs text-muted-foreground/60 mt-1">
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
                      <p className="font-semibold text-foreground">{f.nome}</p>
                      {f.contato && (
                        <p className="text-xs text-muted-foreground">{f.contato}</p>
                      )}
                      {f.email && (
                        <p className="text-xs text-muted-foreground/60">{f.email}</p>
                      )}
                    </td>

                    {/* Telefone */}
                    <td className={cn(tbl.td, 'text-muted-foreground whitespace-nowrap')}>
                      {f.telefone ?? '—'}
                    </td>

                    {/* CNPJ */}
                    <td className={cn(tbl.td, 'font-mono text-xs text-muted-foreground whitespace-nowrap')}>
                      {f.cnpj ?? '—'}
                    </td>

                    {/* Prazo */}
                    <td className={cn(tbl.td, 'text-center')}>
                      {f.prazo_entrega_dias != null ? (
                        <span className="inline-flex items-center justify-end gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {f.prazo_entrega_dias} {f.prazo_entrega_dias === 1 ? 'dia' : 'dias'}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className={tbl.actionTd}>
                      <div className={cn(tbl.actionGroup, 'justify-center')}>
                        <button
                          onClick={() => handleEditar(f)}
                          title="Editar"
                          className={cn(tbl.actionBtn, 'hover:text-foreground hover:bg-muted/60')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDesativar(f)}
                          title="Remover"
                          disabled={updateMutation.isPending}
                          className={cn(tbl.actionBtn, 'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50')}
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
