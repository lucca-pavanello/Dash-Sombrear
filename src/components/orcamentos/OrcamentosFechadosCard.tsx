import { useState } from 'react'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency, calcularMargem } from '@/lib/utils'
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react'

interface Props { data: Orcamento[] }

export default function OrcamentosFechadosCard({ data }: Props) {
  const fechados = data.filter((o) => o.fechado === true)
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 border-b px-5 py-4 hover:bg-muted/30 transition-colors rounded-t-xl"
      >
        <Trophy className="h-4 w-4 text-primary shrink-0" />
        <h2 className="font-display text-sm font-medium tracking-wide">Orçamentos Fechados</h2>
        <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {fechados.length}
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>

      {open && (
        fechados.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum orçamento fechado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {fechados.map((o) => {
              const receita = (o.valor_venda ?? 0) + (o.instacao ?? 0)
              const margem = o.margem ?? calcularMargem(receita, o.custo_tecido ?? 0)
              return (
                <div
                  key={o.id}
                  className="rounded-xl border-2 bg-background p-4 transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{o.cliente ?? 'Cliente não informado'}</p>
                      <p className="text-xs text-muted-foreground">{o.responsavel}</p>
                    </div>
                    {margem != null ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        margem >= 30
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : margem >= 15
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {margem.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-xs text-muted-foreground/40 italic">sem custo</span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    {o.ambiente && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ambiente</span>
                        <span className="font-medium">{o.ambiente}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modelo</span>
                      <span className="font-medium">{o.modelo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tecido</span>
                      <span className="font-medium">{o.tecido}</span>
                    </div>
                    {o.custo_tecido && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Custo Total</span>
                        <span className="font-medium">{formatCurrency(o.custo_tecido)}</span>
                      </div>
                    )}
                    {o.custo_acabamento && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Custo Acabamento</span>
                        <span className="font-medium">{formatCurrency(o.custo_acabamento)}</span>
                      </div>
                    )}
                    {o.instacao && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Instalação</span>
                        <span className="font-medium">{formatCurrency(o.instacao)}</span>
                      </div>
                    )}
                    {(o.valor_venda || o.instacao) && (
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="font-semibold">Total</span>
                        <span className="font-bold text-primary">
                          {formatCurrency((o.valor_venda ?? 0) + (o.instacao ?? 0))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
