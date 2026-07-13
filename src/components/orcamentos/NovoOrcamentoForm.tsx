import { X, Check } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useAddOrcamento } from '@/hooks/useOrcamentos'
import { cn, formatCurrency, calcularMargem } from '@/lib/utils'
import SectionDivider from '@/components/shared/SectionDivider'
import { MODELOS, SUGESTOES_AMBIENTE, MODELO_RULES } from '@/lib/constants'
import { useResponsaveis } from '@/hooks/useResponsaveis'
import { useSugestaoCustoTecido } from '@/hooks/useSugestaoCustoTecido'

function ModeloHint({ modelo }: { modelo: string }) {
  const rule = MODELO_RULES[modelo]
  if (!rule) return null
  return (
    <div className="col-span-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs space-y-1.5">
      {rule.avisos?.map((a, i) => (
        <p key={i} className="font-medium text-amber-600 dark:text-amber-400 flex gap-1.5">
          <span>⚠</span><span>{a}</span>
        </p>
      ))}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {rule.obrigatorio.length > 0 && (
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">Obrigatório:</span>{' '}
            {rule.obrigatorio.join(' · ')}
          </span>
        )}
        {rule.opcional.length > 0 && (
          <span className="text-muted-foreground">
            <span className="font-semibold">Opcional:</span>{' '}
            {rule.opcional.join(' · ')}
          </span>
        )}
        {rule.naplicavel.length > 0 && (
          <span className="text-muted-foreground/50 line-through">
            {rule.naplicavel.join(' · ')}
          </span>
        )}
      </div>
    </div>
  )
}
const inputClass = 'w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2 focus:border-primary transition-all duration-150'
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

const EMPTY_FORM = {
  responsavel: '', cliente: '', telefone: '', ambiente: '', largura: '', altura: '',
  modelo: MODELOS[0], tecido: '', quantidade: '1',
  cor_ferragem_motor: '', acabamentos: '', valor_venda: '', instalacao: '',
  custo_m2: '', custo_tecido: '', custo_acabamento: '', observacoes: '',
}

export type OrcamentoFormState = typeof EMPTY_FORM

interface Props {
  toast: (type: 'success' | 'error', message: string) => void
  open: boolean
  onClose: () => void
  /** Pré-preenche o form (ex.: criar orçamento a partir de um lead do Agente IA) */
  initial?: Partial<OrcamentoFormState>
  /** Valor gravado na coluna fonte (default: 'manual') */
  fonte?: string
}

const STEPS = [
  { number: 1, label: 'Cliente' },
  { number: 2, label: 'Produto' },
  { number: 3, label: 'Financeiro' },
]

export default function NovoOrcamentoForm({ toast, open, onClose, initial, fonte = 'manual' }: Props) {
  const responsaveis = useResponsaveis()
  const { mutateAsync, isPending } = useAddOrcamento()
  const panelRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(1)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => {
      previousFocus?.focus()
    }
  }, [open])

  // Reset step and form when modal is opened/closed
  useEffect(() => {
    if (open) {
      setStep(1)
      setForm({ ...EMPTY_FORM, ...initial })
    }
  }, [open, initial])

  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

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

  const sugestaoCusto = useSugestaoCustoTecido(form.tecido)
  const mostrarSugestaoCusto = sugestaoCusto && form.custo_m2 !== sugestaoCusto.custoM2.toFixed(2)

  const receita = (parseFloat(form.valor_venda) || 0) + (parseFloat(form.instalacao) || 0)
  const custoPreview = parseFloat(form.custo_tecido) || 0
  const previewMargem = receita > 0 && custoPreview > 0 ? calcularMargem(receita, custoPreview) : null

  function validateStep(s: number): string | null {
    if (s === 1 && !form.responsavel) return 'Responsável é obrigatório.'
    if (s === 2) {
      if (!form.modelo) return 'Modelo é obrigatório.'
      if (!form.tecido.trim()) return 'Tecido é obrigatório.'
      if (!(parseInt(form.quantidade) >= 1)) return 'Quantidade deve ser ao menos 1.'
    }
    return null
  }

  function handleNext() {
    const err = validateStep(step)
    if (err) { toast('error', err); return }
    setStep((s) => Math.min(s + 1, 3))
  }

  function handlePrev() {
    setStep((s) => Math.max(s - 1, 1))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qtd = Number(form.quantidade)
    if (!Number.isInteger(qtd) || qtd < 1) {
      toast('error', 'Quantidade deve ser um número inteiro maior que zero.')
      return
    }
    const validDecimal = /^\d+(\.\d+)?$/
    if (form.largura && !validDecimal.test(form.largura.trim())) {
      toast('error', 'Largura inválida. Use apenas números (ex: 1.50).')
      return
    }
    if (form.altura && !validDecimal.test(form.altura.trim())) {
      toast('error', 'Altura inválida. Use apenas números (ex: 1.80).')
      return
    }
    try {
      const receitaFinal = (form.valor_venda ? Number(form.valor_venda) : 0) + (form.instalacao ? Number(form.instalacao) : 0)
      const custoTotal = form.custo_tecido ? Number(form.custo_tecido) : (calcCusto ?? null)
      const margem = custoTotal != null ? calcularMargem(receitaFinal, custoTotal) : null

      await mutateAsync({
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
        instalacao: form.instalacao ? Number(form.instalacao) : null,
        custo_m2: form.custo_m2 ? Number(form.custo_m2) : null,
        custo_tecido: form.custo_tecido ? Number(form.custo_tecido) : calcCusto ?? null,
        custo_acabamento: form.custo_acabamento ? Number(form.custo_acabamento) : null,
        fechado: false,
        observacoes: form.observacoes || null,
        ambiente: form.ambiente || null,
        margem,
        fonte,
      })
      toast('success', 'Orçamento salvo com sucesso!')
      onClose()
    } catch (err) {
      console.error('[NovoOrcamentoForm] handleSubmit error:', err)
      toast('error', 'Erro ao salvar orçamento.')
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-novo"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-elevated max-h-[92dvh] flex flex-col outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <h2 id="modal-title-novo" className="font-display text-base font-semibold">Novo Orçamento</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 px-5 pt-4 pb-2 shrink-0">
          {STEPS.map((s, idx) => (
            <div key={s.number} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  // Allow going back freely; going forward validates
                  if (s.number < step) setStep(s.number)
                  else if (s.number === step + 1) handleNext()
                }}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold border-2 transition-all duration-200',
                  step === s.number
                    ? 'border-primary bg-primary text-white'
                    : step > s.number
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30 bg-muted text-muted-foreground'
                )}
              >
                {step > s.number ? <Check className="h-3.5 w-3.5" /> : s.number}
              </button>
              <span className={cn(
                'ml-1.5 text-[11px] font-semibold transition-colors',
                step === s.number ? 'text-primary' : step > s.number ? 'text-primary/60' : 'text-muted-foreground/50'
              )}>
                {s.label}
              </span>
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  'mx-2 h-px w-8 transition-colors duration-200',
                  step > s.number ? 'bg-primary/40' : 'bg-muted-foreground/20'
                )} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 pb-5 pt-2">

          {/* ── Passo 1: Cliente ── */}
          {step === 1 && (
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
                  <option value="">Selecione…</option>
                  {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Cliente</label>
                <input value={form.cliente} onChange={(e) => set('cliente', e.target.value)} className={inputClass} placeholder="Nome do cliente" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Telefone</label>
                <input type="tel" value={form.telefone} onChange={(e) => set('telefone', e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Ambiente</label>
                <input
                  value={form.ambiente}
                  onChange={(e) => set('ambiente', e.target.value)}
                  className={inputClass}
                  placeholder="Ex: Sala, Quarto, Escritório…"
                  list="ambientes-list-novo"
                />
                <datalist id="ambientes-list-novo">
                  {SUGESTOES_AMBIENTE.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>
            </div>
          )}

          {/* ── Passo 2: Produto ── */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              <SectionDivider label="Produto" />
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Modelo <span className="text-destructive ml-0.5">*</span></label>
                <select required value={form.modelo} onChange={(e) => set('modelo', e.target.value)} className={cn(inputClass, 'cursor-pointer')}>
                  {MODELOS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <ModeloHint modelo={form.modelo} />
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Quantidade <span className="text-destructive ml-0.5">*</span></label>
                <input required type="number" min="1" value={form.quantidade} onChange={(e) => set('quantidade', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Largura (m)</label>
                <input type="text" inputMode="decimal" value={form.largura} onChange={(e) => set('largura', e.target.value.replace(',', '.'))} className={inputClass} placeholder="0.00" />
              </div>
              <div>
                <label className={labelClass}>Altura (m)</label>
                <input type="text" inputMode="decimal" value={form.altura} onChange={(e) => set('altura', e.target.value.replace(',', '.'))} className={inputClass} placeholder="0.00" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Tecido <span className="text-destructive ml-0.5">*</span></label>
                <input required value={form.tecido} onChange={(e) => set('tecido', e.target.value)} className={inputClass} placeholder="Ex: Blackout, Solar Screen…" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Cor Ferragem / Motor</label>
                <input value={form.cor_ferragem_motor} onChange={(e) => set('cor_ferragem_motor', e.target.value)} className={inputClass} placeholder="Ex: Branco, Preto, Motorizado…" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Acabamentos</label>
                <input value={form.acabamentos} onChange={(e) => set('acabamentos', e.target.value)} className={inputClass} placeholder="Opcional" />
              </div>
            </div>
          )}

          {/* ── Passo 3: Financeiro ── */}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-4">
              <SectionDivider label="Financeiro" />
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Valor de Venda (R$)</label>
                <input type="number" step="0.01" value={form.valor_venda} onChange={(e) => set('valor_venda', e.target.value)} className={inputClass} placeholder="0.00" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Valor Instalação (R$)</label>
                <input type="number" step="0.01" value={form.instalacao} onChange={(e) => set('instalacao', e.target.value)} className={inputClass} placeholder="0.00" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>
                  Custo por m² (R$)
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">do tecido</span>
                </label>
                <input type="number" step="0.01" value={form.custo_m2} onChange={(e) => set('custo_m2', e.target.value)} className={inputClass} placeholder="0.00" />
                {mostrarSugestaoCusto && (
                  <p className="mt-1.5 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground truncate">
                      Estoque: {formatCurrency(sugestaoCusto.custoM2)}/m²
                      <span className="ml-1 text-muted-foreground/60">({sugestaoCusto.nome})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => set('custo_m2', sugestaoCusto.custoM2.toFixed(2))}
                      className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-primary font-medium hover:bg-primary/20 transition-colors"
                    >
                      Usar
                    </button>
                  </p>
                )}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Custo Acabamento (R$)</label>
                <input type="number" step="0.01" value={form.custo_acabamento} onChange={(e) => set('custo_acabamento', e.target.value)} className={inputClass} placeholder="0.00" />
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
                    {formatCurrency(receita)} − {formatCurrency(custoPreview)}
                  </span>
                </div>
              )}

              <div className="col-span-2">
                <label className={labelClass}>Observações</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => set('observacoes', e.target.value)}
                  className={cn(inputClass, 'resize-none')}
                  rows={3}
                  placeholder="Endereço de instalação, detalhes extras…"
                />
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-6 flex gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
              >
                Anterior
              </button>
            ) : (
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors">
                Cancelar
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 rounded-lg bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-brand hover:opacity-90 transition-opacity"
              >
                Próximo
              </button>
            ) : (
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-lg bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-brand hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {isPending ? 'Salvando…' : 'Salvar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
