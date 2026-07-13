import { useState } from 'react'
import { PackagePlus, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { useEstoqueLotes, useEstoqueLoteItens } from '@/hooks/useEstoqueLotes'
import NovoLoteForm from './NovoLoteForm'
import type { EstoqueLote } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

interface Props {
  toast: (type: ToastType, message: string) => void
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function LoteItensRow({ loteId }: { loteId: string }) {
  const { data: itens = [], isLoading } = useEstoqueLoteItens(loteId)
  if (isLoading) return <p className="px-4 py-3 text-xs text-muted-foreground">Carregando itens…</p>
  if (!itens.length) return <p className="px-4 py-3 text-xs text-muted-foreground">Sem itens</p>
  return (
    <div className="px-4 pb-3">
      <div className="rounded-lg border bg-muted/20 overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_110px_110px] gap-2 border-b bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Produto</span>
          <span>Qtd</span>
          <span>Custo unit.</span>
          <span>Subtotal</span>
        </div>
        {itens.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_100px_110px_110px] gap-2 border-b last:border-0 px-3 py-2 text-sm"
          >
            <span className="font-medium truncate">
              {item.estoque_produtos?.nome ?? item.produto_id}
            </span>
            <span className="text-muted-foreground">
              {item.quantidade} {item.estoque_produtos?.unidade ?? ''}
            </span>
            <span className="text-muted-foreground">{formatCurrency(item.custo_unitario)}</span>
            <span className="font-semibold">{formatCurrency(item.quantidade * item.custo_unitario)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LotesTable({ toast }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  const { data, isLoading } = useEstoqueLotes({ page })
  const lotes = data?.lotes ?? []
  const total = data?.total ?? 0

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Histórico de Entradas</p>
            <p className="text-xs text-muted-foreground">{total} entrada{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Registrar Entrada
          </button>
        </div>

        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[100px_1fr_140px_120px_36px] gap-4 border-b bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Data</span>
          <span>Fornecedor / NF</span>
          <span>Itens</span>
          <span>Total</span>
          <span />
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg skeleton-shimmer" />
            ))}
          </div>
        ) : lotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <PackagePlus className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma entrada registrada</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Clique em "Registrar Entrada" para começar
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {lotes.map((lote: EstoqueLote) => (
              <div key={lote.id}>
                <div
                  className="grid grid-cols-1 sm:grid-cols-[100px_1fr_140px_120px_36px] gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors items-center cursor-pointer"
                  onClick={() => toggleExpand(lote.id)}
                >
                  <span className="text-sm font-semibold">{formatDate(lote.data_entrada)}</span>

                  <div>
                    <p className="text-sm font-medium">
                      {lote.estoque_fornecedores?.nome ?? 'Fornecedor não informado'}
                    </p>
                    {lote.nf_numero && (
                      <p className="text-xs text-muted-foreground">NF {lote.nf_numero}</p>
                    )}
                    {lote.observacoes && (
                      <p className="text-xs text-muted-foreground/70 truncate">{lote.observacoes}</p>
                    )}
                  </div>

                  <span className="text-sm text-muted-foreground hidden sm:block">
                    Ver itens
                  </span>

                  <span className="text-sm font-semibold hidden sm:block">
                    {formatCurrency(lote.valor_total)}
                  </span>

                  <button
                    className={cn(
                      'hidden sm:flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors',
                    )}
                  >
                    {expanded.has(lote.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {expanded.has(lote.id) && <LoteItensRow loteId={lote.id} />}
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {total > 20 && (
          <div className="flex items-center justify-between border-t px-4 py-2">
            <span className="text-xs text-muted-foreground">
              Página {page} de {Math.ceil(total / 20)}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md px-2 py-1 text-xs border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="rounded-md px-2 py-1 text-xs border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      <NovoLoteForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        toast={toast}
      />
    </>
  )
}
