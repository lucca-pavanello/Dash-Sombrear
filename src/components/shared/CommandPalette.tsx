import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, FileText, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  orcamentos: Orcamento[]
}

export default function CommandPalette({ open, onClose, orcamentos }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Limpa query ao fechar
  useEffect(() => {
    if (!open) {
      setQuery('')
    } else {
      // Foca o input ao abrir
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return orcamentos
      .filter((o) =>
        [o.cliente, o.responsavel, o.modelo, o.tecido, o.telefone, o.ambiente]
          .some((v) => v?.toLowerCase().includes(q))
      )
      .slice(0, 8)
  }, [query, orcamentos])

  function handleSelect(o: Orcamento) {
    navigate('/planilha')
    onClose()
    // Pequeno delay para garantir que a aba está montada antes de emitir o evento
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cp-open-orcamento', { detail: { id: o.id, cliente: o.cliente } }))
    }, 80)
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[200] bg-background/70 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-[15%] z-[201] w-full max-w-lg -translate-x-1/2 animate-in slide-in-from-top-4 fade-in duration-150 px-4">
        <div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)]">
          {/* Input */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar orçamento por cliente, responsável, modelo…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <div className="flex items-center gap-1.5">
              <kbd className="hidden sm:flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">Esc</kbd>
              <button onClick={onClose} className="rounded p-0.5 hover:bg-muted transition-colors">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Resultados */}
          {query.trim() === '' ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">Digite para buscar entre {orcamentos.length} orçamentos</p>
              <p className="mt-1 text-xs text-muted-foreground/60">cliente · responsável · modelo · tecido · telefone</p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhum resultado para "<span className="font-medium text-foreground">{query}</span>"</p>
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1.5">
              {results.map((o, i) => (
                <li key={o.id}>
                  <button
                    onClick={() => handleSelect(o)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60',
                      i === 0 && 'bg-muted/30'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      o.fechado ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-primary/10 text-primary'
                    )}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {o.cliente ?? o.responsavel ?? '—'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.modelo} · {o.responsavel} · {formatDate(o.created_at)}
                        {o.valor_venda ? ` · ${formatCurrency(o.valor_venda)}` : ''}
                      </p>
                    </div>
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      o.fechado ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'
                    )}>
                      {o.fechado ? 'Fechado' : 'Aberto'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Rodapé */}
          <div className="flex items-center justify-between border-t px-4 py-2">
            <p className="text-[10px] text-muted-foreground/60">
              {results.length > 0 ? `${results.length} resultado${results.length !== 1 ? 's' : ''}` : ''}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
              <span>↵ abrir</span>
              <span className="hidden sm:inline">· Cmd+K fechar</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
