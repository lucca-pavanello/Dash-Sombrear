import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { EstoqueProdutoAlerta } from '@/lib/supabase'

interface Props {
  alertas: EstoqueProdutoAlerta[]
  onMovimentar: (produto: EstoqueProdutoAlerta, tipo: 'entrada') => void
}

export default function EstoqueAlertasPanel({ alertas, onMovimentar }: Props) {
  const [open, setOpen] = useState(true)

  if (alertas.length === 0) return null

  const criticos = alertas.filter((a) => a.quantidade_atual <= 0)
  const baixos = alertas.filter((a) => a.quantidade_atual > 0)

  return (
    <div className="rounded-xl border-2 border-primary/10 bg-primary/[0.02] shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground">
            {alertas.length} produto{alertas.length !== 1 ? 's' : ''} com estoque baixo
          </span>
          {criticos.length > 0 && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
              {criticos.length} zerado{criticos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          {criticos.length > 0 && (
            <>
              {criticos.map((p) => (
                <AlertaLinha key={p.id} produto={p} onMovimentar={onMovimentar} />
              ))}
            </>
          )}
          {baixos.map((p) => (
            <AlertaLinha key={p.id} produto={p} onMovimentar={onMovimentar} />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertaLinha({
  produto,
  onMovimentar,
}: {
  produto: EstoqueProdutoAlerta
  onMovimentar: (p: EstoqueProdutoAlerta, tipo: 'entrada') => void
}) {
  const zerado = produto.quantidade_atual <= 0

  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {zerado && (
            <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-destructive" />
          )}
          <span className="text-sm font-medium truncate">{produto.nome}</span>
          <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
            · {produto.categoria_nome}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {zerado ? (
            <span className="text-destructive font-semibold">Zerado</span>
          ) : (
            <>
              <span className="text-foreground font-semibold">
                {produto.quantidade_atual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {produto.unidade}
              </span>
              {' '}/ mín {produto.quantidade_minima.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {produto.unidade}
            </>
          )}
        </p>
      </div>
      <button
        onClick={() => onMovimentar(produto, 'entrada')}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 active:scale-95 transition-all"
      >
        Entrada
      </button>
    </div>
  )
}
