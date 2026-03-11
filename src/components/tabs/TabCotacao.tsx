import { useState } from 'react'
import { Send, CheckCircle2, Loader2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import Toaster from '@/components/ui/Toaster'

const RESPONSAVEIS = [
  'Stella',
  'Rogério',
  'Thais',
  'Gregório',
  'Sueli',
  'Sombrear Teste',
  'Persianas de Fábrica',
]

const MODELOS = [
  'Rolo',
  'Painel',
  'Romana',
  'Persiana Horizontal',
  'Persiana Vertical',
  'Zebra',
  'Double Vision',
  'Celular',
  'Plissado',
]

const STATUS_OPTIONS = ['NOVO', 'EM ANDAMENTO', 'AGUARDANDO', 'FEITO']

const inputClass =
  'w-full rounded-lg border bg-background px-3.5 py-3 text-sm outline-none ring-ring focus:ring-2 focus:border-primary transition-all duration-150'
const labelClass =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground'

const N8N_WEBHOOK = 'https://n8n-n8n.yjlhot.easypanel.host/webhook/Sombrear_sheet'

interface FormState {
  responsavel: string
  zap: string
  cliente: string
  largura: string
  altura: string
  modelo: string
  tecido: string
  quantidade: string
  cor_ferragem_motor: string
  acabamento: string
  custo_acabamento: string
  custo_m2: string
  status: string
}

const INITIAL_FORM: FormState = {
  responsavel: RESPONSAVEIS[0],
  zap: '',
  cliente: '',
  largura: '',
  altura: '',
  modelo: MODELOS[0],
  tecido: '',
  quantidade: '1',
  cor_ferragem_motor: '',
  acabamento: '',
  custo_acabamento: '',
  custo_m2: '',
  status: 'NOVO',
}

export default function TabCotacao() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const largura = parseFloat(form.largura) || 0
  const altura = parseFloat(form.altura) || 0
  const custo_m2 = parseFloat(form.custo_m2) || 0
  const quantidade = parseInt(form.quantidade) || 1
  const custo_acabamento = parseFloat(form.custo_acabamento) || 0

  const custoEstimado =
    largura > 0 && altura > 0 && custo_m2 > 0
      ? largura * altura * custo_m2 * quantidade + custo_acabamento
      : custo_acabamento > 0
        ? custo_acabamento
        : null

  function validate(): string | null {
    if (!form.responsavel) return 'Responsável é obrigatório.'
    if (!form.cliente.trim()) return 'Cliente é obrigatório.'
    if (!form.largura || parseFloat(form.largura) <= 0) return 'Largura é obrigatória.'
    if (!form.altura || parseFloat(form.altura) <= 0) return 'Altura é obrigatória.'
    if (!form.modelo) return 'Modelo é obrigatório.'
    if (!form.tecido.trim()) return 'Tecido é obrigatório.'
    if (!form.quantidade || parseInt(form.quantidade) < 1) return 'Quantidade inválida.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const error = validate()
    if (error) {
      toast('error', error)
      return
    }

    setIsLoading(true)

    const payload = {
      responsavel: form.responsavel.trim(),
      zap: form.zap.trim(),
      cliente: form.cliente.trim(),
      largura: form.largura ? parseFloat(form.largura) : 0,
      altura: form.altura ? parseFloat(form.altura) : 0,
      modelo: form.modelo,
      tecido: form.tecido.trim(),
      quantidade: parseInt(form.quantidade) || 1,
      cor_ferragem_motor: form.cor_ferragem_motor.trim(),
      acabamento: form.acabamento.trim(),
      custo_acabamento: form.custo_acabamento ? parseFloat(form.custo_acabamento) : 0,
      custo_m2: form.custo_m2 ? parseFloat(form.custo_m2) : 0,
      status: form.status,
    }

    try {
      const response = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      setIsSuccess(true)
      toast('success', 'Orçamento enviado ao n8n com sucesso!')

      setTimeout(() => {
        setIsSuccess(false)
        setForm(INITIAL_FORM)
      }, 2000)
    } catch (err) {
      console.error('[TabCotacao] submit error:', err)
      toast('error', 'Erro ao enviar. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="space-y-1 mb-6">
        <h2 className="font-display text-xl font-bold text-foreground">Cotação</h2>
        <p className="text-sm text-muted-foreground">
          Preencha os dados e envie para o n8n processar o orçamento.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: Form fields */}
          <div className="space-y-5">
            {/* Seção: Identificação */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Identificação
                  </span>
                  <div className="mt-2 border-t" />
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>
                    Responsável <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <select
                    required
                    value={form.responsavel}
                    onChange={(e) => set('responsavel', e.target.value)}
                    className={cn(inputClass, 'cursor-pointer')}
                  >
                    {RESPONSAVEIS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
                    Cliente <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.cliente}
                    onChange={(e) => set('cliente', e.target.value)}
                    className={inputClass}
                    placeholder="Nome do cliente"
                  />
                </div>

                <div>
                  <label className={labelClass}>WhatsApp / Zap</label>
                  <input
                    type="text"
                    value={form.zap}
                    onChange={(e) => set('zap', e.target.value)}
                    className={inputClass}
                    placeholder="11999999999"
                  />
                </div>
              </div>
            </div>

            {/* Seção: Produto */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Produto
                  </span>
                  <div className="mt-2 border-t" />
                </div>

                <div>
                  <label className={labelClass}>
                    Modelo <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <select
                    required
                    value={form.modelo}
                    onChange={(e) => set('modelo', e.target.value)}
                    className={cn(inputClass, 'cursor-pointer')}
                  >
                    {MODELOS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
                    Quantidade <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.quantidade}
                    onChange={(e) => set('quantidade', e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>
                    Tecido <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.tecido}
                    onChange={(e) => set('tecido', e.target.value)}
                    className={inputClass}
                    placeholder="Ex: Blackout, Solar Screen..."
                  />
                </div>
              </div>
            </div>

            {/* Seção: Medidas */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Medidas
                  </span>
                  <div className="mt-2 border-t" />
                </div>

                <div>
                  <label className={labelClass}>
                    Largura (m) <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.largura}
                    onChange={(e) => set('largura', e.target.value)}
                    className={inputClass}
                    placeholder="2.50"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Altura (m) <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.altura}
                    onChange={(e) => set('altura', e.target.value)}
                    className={inputClass}
                    placeholder="1.80"
                  />
                </div>
              </div>
            </div>

            {/* Seção: Acabamentos */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Acabamentos
                  </span>
                  <div className="mt-2 border-t" />
                </div>

                <div>
                  <label className={labelClass}>Cor Ferragem / Motor</label>
                  <input
                    type="text"
                    value={form.cor_ferragem_motor}
                    onChange={(e) => set('cor_ferragem_motor', e.target.value)}
                    className={inputClass}
                    placeholder="Branco"
                  />
                </div>

                <div>
                  <label className={labelClass}>Acabamento</label>
                  <input
                    type="text"
                    value={form.acabamento}
                    onChange={(e) => set('acabamento', e.target.value)}
                    className={inputClass}
                    placeholder="Bandô"
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelClass}>Custo do Acabamento (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.custo_acabamento}
                    onChange={(e) => set('custo_acabamento', e.target.value)}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Seção: Custo */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Custo
                  </span>
                  <div className="mt-2 border-t" />
                </div>

                <div>
                  <label className={labelClass}>
                    Custo por m² (R$) <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.custo_m2}
                    onChange={(e) => set('custo_m2', e.target.value)}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => set('status', e.target.value)}
                    className={cn(inputClass, 'cursor-pointer')}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Summary panel */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="font-display text-base font-semibold text-foreground mb-4">
                Resumo do Orçamento
              </h3>

              <div className="space-y-3 mb-6">
                <SummaryRow label="Cliente" value={form.cliente || '—'} />
                <SummaryRow label="Modelo" value={form.modelo} />
                <SummaryRow
                  label="Medidas"
                  value={
                    form.largura && form.altura
                      ? `${form.largura} × ${form.altura} m`
                      : '—'
                  }
                />
                <SummaryRow
                  label="Quantidade"
                  value={form.quantidade ? `${form.quantidade} un` : '—'}
                />
                <SummaryRow
                  label="Custo m²"
                  value={custo_m2 > 0 ? formatCurrency(custo_m2) : '—'}
                />
                <SummaryRow
                  label="Acabamento"
                  value={form.acabamento || '—'}
                />
              </div>

              {/* Custo estimado */}
              <div
                className={cn(
                  'rounded-lg px-4 py-3 mb-6 transition-colors duration-200',
                  custoEstimado !== null
                    ? 'bg-primary/8 border border-primary/20'
                    : 'bg-muted/50 border border-border',
                )}
              >
                <p className={labelClass}>Custo estimado</p>
                <p
                  className={cn(
                    'text-2xl font-bold font-display',
                    custoEstimado !== null ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {custoEstimado !== null ? formatCurrency(custoEstimado) : 'R$ —'}
                </p>
                {custoEstimado !== null && largura > 0 && altura > 0 && custo_m2 > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.largura} × {form.altura}m × {formatCurrency(custo_m2)}/m² × {quantidade}un
                    {custo_acabamento > 0 ? ` + ${formatCurrency(custo_acabamento)} acab.` : ''}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || isSuccess}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-all duration-150',
                  isSuccess
                    ? 'bg-green-500 shadow-none'
                    : 'bg-brand-gradient shadow-brand hover:opacity-90 active:scale-95',
                  (isLoading || isSuccess) && 'opacity-80 cursor-not-allowed',
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Enviado com sucesso!
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar para n8n
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Os campos com <span className="text-destructive font-bold">*</span> são obrigatórios
              </p>
            </div>
          </div>
        </div>
      </form>

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

interface SummaryRowProps {
  label: string
  value: string
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  )
}
