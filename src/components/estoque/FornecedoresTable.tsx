import { useState, useMemo } from 'react'
import { Search, Plus, Pencil, Truck, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEstoqueFornecedores, useUpdateFornecedor } from '@/hooks/useEstoqueFornecedores'
import NovoFornecedorForm from './NovoFornecedorForm'
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
      <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="relative flex-1 max-w-3xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar fornecedor por nome, contato ou CNPJ..."
              className="w-full rounded-lg border border-gray-200 bg-background h-10 pl-10 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
            />
          </div>
          <button
            onClick={handleNovo}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 h-10 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Fornecedor
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '640px' }}>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fornecedor / Contato</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Telefone</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CNPJ</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prazo entrega</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8">
                    <div className="flex flex-col gap-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 rounded-lg skeleton-shimmer" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <Truck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
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
                  <tr key={f.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors duration-150">
                    {/* Nome + contato */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{f.nome}</p>
                      {f.contato && (
                        <p className="text-xs text-muted-foreground">{f.contato}</p>
                      )}
                      {f.email && (
                        <p className="text-xs text-muted-foreground/70">{f.email}</p>
                      )}
                    </td>

                    {/* Telefone */}
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {f.telefone ?? '—'}
                    </td>

                    {/* CNPJ */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {f.cnpj ?? '—'}
                    </td>

                    {/* Prazo */}
                    <td className="px-4 py-3 text-right">
                      {f.prazo_entrega_dias != null ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          {f.prazo_entrega_dias} {f.prazo_entrega_dias === 1 ? 'dia' : 'dias'}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditar(f)}
                          title="Editar"
                          className={cn(
                            'rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                          )}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDesativar(f)}
                          title="Remover"
                          disabled={updateMutation.isPending}
                          className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
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
                <tr className="border-t border-border" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                  <td colSpan={5} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
