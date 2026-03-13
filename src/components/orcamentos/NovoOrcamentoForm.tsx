import { X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useAddOrcamento } from '@/hooks/useOrcamentos'
import { cn, formatCurrency } from '@/lib/utils'
import SectionDivider from '@/components/shared/SectionDivider'
import { RESPONSAVEIS } from '@/lib/constants'

const MODELOS = ['Rolo', 'Romeu e Julieta', 'Vertical', 'Horizontal', 'Painel', 'Cortina']
const inputClass = 'w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2 focus:border-primary transition-all duration-150'
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

interface Props {
  toast: (type: 'success' | 'error', message: string) => void
  open: boolean
  onClose: () => void
  responsaveis?: string[]
}

export default function NovoOrcamentoForm({ toast, open, onClose }: Props) {
  const { mutateAsync, isPending } = useAddOrcamento()
  const panelRef = useRef<HTMLDivElement>(null)

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

  const [form, setForm] = useState({
    responsavel: '', cliente: '', telefone: '', ambiente: '', largura: '', altura: '',
    modelo: MODELOS[0], tecido: '', quantidade: '1',
    cor_ferragem_motor: '', acabamentos: '', valor_venda: '', instacao: '',
    custo_m2: '', custo_tecido: '', custo_acabamento: '', observacoes: '',
  })

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

  // TAREFA A: auto-preenche custo_tecido quando as dimensões e custo_m2 são válidos
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

  const previewMargem = (() => {
    const receita = (parseFloat(form.valor_venda) || 0) + (parseFloat(form.instacao) || 0)
    const custo = parseFloat(form.custo_tecido) || 0
    if (receita > 0 && custo > 0) return ((receita - custo) / receita) * 100
    return null
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      // TAREFA A: calcular margem no payload
      const receita = (form.valor_venda ? Number(form.valor_venda) : 0) + (form.instacao ? Number(form.instacao) : 0)
      const custoTotal = form.custo_tecido ? Number(form.custo_tecido) : (calcCusto ?? null)
      const margem = receita > 0 && custoTotal ? ((receita - custoTotal) / receita) * 100 : null

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
        instacao: form.instacao ? Number(form.instacao) : null,
        custo_m2: form.custo_m2 ? Number(form.custo_m2) : null,
        custo_tecido: form.custo_tecido ? Number(form.custo_tecido) : calcCusto ?? null,
        custo_acabamento: form.custo_acabamento ? Number(form.custo_acabamento) : null,
        fechado: false,
        observacoes: form.observacoes || null,
        ambiente: form.ambiente || null,
        margem,
      })
      toast('success', 'Orçamento salvo com sucesso!')
      onClose()
      setForm({
        responsavel: '', cliente: '', telefone: '', ambiente: '', largura: '', altura: '',
        modelo: MODELOS[0], tecido: '', quantidade: '1',
        cor_ferragem_motor: '', acabamentos: '', valor_venda: '', instacao: '',
        custo_m2: '', custo_tecido: '', custo_acabamento: '', observacoes: '',
      })
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
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <h2 id="modal-title-novo" className="font-display text-base font-semibold">Novo Orçamento</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-2 gap-4">

            <SectionDivider label="Cliente" />

            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>Responsável <span className="text-destructive ml-0.5">*</span></label>
              {/* TAREFA F: datalist para autocomplete */}
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
              <input value={form.cliente} onChange={(e) => set('cliente', e.target.value)} className={inputClass} placeholder="Nome do cliente" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Telefone</label>
              <input type="tel" value={form.telefone} onChange={(e) => set('telefone', e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
            </div>

            <SectionDivider label="Produto" />

            <div className="col-span-2">
              <label className={labelClass}>Ambiente <span className="text-destructive ml-0.5">*</span></label>
              <input
                required
                value={form.ambiente}
                onChange={(e) => set('ambiente', e.target.value)}
                className={inputClass}
                placeholder="Ex: Sala, Quarto, Escritório..."
                list="ambientes-list-novo"
              />
              <datalist id="ambientes-list-novo">
                {['Sala', 'Quarto', 'Quarto 1', 'Quarto 2', 'Escritório', 'Cozinha', 'Varanda', 'Banheiro', 'Hall', 'Suíte'].map(a => <option key={a} value={a} />)}
              </datalist>
            </div>

            <div>
              <label className={labelClass}>Largura (m)</label>
              <input type="number" step="0.01" value={form.largura} onChange={(e) => set('largura', e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Altura (m)</label>
              <input type="number" step="0.01" value={form.altura} onChange={(e) => set('altura', e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Modelo <span className="text-destructive ml-0.5">*</span></label>
              <select required value={form.modelo} onChange={(e) => set('modelo', e.target.value)} className={cn(inputClass, 'cursor-pointer')}>
                {MODELOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Quantidade <span className="text-destructive ml-0.5">*</span></label>
              <input required type="number" min="1" value={form.quantidade} onChange={(e) => set('quantidade', e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Tecido <span className="text-destructive ml-0.5">*</span></label>
              <input required value={form.tecido} onChange={(e) => set('tecido', e.target.value)} className={inputClass} placeholder="Ex: Blackout, Solar Screen..." />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Cor Ferragem / Motor</label>
              <input value={form.cor_ferragem_motor} onChange={(e) => set('cor_ferragem_motor', e.target.value)} className={inputClass} placeholder="Ex: Branco, Preto, Motorizado..." />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Acabamentos</label>
              <input value={form.acabamentos} onChange={(e) => set('acabamentos', e.target.value)} className={inputClass} placeholder="Opcional" />
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
              <input type="number" step="0.01" value={form.custo_m2} onChange={(e) => set('custo_m2', e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Custo Acabamento (R$)</label>
              <input type="number" step="0.01" value={form.custo_acabamento} onChange={(e) => set('custo_acabamento', e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              {/* TAREFA A: badge "calculado automaticamente" */}
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

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-brand hover:opacity-90 disabled:opacity-60 transition-opacity">
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

