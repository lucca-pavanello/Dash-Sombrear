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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 border-b px-4 py-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar fornecedor..."
              className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm outline-none ring-ring focus:ring-2 focus:border-primary transition-all"
            />
          </div>
          <button
            onClick={handleNovo}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors ml-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Fornecedor
          </button>
        </div>

        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[1fr_140px_140px_110px_48px] gap-4 border-b bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Fornecedor / Contato</span>
          <span>Telefone</span>
          <span>CNPJ</span>
          <span>Prazo entrega</span>
          <span />
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg skeleton-shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Truck className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Clique em "Novo Fornecedor" para começar
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((f) => (
              <div
                key={f.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_110px_48px] gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors items-center"
              >
                {/* Nome + contato */}
                <div>
                  <p className="text-sm font-semibold">{f.nome}</p>
                  {f.contato && (
                    <p className="text-xs text-muted-foreground">{f.contato}</p>
                  )}
                  {f.email && (
                    <p className="text-xs text-muted-foreground/70">{f.email}</p>
                  )}
                </div>

                {/* Telefone */}
                <p className="text-sm text-muted-foreground hidden sm:block">
                  {f.telefone ?? '—'}
                </p>

                {/* CNPJ */}
                <p className="text-sm text-muted-foreground hidden sm:block">
                  {f.cnpj ?? '—'}
                </p>

                {/* Prazo */}
                <div className="hidden sm:flex items-center gap-1.5">
                  {f.prazo_entrega_dias != null ? (
                    <>
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {f.prazo_entrega_dias} {f.prazo_entrega_dias === 1 ? 'dia' : 'dias'}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 justify-end sm:justify-center">
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
              </div>
            ))}
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} fornecedor{filtered.length !== 1 ? 'es' : ''}
          </div>
        )}
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
