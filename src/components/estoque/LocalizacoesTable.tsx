import { useState, useMemo } from 'react'
import { Search, Pencil, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEstoqueLocalizacoes, useUpdateLocalizacao } from '@/hooks/useEstoqueLocalizacoes'
import { NIVEIS_ACESSO } from '@/lib/constants'
import NovaLocalizacaoForm from './NovaLocalizacaoForm'
import type { EstoqueLocalizacao } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

interface Props {
  toast: (type: ToastType, message: string) => void
}

const NIVEL_BADGE: Record<string, string> = {
  balcao:    'bg-emerald-500 text-white',
  acessivel: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medio:     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  fundo:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  deposito:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
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
      <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 border-b px-4 py-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar localização..."
              className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm outline-none ring-ring focus:ring-2 focus:border-primary transition-all"
            />
          </div>
          <button
            onClick={handleNovo}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors ml-auto"
          >
            <MapPin className="h-3.5 w-3.5" />
            Nova Localização
          </button>
        </div>

        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[90px_1fr_100px_90px_140px_80px_48px] gap-3 border-b bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Código</span>
          <span>Setor</span>
          <span>Prateleira</span>
          <span>Posição</span>
          <span>Nível de acesso</span>
          <span className="text-right">Produtos</span>
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
            <MapPin className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Nenhuma localização encontrada' : 'Nenhuma localização cadastrada'}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Clique em "Nova Localização" para começar
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((l) => {
              const numProdutos = l.estoque_produtos?.[0]?.count ?? 0
              return (
                <div
                  key={l.id}
                  className="grid grid-cols-1 sm:grid-cols-[90px_1fr_100px_90px_140px_80px_48px] gap-2 sm:gap-3 px-4 py-3 hover:bg-muted/30 transition-colors items-center"
                >
                  {/* Código */}
                  <p className="font-mono text-sm font-semibold">{l.codigo}</p>

                  {/* Setor */}
                  <div>
                    <p className="text-sm font-medium">{l.setor}</p>
                    {l.descricao && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{l.descricao}</p>
                    )}
                  </div>

                  {/* Prateleira */}
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    {l.prateleira ?? '—'}
                  </p>

                  {/* Posição */}
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    {l.posicao ?? '—'}
                  </p>

                  {/* Nível de acesso badge */}
                  <div className="hidden sm:block">
                    <span className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      NIVEL_BADGE[l.nivel_acesso] ?? 'bg-muted text-muted-foreground',
                    )}>
                      {NIVEIS_ACESSO[l.nivel_acesso] ?? l.nivel_acesso}
                    </span>
                  </div>

                  {/* Nº produtos */}
                  <p className="text-sm text-muted-foreground hidden sm:block text-right">
                    {numProdutos}
                  </p>

                  {/* Ações */}
                  <div className="flex items-center gap-1 justify-end sm:justify-center">
                    <button
                      onClick={() => handleEditar(l)}
                      title="Editar"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDesativar(l)}
                      title="Remover"
                      disabled={updateMutation.isPending}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      <span className="text-xs font-bold leading-none">✕</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} localização{filtered.length !== 1 ? 'ões' : ''}
          </div>
        )}
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
