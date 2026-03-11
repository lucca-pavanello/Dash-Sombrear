import { useState } from 'react'
import { Send, CheckCircle2, Loader2, Plus, Trash2, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
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

interface Ambiente {
  id: number
  ambiente: string
  modelo: string
  tecido: string
  largura: string
  altura: string
  quantidade: string
  cor_ferragem_motor: string
  acabamento: string
}

interface FormState {
  responsavel: string
  zap: string
  cliente: string
  status: string
}

let nextId = 1
function newAmbiente(): Ambiente {
  return {
    id: nextId++,
    ambiente: '',
    modelo: MODELOS[0],
    tecido: '',
    largura: '',
    altura: '',
    quantidade: '1',
    cor_ferragem_motor: '',
    acabamento: '',
  }
}

const INITIAL_FORM: FormState = {
  responsavel: RESPONSAVEIS[0],
  zap: '',
  cliente: '',
  status: 'NOVO',
}

export default function TabCotacao() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [ambientes, setAmbientes] = useState<Ambiente[]>([newAmbiente()])
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  function setField(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setAmbienteField(id: number, key: keyof Omit<Ambiente, 'id'>, value: string) {
    setAmbientes((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [key]: value } : a))
    )
  }

  function addAmbiente() {
    setAmbientes((prev) => [...prev, newAmbiente()])
  }

  function removeAmbiente(id: number) {
    setAmbientes((prev) => prev.filter((a) => a.id !== id))
  }

  function validate(): string | null {
    if (!form.responsavel) return 'Responsável é obrigatório.'
    if (!form.cliente.trim()) return 'Cliente é obrigatório.'
    for (let i = 0; i < ambientes.length; i++) {
      const a = ambientes[i]
      const n = ambientes.length > 1 ? ` (Ambiente ${i + 1})` : ''
      if (!a.largura || parseFloat(a.largura) <= 0) return `Largura é obrigatória${n}.`
      if (!a.altura || parseFloat(a.altura) <= 0) return `Altura é obrigatória${n}.`
      if (!a.modelo) return `Modelo é obrigatório${n}.`
      if (!a.tecido.trim()) return `Tecido é obrigatório${n}.`
      if (!a.quantidade || parseInt(a.quantidade) < 1) return `Quantidade inválida${n}.`
    }
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
      responsavel: form.responsavel,
      zap: form.zap.trim(),
      cliente: form.cliente.trim(),
      status: form.status,
      ambientes: ambientes.map((a) => ({
        ambiente: a.ambiente.trim(),
        modelo: a.modelo,
        tecido: a.tecido.trim(),
        largura: parseFloat(a.largura),
        altura: parseFloat(a.altura),
        quantidade: parseInt(a.quantidade) || 1,
        cor_ferragem_motor: a.cor_ferragem_motor.trim(),
        acabamento: a.acabamento.trim(),
      })),
    }

    try {
      const response = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      setIsSuccess(true)
      toast('success', 'Orçamento enviado ao n8n com sucesso!')

      setTimeout(() => {
        setIsSuccess(false)
        setForm(INITIAL_FORM)
        setAmbientes([newAmbiente()])
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">

          {/* Left: form */}
          <div className="space-y-5">

            {/* Identificação */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Identificação
                </span>
                <div className="mt-2 border-t" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClass}>
                    Responsável <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <select
                    required
                    value={form.responsavel}
                    onChange={(e) => setField('responsavel', e.target.value)}
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
                    onChange={(e) => setField('cliente', e.target.value)}
                    className={inputClass}
                    placeholder="Nome do cliente"
                  />
                </div>

                <div>
                  <label className={labelClass}>WhatsApp / Zap</label>
                  <input
                    type="text"
                    value={form.zap}
                    onChange={(e) => setField('zap', e.target.value)}
                    className={inputClass}
                    placeholder="11999999999"
                  />
                </div>

                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setField('status', e.target.value)}
                    className={cn(inputClass, 'cursor-pointer')}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Ambientes */}
            {ambientes.map((a, index) => (
              <div key={a.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                      <Home className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ambiente {ambientes.length > 1 ? index + 1 : ''}
                    </span>
                  </div>
                  {ambientes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAmbiente(a.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Remover ambiente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 border-t mb-4" />

                <div className="grid grid-cols-2 gap-4">
                  {/* Nome do ambiente */}
                  <div className="col-span-2">
                    <label className={labelClass}>Nome do Ambiente</label>
                    <input
                      type="text"
                      value={a.ambiente}
                      onChange={(e) => setAmbienteField(a.id, 'ambiente', e.target.value)}
                      className={inputClass}
                      placeholder="Ex: Sala, Quarto, Escritório..."
                    />
                  </div>

                  {/* Modelo + Quantidade */}
                  <div>
                    <label className={labelClass}>
                      Modelo <span className="text-destructive ml-0.5">*</span>
                    </label>
                    <select
                      required
                      value={a.modelo}
                      onChange={(e) => setAmbienteField(a.id, 'modelo', e.target.value)}
                      className={cn(inputClass, 'cursor-pointer')}
                    >
                      {MODELOS.map((m) => (
                        <option key={m} value={m}>{m}</option>
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
                      value={a.quantidade}
                      onChange={(e) => setAmbienteField(a.id, 'quantidade', e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  {/* Tecido */}
                  <div className="col-span-2">
                    <label className={labelClass}>
                      Tecido <span className="text-destructive ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={a.tecido}
                      onChange={(e) => setAmbienteField(a.id, 'tecido', e.target.value)}
                      className={inputClass}
                      placeholder="Ex: Blackout, Solar Screen..."
                    />
                  </div>

                  {/* Medidas */}
                  <div>
                    <label className={labelClass}>
                      Largura (m) <span className="text-destructive ml-0.5">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={a.largura}
                      onChange={(e) => setAmbienteField(a.id, 'largura', e.target.value)}
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
                      value={a.altura}
                      onChange={(e) => setAmbienteField(a.id, 'altura', e.target.value)}
                      className={inputClass}
                      placeholder="1.80"
                    />
                  </div>

                  {/* Acabamentos */}
                  <div>
                    <label className={labelClass}>Cor Ferragem / Motor</label>
                    <input
                      type="text"
                      value={a.cor_ferragem_motor}
                      onChange={(e) => setAmbienteField(a.id, 'cor_ferragem_motor', e.target.value)}
                      className={inputClass}
                      placeholder="Branco"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Acabamento</label>
                    <input
                      type="text"
                      value={a.acabamento}
                      onChange={(e) => setAmbienteField(a.id, 'acabamento', e.target.value)}
                      className={inputClass}
                      placeholder="Bandô"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Botão adicionar ambiente */}
            <button
              type="button"
              onClick={addAmbiente}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors duration-150"
            >
              <Plus className="h-4 w-4" />
              Adicionar Ambiente
            </button>
          </div>

          {/* Right: Summary */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="font-display text-base font-semibold text-foreground mb-4">
                Resumo
              </h3>

              <div className="space-y-2 mb-5">
                <SummaryRow label="Responsável" value={form.responsavel} />
                <SummaryRow label="Cliente" value={form.cliente || '—'} />
                <SummaryRow label="Status" value={form.status} />
              </div>

              {/* Lista de ambientes */}
              <div className="space-y-3 mb-5">
                {ambientes.map((a, index) => (
                  <div key={a.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs font-semibold text-primary mb-2">
                      {a.ambiente || `Ambiente ${index + 1}`}
                    </p>
                    <div className="space-y-1">
                      <SummaryRow label="Modelo" value={a.modelo} />
                      <SummaryRow label="Tecido" value={a.tecido || '—'} />
                      <SummaryRow
                        label="Medidas"
                        value={a.largura && a.altura ? `${a.largura} × ${a.altura} m` : '—'}
                      />
                      <SummaryRow label="Qtd" value={a.quantidade ? `${a.quantidade} un` : '—'} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-5 rounded-lg bg-muted/50 border border-border px-4 py-3 text-center">
                <p className={labelClass}>Total de ambientes</p>
                <p className="text-2xl font-bold font-display text-primary">
                  {ambientes.length}
                </p>
              </div>

              {/* Submit */}
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
                  <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</>
                ) : isSuccess ? (
                  <><CheckCircle2 className="h-4 w-4" />Enviado com sucesso!</>
                ) : (
                  <><Send className="h-4 w-4" />Enviar para n8n</>
                )}
              </button>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Campos com <span className="text-destructive font-bold">*</span> são obrigatórios
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
      <span className="font-medium text-foreground text-right truncate max-w-[60%]">{value}</span>
    </div>
  )
}
