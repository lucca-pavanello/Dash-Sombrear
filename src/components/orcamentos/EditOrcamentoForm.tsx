import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Copy, Check as CheckIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { useUpdateOrcamento, useDeleteOrcamento, useOrcamentoHistorico, useAddHistorico } from '@/hooks/useOrcamentos'
import type { Orcamento } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import SectionDivider from '@/components/shared/SectionDivider'
import { RESPONSAVEIS } from '@/lib/constants'

const MODELOS = ['Rolo', 'Romeu e Julieta', 'Vertical', 'Horizontal', 'Painel', 'Cortina']
const inputClass = 'w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2 focus:border-primary transition-all duration-150'
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

interface Props {
  orcamento: Orcamento
  onClose: () => void
  toast: (type: 'success' | 'error', message: string) => void
  responsaveis?: string[]
}

function formatHistoricoDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function EditOrcamentoForm({ orcamento, onClose, toast }: Props) {
  const { mutateAsync: update, isPending: isUpdating } = useUpdateOrcamento()
  const { mutateAsync: remove, isPending: isDeleting } = useDeleteOrcamento()
  const { mutate: addHistorico } = useAddHistorico()
  const { data: historico } = useOrcamentoHistorico(orcamento.id)
  const userEditedDimensions = useRef(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)
  const [historicoOpen, setHistoricoOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const initialForm = {
    responsavel: orcamento.responsavel ?? '',
    cliente: orcamento.cliente ?? '',
    telefone: orcamento.telefone ?? '',
    largura: orcamento.largura?.toString() ?? '',
    altura: orcamento.altura?.toString() ?? '',
    modelo: orcamento.modelo ?? MODELOS[0],
    tecido: orcamento.tecido ?? '',
    quantidade: orcamento.quantidade?.toString() ?? '1',
    cor_ferragem_motor: orcamento.cor_ferragem_motor ?? '',
    acabamentos: orcamento.acabamentos ?? '',
    valor_venda: orcamento.valor_venda?.toString() ?? '',
    instacao: orcamento.instacao?.toString() ?? '',
    custo_m2: orcamento.custo_m2?.toString() ?? '',
    custo_tecido: orcamento.custo_tecido?.toString() ?? '',
    custo_acabamento: orcamento.custo_acabamento?.toString() ?? '',
    fechado: orcamento.fechado ?? false,
    observacoes: orcamento.observacoes ?? '',
    ambiente: orcamento.ambiente ?? '',
  }
  const [form, setForm] = useState(initialForm)
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleClose() {
    if (isDirty && !window.confirm('Há alterações não salvas. Deseja descartar as mudanças?')) return
    onClose()
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => {
      previousFocus?.focus()
    }
  }, [])

  const calcCusto = (() => {
    const l = parseFloat(form.largura)
    const h = parseFloat(form.altura)
    const cm2 = parseFloat(form.custo_m2)
    const qtd = parseInt(form.quantidade) || 1
    const acab = parseFloat(form.custo_acabamento) || 0
    if (l > 0 && h > 0 && cm2 > 0) return l * h * cm2 * qtd + acab
    return null
  })()

  useEffect(() => {
    if (!userEditedDimensions.current) return  // don't auto-fill on initial mount
    const l = parseFloat(form.largura)
    const h = parseFloat(form.altura)
    const cm2 = parseFloat(form.custo_m2)
    const qtd = parseInt(form.quantidade) || 1
    const acab = parseFloat(form.custo_acabamento) || 0
    if (l > 0 && h > 0 && cm2 > 0) {
      setForm(f => ({ ...f, custo_tecido: (l * h * cm2 * qtd + acab).toFixed(2) }))
    }
  }, [form.largura, form.altura, form.custo_m2, form.quantidade, form.custo_acabamento])

  const isAutocalc = calcCusto !== null && form.custo_tecido === calcCusto.toFixed(2)

  const previewMargem = (() => {
    const receita = (parseFloat(form.valor_venda) || 0) + (parseFloat(form.instacao) || 0)
    const custo = parseFloat(form.custo_tecido) || 0
    if (receita > 0 && custo > 0) return ((receita - custo) / receita) * 100
    return null
  })()

  function handleCopy() {
    const lines = [
      `*Orçamento Sombrear*`,
      form.cliente ? `Cliente: ${form.cliente}` : null,
      form.telefone ? `Telefone: ${form.telefone}` : null,
      `Responsável: ${form.responsavel}`,
      form.ambiente ? `Ambiente: ${form.ambiente}` : null,
      `Modelo: ${form.modelo}`,
      `Tecido: ${form.tecido}`,
      form.largura && form.altura ? `Medidas: ${form.largura}m x ${form.altura}m` : null,
      `Qtd: ${form.quantidade}`,
      form.cor_ferragem_motor ? `Ferragem/Motor: ${form.cor_ferragem_motor}` : null,
      form.acabamentos ? `Acabamentos: ${form.acabamentos}` : null,
      form.valor_venda ? `Valor: ${formatCurrency(Number(form.valor_venda))}` : null,
      form.instacao ? `Instalação: ${formatCurrency(Number(form.instacao))}` : null,
      form.observacoes ? `Obs: ${form.observacoes}` : null,
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const receita = (form.valor_venda ? Number(form.valor_venda) : 0) + (form.instacao ? Number(form.instacao) : 0)
      const custoTotal = form.custo_tecido ? Number(form.custo_tecido) : (calcCusto ?? null)
      const margem = receita > 0 && custoTotal ? ((receita - custoTotal) / receita) * 100 : null

      const updated = await update({
        id: orcamento.id,
        responsavel: form.responsavel,
        cliente: form.cliente || null,
        telefone: form.telefone || null,
        largura: form.largura ? Number(form.largura) : null,
        altura: form.altura ? Number(form.altura) : null,
        modelo: form.modelo,
        tecido: form.tecido,
        quantidade: Number(form.quantidade),
        cor_ferragem_motor: form.cor_ferragem_motor || null,
        acabamentos: form.acabamentos || null,
        valor_venda: form.valor_venda ? Number(form.valor_venda) : null,
        instacao: form.instacao ? Number(form.instacao) : null,
        custo_m2: form.custo_m2 ? Number(form.custo_m2) : null,
        custo_tecido: form.custo_tecido ? Number(form.custo_tecido) : calcCusto ?? null,
        custo_acabamento: form.custo_acabamento ? Number(form.custo_acabamento) : null,
        fechado: form.fechado,
        observacoes: form.observacoes || null,
        ambiente: form.ambiente || null,
        margem,
      })
      addHistorico({ orcamento_id: orcamento.id, snapshot: updated as object })
      toast('success', 'Orçamento atualizado!')
      onClose()
    } catch (err) {
      console.error('[EditOrcamentoForm] handleSubmit error:', err)
      toast('error', 'Erro ao atualizar orçamento.')
    }
  }

  async function handleDelete() {
    try {
      await remove(orcamento.id)
      toast('success', 'Orçamento excluído.')
      onClose()
    } catch {
      toast('error', 'Erro ao excluir orçamento.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-edit"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-elevated max-h-[92dvh] flex flex-col outline-none"
      >
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="modal-title-edit" className="font-display text-base font-semibold">Editar Orçamento</h2>
              {isDirty && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  não salvo
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Criado em {new Date(orcamento.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Copiar para WhatsApp"
            >
              {copied ? <CheckIcon className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-2 gap-4">

            <SectionDivider label="Cliente" />

            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>Responsável <span className="text-destructive ml-0.5">*</span></label>
              <select
                required
                value={form.responsavel}
                onChange={(e) => set('responsavel', e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>Cliente</label>
              <input value={form.cliente} onChange={(e) => set('cliente', e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Telefone</label>
              <input type="tel" value={form.telefone} onChange={(e) => set('telefone', e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
            </div>

            <SectionDivider label="Produto" />

            <div className="col-span-2">
              <label className={labelClass}>Ambiente</label>
              <input
                value={form.ambiente}
                onChange={(e) => set('ambiente', e.target.value)}
                className={inputClass}
                placeholder="Ex: Sala, Quarto, Escritório..."
                list="ambientes-list-edit"
              />
              <datalist id="ambientes-list-edit">
                {['Sala', 'Quarto', 'Quarto 1', 'Quarto 2', 'Escritório', 'Cozinha', 'Varanda', 'Banheiro', 'Hall', 'Suíte'].map(a => <option key={a} value={a} />)}
              </datalist>
            </div>

            <div>
              <label className={labelClass}>Largura (m)</label>
              <input type="number" step="0.01" value={form.largura} onChange={(e) => { userEditedDimensions.current = true; set('largura', e.target.value) }} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Altura (m)</label>
              <input type="number" step="0.01" value={form.altura} onChange={(e) => { userEditedDimensions.current = true; set('altura', e.target.value) }} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Modelo <span className="text-destructive ml-0.5">*</span></label>
              <select required value={form.modelo} onChange={(e) => set('modelo', e.target.value)} className={cn(inputClass, 'cursor-pointer')}>
                {MODELOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Quantidade <span className="text-destructive ml-0.5">*</span></label>
              <input required type="number" min="1" value={form.quantidade} onChange={(e) => { userEditedDimensions.current = true; set('quantidade', e.target.value) }} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Tecido <span className="text-destructive ml-0.5">*</span></label>
              <input required value={form.tecido} onChange={(e) => set('tecido', e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Cor Ferragem / Motor</label>
              <input value={form.cor_ferragem_motor} onChange={(e) => set('cor_ferragem_motor', e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Acabamentos</label>
              <input value={form.acabamentos} onChange={(e) => set('acabamentos', e.target.value)} className={inputClass} />
            </div>

            <SectionDivider label="Financeiro" />

            <div>
              <label className={labelClass}>Valor de Venda (R$)</label>
              <input type="number" step="0.01" value={form.valor_venda} onChange={(e) => set('valor_venda', e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Valor Instalação (R$)</label>
              <input type="number" step="0.01" value={form.instacao} onChange={(e) => set('instacao', e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>
                Custo por m² (R$)
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">do tecido</span>
              </label>
              <input type="number" step="0.01" value={form.custo_m2} onChange={(e) => { userEditedDimensions.current = true; set('custo_m2', e.target.value) }} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Custo Acabamento (R$)</label>
              <input type="number" step="0.01" value={form.custo_acabamento} onChange={(e) => { userEditedDimensions.current = true; set('custo_acabamento', e.target.value) }} className={inputClass} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>
                Custo (R$)
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">para calcular margem</span>
                {isAutocalc && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    calculado automaticamente
                  </span>
                )}
              </label>
              <input type="number" step="0.01" value={form.custo_tecido} onChange={(e) => set('custo_tecido', e.target.value)} className={inputClass} placeholder="0.00" />
              {calcCusto !== null && (
                <p className="mt-1.5 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    = {formatCurrency(calcCusto)}
                    <span className="ml-1 text-muted-foreground/60">
                      ({form.largura}×{form.altura}m × R${form.custo_m2}/m² × {form.quantidade}un
                      {parseFloat(form.custo_acabamento) > 0 ? ` + R$${form.custo_acabamento} acab.` : ''})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => set('custo_tecido', calcCusto.toFixed(2))}
                    className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-primary font-medium hover:bg-primary/20 transition-colors"
                  >
                    Usar
                  </button>
                </p>
              )}
            </div>

            {previewMargem !== null && (
              <div className="col-span-2 rounded-lg bg-primary/10 px-3 py-2.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">
                  Margem estimada: {previewMargem.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency((parseFloat(form.valor_venda) || 0) + (parseFloat(form.instacao) || 0))} − {formatCurrency(parseFloat(form.custo_tecido) || 0)}
                </span>
              </div>
            )}

            <div className="flex flex-col justify-end">
              <label className={labelClass}>Status</label>
              <button
                type="button"
                onClick={() => set('fechado', !form.fechado)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3.5 py-3 text-sm font-medium transition-all duration-200',
                  form.fechado
                    ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-background text-muted-foreground hover:bg-muted/60'
                )}
              >
                <span className={cn('h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors', form.fechado ? 'border-green-500 bg-green-500' : 'border-muted-foreground')}>
                  {form.fechado && <CheckIcon className="h-2.5 w-2.5 text-white" />}
                </span>
                {form.fechado ? 'Fechado' : 'Em aberto'}
              </button>
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => set('observacoes', e.target.value)}
                className={cn(inputClass, 'resize-none')}
                rows={3}
                placeholder="Endereço de instalação, detalhes extras..."
              />
            </div>
          </div>

          {/* Histórico */}
          {historico && historico.length > 0 && (
            <div className="mt-5 rounded-lg border bg-muted/30">
              <button
                type="button"
                onClick={() => setHistoricoOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
              >
                <span>Histórico de alterações</span>
                {historicoOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {historicoOpen && (
                <div className="border-t divide-y">
                  {historico.map((h, idx) => {
                    const snap = h.snapshot as Record<string, unknown>
                    const TRACKED_FIELDS: Array<{ key: string; label: string; currency?: boolean }> = [
                      { key: 'responsavel', label: 'Responsável' },
                      { key: 'cliente', label: 'Cliente' },
                      { key: 'modelo', label: 'Modelo' },
                      { key: 'tecido', label: 'Tecido' },
                      { key: 'fechado', label: 'Status' },
                      { key: 'ambiente', label: 'Ambiente' },
                      { key: 'valor_venda', label: 'Valor venda', currency: true },
                      { key: 'custo_tecido', label: 'Custo', currency: true },
                      { key: 'quantidade', label: 'Quantidade' },
                    ]

                    const prevSnap = idx < historico.length - 1
                      ? historico[idx + 1].snapshot as Record<string, unknown>
                      : null

                    const changes = prevSnap
                      ? TRACKED_FIELDS.filter(({ key }) => String(snap[key] ?? '') !== String(prevSnap[key] ?? ''))
                      : null

                    return (
                      <div key={h.id} className="px-4 py-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{h.changed_by}</span>
                        {' · '}
                        {formatHistoricoDate(h.changed_at)}
                        {changes === null ? (
                          <p className="mt-1 text-foreground/70 italic">Registro criado</p>
                        ) : changes.length === 0 ? (
                          <p className="mt-1 italic">Sem alterações detectadas</p>
                        ) : (
                          <ul className="mt-1 space-y-0.5">
                            {changes.map(({ key, label, currency }) => {
                              const oldVal = prevSnap![key]
                              const newVal = snap[key]
                              const fmt = (v: unknown) => {
                                if (v == null || v === '') return '—'
                                if (currency) return formatCurrency(Number(v))
                                return String(v)
                              }
                              return (
                                <li key={key}>
                                  <span className="font-medium text-foreground">{label}:</span>{' '}
                                  <span className="line-through opacity-60">{fmt(oldVal)}</span>
                                  {' → '}
                                  <span className="text-foreground">{fmt(newVal)}</span>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {confirmDelete ? (
            <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="mb-3 text-sm font-medium text-destructive">Tem certeza que deseja excluir este orçamento?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={handleDelete} disabled={isDeleting} className="flex-1 rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-60 transition-opacity">
                  {isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-destructive/40 px-3 py-3 text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={handleClose} className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={isUpdating} className="flex-1 rounded-lg bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-brand hover:opacity-90 disabled:opacity-60 transition-opacity">
                {isUpdating ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
