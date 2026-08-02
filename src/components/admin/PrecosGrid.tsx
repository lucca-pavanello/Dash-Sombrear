import { Fragment, ReactNode, useState } from 'react'
import { Check, Loader2, Plus, Trash2, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/CustomSelect'

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
  onSalvar: (match: Record<string, unknown>, patch: Record<string, unknown>, antes?: Record<string, unknown>) => Promise<void>
  onExcluir?: (match: Record<string, unknown>, antes?: Record<string, unknown>) => Promise<void>
  onAdicionar?: (row: Record<string, unknown>) => Promise<void>
  novoModelo?: Record<string, unknown>
  vazio?: string
  /** botão extra por linha (ex.: criar promoção a partir do tecido) */
  acaoLinha?: { titulo: string; icone?: ReactNode; onClick: (row: T) => void }
  /** retorna uma mensagem de alerta se a mudança parecer errada (ex.: preço 80% fora) — pede confirmação */
  conferirMudanca?: (row: T, patch: Record<string, unknown>) => string | null
}

const inputCls =
  'w-full rounded-md border border-border bg-background px-2 py-1 text-center text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20'

export default function PrecosGrid<T extends object>({
  colunas, linhas, chave, onSalvar, onExcluir, onAdicionar, novoModelo, vazio = 'Nenhum registro.',
  acaoLinha, conferirMudanca,
}: Props<T>) {
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Record<string, unknown>>({})
  const [salvando, setSalvando] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
  const [novo, setNovo] = useState<Record<string, unknown>>({})
  const [alerta, setAlerta] = useState<string | null>(null)

  const idDe = (row: T) => JSON.stringify(chave(row))

  function iniciarEdicao(row: T) {
    setEditando(idDe(row))
    setAlerta(null)
    const r: Record<string, unknown> = {}
    for (const c of colunas) r[c.key] = (row as Record<string, unknown>)[c.key]
    setRascunho(r)
  }

  function montarPatch(): Record<string, unknown> {
    const patch: Record<string, unknown> = {}
    for (const c of colunas) {
      if (c.readonly) continue
      patch[c.key] = c.tipo === 'numero' ? parseFloat(String(rascunho[c.key]).replace(',', '.')) || 0 : rascunho[c.key]
    }
    return patch
  }

  async function salvar(row: T, ignorarAlerta = false) {
    const patch = montarPatch()
    if (!ignorarAlerta && conferirMudanca) {
      const msg = conferirMudanca(row, patch)
      if (msg) { setAlerta(msg); return }
    }
    setSalvando(true)
    try {
      const antes: Record<string, unknown> = {}
      for (const k of Object.keys(patch)) antes[k] = (row as Record<string, unknown>)[k]
      await onSalvar(chave(row), patch, antes)
      setEditando(null)
      setAlerta(null)
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
        <CustomSelect className="min-w-32 px-2 py-1 text-sm font-normal" value={String(valor ?? '')}
          onChange={v => set(v)} options={c.options ?? []} />
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
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40">
              {colunas.map(c => (
                <th key={c.key} className={cn('border border-border/60 px-3 py-2.5 text-center font-semibold text-muted-foreground whitespace-nowrap', c.largura)}>
                  {c.label}
                </th>
              ))}
              <th className="w-24 border border-border/60 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && !adicionando && (
              <tr><td colSpan={colunas.length + 1} className="px-4 py-8 text-center text-muted-foreground">{vazio}</td></tr>
            )}
            {linhas.map((row, i) => {
              const emEdicao = editando === idDe(row)
              return (
                <Fragment key={idDe(row) + i}>
                <tr className={cn(emEdicao && 'bg-primary/5')}>
                  {colunas.map((c, ci) => (
                    <td key={c.key} className="border border-border/50 px-3 py-2 text-center align-middle">
                      {emEdicao && !c.readonly
                        ? campo(c, rascunho[c.key], v => setRascunho(r => ({ ...r, [c.key]: v })))
                        : <span className={cn(c.tipo === 'numero' && 'tabular-nums', ci === 0 && 'font-semibold')}>
                            {c.formato ? c.formato((row as Record<string, unknown>)[c.key]) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                          </span>}
                    </td>
                  ))}
                  <td className="border border-border/50 px-3 py-2 text-center whitespace-nowrap">
                    {emEdicao ? (
                      <span className="inline-flex gap-1">
                        <button onClick={() => salvar(row)} disabled={salvando}
                          className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10" title="Salvar">
                          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={() => { setEditando(null); setAlerta(null) }}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" title="Cancelar">
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-1">
                        {acaoLinha && (
                          <button onClick={() => acaoLinha.onClick(row)} title={acaoLinha.titulo}
                            className="rounded-md p-1.5 text-foreground/40 hover:bg-primary/10 hover:text-primary">
                            {acaoLinha.icone ?? acaoLinha.titulo}
                          </button>
                        )}
                        <button onClick={() => iniciarEdicao(row)}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                          Editar
                        </button>
                        {onExcluir && (
                          <button onClick={() => { if (confirm('Excluir este registro?')) onExcluir(chave(row), { ...(row as Record<string, unknown>) }) }}
                            className="rounded-md p-1.5 text-foreground/30 hover:bg-destructive/10 hover:text-destructive" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
                {emEdicao && alerta && (
                  <tr className="bg-amber-500/10">
                    <td colSpan={colunas.length + 1} className="border border-border/50 px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
                        <span className="font-medium text-amber-700 dark:text-amber-400">{alerta}</span>
                        <span className="ml-auto inline-flex gap-2">
                          <button onClick={() => salvar(row, true)} disabled={salvando}
                            className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:opacity-90 active:scale-95">
                            Salvar mesmo assim
                          </button>
                          <button onClick={() => setAlerta(null)}
                            className="rounded-lg bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                            Revisar
                          </button>
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
            {adicionando && (
              <tr className="bg-primary/5">
                {colunas.map(c => (
                  <td key={c.key} className="border border-border/50 px-3 py-2 text-center">
                    {c.readonly ? <span className="text-muted-foreground">—</span>
                      : campo(c, novo[c.key], v => setNovo(r => ({ ...r, [c.key]: v })))}
                  </td>
                ))}
                <td className="border border-border/50 px-3 py-2 text-center whitespace-nowrap">
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
