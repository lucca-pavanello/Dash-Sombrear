import { useState } from 'react'
import { Check, Loader2, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ColunaDef {
  key: string
  label: string
  tipo: 'texto' | 'numero' | 'select' | 'data'
  options?: { value: string; label: string }[]
  largura?: string
  readonly?: boolean
  formato?: (v: unknown) => string
}

interface Props<T extends object> {
  colunas: ColunaDef[]
  linhas: T[]
  chave: (row: T) => Record<string, unknown>
  onSalvar: (match: Record<string, unknown>, patch: Record<string, unknown>) => Promise<void>
  onExcluir?: (match: Record<string, unknown>) => Promise<void>
  onAdicionar?: (row: Record<string, unknown>) => Promise<void>
  novoModelo?: Record<string, unknown>
  vazio?: string
}

const inputCls =
  'w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20'

export default function PrecosGrid<T extends object>({
  colunas, linhas, chave, onSalvar, onExcluir, onAdicionar, novoModelo, vazio = 'Nenhum registro.',
}: Props<T>) {
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Record<string, unknown>>({})
  const [salvando, setSalvando] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
  const [novo, setNovo] = useState<Record<string, unknown>>({})

  const idDe = (row: T) => JSON.stringify(chave(row))

  function iniciarEdicao(row: T) {
    setEditando(idDe(row))
    const r: Record<string, unknown> = {}
    for (const c of colunas) r[c.key] = (row as Record<string, unknown>)[c.key]
    setRascunho(r)
  }

  async function salvar(row: T) {
    setSalvando(true)
    try {
      const patch: Record<string, unknown> = {}
      for (const c of colunas) {
        if (c.readonly) continue
        patch[c.key] = c.tipo === 'numero' ? parseFloat(String(rascunho[c.key]).replace(',', '.')) || 0 : rascunho[c.key]
      }
      await onSalvar(chave(row), patch)
      setEditando(null)
    } finally {
      setSalvando(false)
    }
  }

  async function adicionar() {
    if (!onAdicionar) return
    setSalvando(true)
    try {
      const row: Record<string, unknown> = { ...(novoModelo ?? {}) }
      for (const c of colunas) {
        if (c.readonly) continue
        const v = novo[c.key]
        row[c.key] = c.tipo === 'numero' ? parseFloat(String(v ?? '').replace(',', '.')) || 0 : (v ?? '')
      }
      await onAdicionar(row)
      setAdicionando(false)
      setNovo({})
    } finally {
      setSalvando(false)
    }
  }

  function campo(c: ColunaDef, valor: unknown, set: (v: unknown) => void) {
    if (c.tipo === 'select') {
      return (
        <select className={inputCls} value={String(valor ?? '')} onChange={e => set(e.target.value)}>
          {(c.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    return (
      <input
        type={c.tipo === 'data' ? 'date' : 'text'}
        inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
        className={inputCls}
        value={String(valor ?? '')}
        onChange={e => set(e.target.value)}
      />
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {colunas.map(c => (
                <th key={c.key} className={cn('text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap', c.largura)}>
                  {c.label}
                </th>
              ))}
              <th className="w-24 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && !adicionando && (
              <tr><td colSpan={colunas.length + 1} className="px-4 py-8 text-center text-muted-foreground">{vazio}</td></tr>
            )}
            {linhas.map((row, i) => {
              const emEdicao = editando === idDe(row)
              return (
                <tr key={idDe(row) + i} className={cn('border-b border-border/50 last:border-0', emEdicao && 'bg-primary/5')}>
                  {colunas.map(c => (
                    <td key={c.key} className="px-3 py-2 align-middle">
                      {emEdicao && !c.readonly
                        ? campo(c, rascunho[c.key], v => setRascunho(r => ({ ...r, [c.key]: v })))
                        : <span className={cn(c.tipo === 'numero' && 'tabular-nums')}>
                            {c.formato ? c.formato((row as Record<string, unknown>)[c.key]) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                          </span>}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {emEdicao ? (
                      <span className="inline-flex gap-1">
                        <button onClick={() => salvar(row)} disabled={salvando}
                          className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10" title="Salvar">
                          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setEditando(null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Cancelar">
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-1">
                        <button onClick={() => iniciarEdicao(row)}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                          Editar
                        </button>
                        {onExcluir && (
                          <button onClick={() => { if (confirm('Excluir este registro?')) onExcluir(chave(row)) }}
                            className="rounded-md p-1.5 text-foreground/30 hover:bg-destructive/10 hover:text-destructive" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {adicionando && (
              <tr className="bg-primary/5">
                {colunas.map(c => (
                  <td key={c.key} className="px-3 py-2">
                    {c.readonly ? <span className="text-muted-foreground">—</span>
                      : campo(c, novo[c.key], v => setNovo(r => ({ ...r, [c.key]: v })))}
                  </td>
                ))}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <span className="inline-flex gap-1">
                    <button onClick={adicionar} disabled={salvando}
                      className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10" title="Salvar novo">
                      {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button onClick={() => { setAdicionando(false); setNovo({}) }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Cancelar">
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {onAdicionar && !adicionando && (
        <button onClick={() => setAdicionando(true)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      )}
    </div>
  )
}
