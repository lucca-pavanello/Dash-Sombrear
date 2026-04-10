import { X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useAddCustoInterno } from '@/hooks/useAddCustoInterno'
import { formatCurrency } from '@/lib/utils'
import { RESPONSAVEIS, MODELOS, SUGESTOES_AMBIENTE, MODELO_RULES } from '@/lib/constants'

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

interface Props {
  toast: (type: 'success' | 'error', message: string) => void
  open: boolean
  onClose: () => void
}

export default function NovoCustoInternoForm({ toast, open, onClose }: Props) {
  const { mutateAsync, isPending } = useAddCustoInterno()
  const panelRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    responsavel: '',
    cliente: '',
    ambiente: '',
    modelo: MODELOS[0],
    tecido: '',
    largura: '',
    altura: '',
    quantidade: '1',
    custo_m2: '',
    custo_acabamento: '',
    custo_instalacao: '',
    custo_material: '',
    cor_ferragem_motor: '',
    acabamentos: '',
  })

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
    return () => { previousFocus?.focus() }
  }, [open])

  useEffect(() => {
    if (open) {
      setForm({
        responsavel: '', cliente: '', ambiente: '',
        modelo: MODELOS[0], tecido: '', largura: '', altura: '',
        quantidade: '1', custo_m2: '', custo_acabamento: '',
        custo_instalacao: '', custo_material: '',
        cor_ferragem_motor: '', acabamentos: '',
      })
    }
  }, [open])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Auto-calcula custo_material quando dimensões/custo_m2/quantidade mudam
  useEffect(() => {
    const l = parseFloat(form.largura)
    const h = parseFloat(form.altura)
    const cm2 = parseFloat(form.custo_m2)
    const qtd = parseInt(form.quantidade) || 1
    if (l > 0 && h > 0 && cm2 > 0) {
      setForm(f => ({ ...f, custo_material: (l * h * cm2 * qtd).toFixed(2) }))
    }
  }, [form.largura, form.altura, form.custo_m2, form.quantidade])

  const calcMaterial = (() => {
    const l = parseFloat(form.largura)
    const h = parseFloat(form.altura)
    const cm2 = parseFloat(form.custo_m2)
    const qtd = parseInt(form.quantidade) || 1
    if (l > 0 && h > 0 && cm2 > 0) return l * h * cm2 * qtd
    return null
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.responsavel) { toast('error', 'Responsável é obrigatório.'); return }
    if (!form.modelo) { toast('error', 'Modelo é obrigatório.'); return }
    if (!form.tecido.trim()) { toast('error', 'Tecido é obrigatório.'); return }

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
      await mutateAsync({
        responsavel: form.responsavel,
        cliente: form.cliente || null,
        ambiente: form.ambiente || null,
        modelo: form.modelo,
        tecido: form.tecido,
        largura: form.largura ? Number(form.largura) : null,
        altura: form.altura ? Number(form.altura) : null,
        quantidade: parseInt(form.quantidade) || 1,
        cor_ferragem_motor: form.cor_ferragem_motor || null,
        acabamentos: form.acabamentos || null,
        custo_m2: form.custo_m2 ? Number(form.custo_m2) : null,
        custo_material: form.custo_material ? Number(form.custo_material) : calcMaterial ?? null,
        custo_acabamento: form.custo_acabamento ? Number(form.custo_acabamento) : null,
        custo_instalacao: form.custo_instalacao ? Number(form.custo_instalacao) : null,
        fonte: 'manual',
      })
      toast('success', 'Custo interno salvo com sucesso!')
      onClose()
    } catch (err) {
      console.error('[NovoCustoInternoForm] handleSubmit error:', err)
      toast('error', 'Erro ao salvar custo interno.')
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-custo"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-elevated max-h-[92dvh] flex flex-col outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <h2 id="modal-title-custo" className="font-display text-base font-semibold">Novo Custo Interno</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 pb-5 pt-4">
          <div className="grid grid-cols-2 gap-4">

            {/* Responsável */}
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

            {/* Cliente */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>Cliente</label>
              <input value={form.cliente} onChange={(e) => set('cliente', e.target.value)} className={inputClass} placeholder="Nome do cliente" />
            </div>

            {/* Ambiente */}
            <div className="col-span-2">
              <label className={labelClass}>Ambiente</label>
              <input
                value={form.ambiente}
                onChange={(e) => set('ambiente', e.target.value)}
                className={inputClass}
                placeholder="Ex: Sala, Quarto, Escritório..."
                list="ambientes-list-custo"
              />
              <datalist id="ambientes-list-custo">
                {SUGESTOES_AMBIENTE.map(a => <option key={a} value={a} />)}
              </datalist>
            </div>

            {/* Modelo */}
            <div>
              <label className={labelClass}>Modelo <span className="text-destructive ml-0.5">*</span></label>
              <select required value={form.modelo} onChange={(e) => set('modelo', e.target.value)} className={inputClass}>
                {MODELOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>

            <ModeloHint modelo={form.modelo} />

            {/* Quantidade */}
            <div>
              <label className={labelClass}>Quantidade</label>
              <input type="number" min="1" value={form.quantidade} onChange={(e) => set('quantidade', e.target.value)} className={inputClass} />
            </div>

            {/* Tecido */}
            <div className="col-span-2">
              <label className={labelClass}>Tecido <span className="text-destructive ml-0.5">*</span></label>
              <input required value={form.tecido} onChange={(e) => set('tecido', e.target.value)} className={inputClass} placeholder="Ex: Blackout, Solar Screen..." />
            </div>

            {/* Largura / Altura */}
            <div>
              <label className={labelClass}>Largura (m)</label>
              <input type="text" inputMode="decimal" value={form.largura} onChange={(e) => set('largura', e.target.value.replace(',', '.'))} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Altura (m)</label>
              <input type="text" inputMode="decimal" value={form.altura} onChange={(e) => set('altura', e.target.value.replace(',', '.'))} className={inputClass} placeholder="0.00" />
            </div>

            {/* Custo por m² */}
            <div>
              <label className={labelClass}>Custo por m² (R$)</label>
              <input type="number" step="0.01" value={form.custo_m2} onChange={(e) => set('custo_m2', e.target.value)} className={inputClass} placeholder="0.00" />
            </div>

            {/* Custo Acabamento */}
            <div>
              <label className={labelClass}>Custo Acabamento (R$)</label>
              <input type="number" step="0.01" value={form.custo_acabamento} onChange={(e) => set('custo_acabamento', e.target.value)} className={inputClass} placeholder="0.00" />
            </div>

            {/* Custo Material */}
            <div className="col-span-2">
              <label className={labelClass}>
                Custo Material (R$)
                {calcMaterial !== null && form.custo_material === calcMaterial.toFixed(2) && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">calculado automaticamente</span>
                )}
              </label>
              <input type="number" step="0.01" value={form.custo_material} onChange={(e) => set('custo_material', e.target.value)} className={inputClass} placeholder="0.00" />
              {calcMaterial !== null && (
                <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  = {formatCurrency(calcMaterial)}
                  <span className="text-muted-foreground/60">
                    ({form.largura}×{form.altura}m × R${form.custo_m2}/m² × {form.quantidade}un)
                  </span>
                  <button
                    type="button"
                    onClick={() => set('custo_material', calcMaterial.toFixed(2))}
                    className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-primary font-medium hover:bg-primary/20 transition-colors"
                  >
                    Usar
                  </button>
                </p>
              )}
            </div>

            {/* Custo Instalação */}
            <div className="col-span-2">
              <label className={labelClass}>Custo Instalação (R$)</label>
              <input type="number" step="0.01" value={form.custo_instalacao} onChange={(e) => set('custo_instalacao', e.target.value)} className={inputClass} placeholder="0.00" />
            </div>

          </div>

          {/* Botões */}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-brand hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
