import { useState } from 'react'
import { Send, CheckCircle2, Loader2, Plus, Trash2, Home, User, MessageSquare, Ruler, Layers } from 'lucide-react'
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
  whatsapp: boolean
  cliente: string
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
  whatsapp: false,
  cliente: '',
}

export default function TabCotacao() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [ambientes, setAmbientes] = useState<Ambiente[]>([newAmbiente()])
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setAmbienteField(id: number, key: keyof Omit<Ambiente, 'id'>, value: string) {
    setAmbientes((prev) => prev.map((a) => (a.id === id ? { ...a, [key]: value } : a)))
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
    if (error) { toast('error', error); return }

    setIsLoading(true)
    const payload = {
      responsavel: form.responsavel,
      whatsapp: form.whatsapp,
      cliente: form.cliente.trim(),
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
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Nova Cotação</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Preencha os dados e envie para o n8n calcular o orçamento.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">n8n conectado</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">

          {/* ── Left column ── */}
          <div className="space-y-4">

            {/* Card: Identificação */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              {/* Card header strip */}
              <div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-3.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-base font-semibold font-display">Identificação</span>
              </div>

              <div className="p-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Responsável */}
                <div className="sm:col-span-2">
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

                {/* Cliente */}
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

                {/* WhatsApp toggle */}
                <div className="flex flex-col justify-end">
                  <label className={labelClass}>
                    <MessageSquare className="inline h-3 w-3 mr-1 -mt-0.5" />
                    Enviar via WhatsApp
                  </label>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={form.whatsapp}
                    onClick={() => setField('whatsapp', !form.whatsapp)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-150',
                      form.whatsapp
                        ? 'border-primary/40 bg-primary/5 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/40'
                    )}
                  >
                    <div className={cn(
                      'h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                      form.whatsapp ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-transparent'
                    )}>
                      {form.whatsapp && (
                        <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span>{form.whatsapp ? 'Sim, enviar pelo WhatsApp' : 'Não enviar pelo WhatsApp'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cards: Ambientes */}
            {ambientes.map((a, index) => (
              <div key={a.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                      <Home className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-base font-semibold font-display">
                      {a.ambiente || (ambientes.length > 1 ? `Ambiente ${index + 1}` : 'Ambiente')}
                    </span>
                    {ambientes.length > 1 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        #{index + 1}
                      </span>
                    )}
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

                <div className="p-5 space-y-5">
                  {/* Nome do ambiente */}
                  <div>
                    <label className={labelClass}>Nome do Ambiente</label>
                    <input
                      type="text"
                      value={a.ambiente}
                      onChange={(e) => setAmbienteField(a.id, 'ambiente', e.target.value)}
                      className={inputClass}
                      placeholder="Ex: Sala, Quarto, Escritório..."
                    />
                  </div>

                  {/* Produto */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Produto</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

                  {/* Medidas */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Medidas</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
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
                      <div>
                        <label className={labelClass}>
                          Qtd <span className="text-destructive ml-0.5">*</span>
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
                    </div>

                    {/* Área calculada */}
                    {parseFloat(a.largura) > 0 && parseFloat(a.altura) > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Área:</span>
                        <span className="text-xs font-semibold text-foreground">
                          {(parseFloat(a.largura) * parseFloat(a.altura)).toFixed(2)} m²
                          {parseInt(a.quantidade) > 1 && ` × ${a.quantidade} = ${(parseFloat(a.largura) * parseFloat(a.altura) * parseInt(a.quantidade)).toFixed(2)} m² total`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Add ambiente button */}
            <button
              type="button"
              onClick={addAmbiente}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-150 group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-current group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </div>
              Adicionar Ambiente
            </button>
          </div>

          {/* ── Right column: Summary ── */}
          <div className="lg:sticky lg:top-24 h-fit space-y-4">

            {/* Resumo card */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="border-b bg-muted/30 px-5 py-3.5">
                <h3 className="font-display text-base font-semibold">Resumo</h3>
              </div>
              <div className="p-5 space-y-4">

                {/* Cliente info */}
                <div className="space-y-2">
                  <SummaryRow label="Responsável" value={form.responsavel} />
                  <SummaryRow label="Cliente" value={form.cliente || '—'} />
                  <SummaryRow
                    label="WhatsApp"
                    value={form.whatsapp ? 'Sim' : 'Não'}
                    valueClass={form.whatsapp ? 'text-green-600 dark:text-green-400' : undefined}
                  />
                </div>

                <div className="border-t" />

                {/* Ambientes list */}
                <div className="space-y-2">
                  {ambientes.map((a, index) => (
                    <div key={a.id} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                      <p className="text-xs font-semibold text-primary truncate mb-1.5">
                        {a.ambiente || `Ambiente ${index + 1}`}
                      </p>
                      <div className="space-y-1">
                        <SummaryRow label="Modelo" value={a.modelo} small />
                        <SummaryRow label="Tecido" value={a.tecido || '—'} small />
                        <SummaryRow
                          label="Medidas"
                          value={a.largura && a.altura ? `${a.largura}×${a.altura}m` : '—'}
                          small
                        />
                        <SummaryRow label="Qtd" value={a.quantidade ? `${a.quantidade}×` : '—'} small />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total badge */}
                <div className="flex items-center justify-between rounded-lg bg-primary/8 border border-primary/20 px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ambientes</span>
                  <span className="font-display text-2xl font-bold text-primary">{ambientes.length}</span>
                </div>
              </div>
            </div>

            {/* Submit card */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <button
                type="submit"
                disabled={isLoading || isSuccess}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3.5 text-sm font-semibold text-white transition-all duration-150',
                  isSuccess
                    ? 'bg-green-500'
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
                Campos com <span className="text-destructive font-semibold">*</span> são obrigatórios
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
  small?: boolean
  valueClass?: string
}

function SummaryRow({ label, value, small, valueClass }: SummaryRowProps) {
  return (
    <div className={cn('flex items-start justify-between gap-2', small ? 'text-xs' : 'text-sm')}>
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('font-medium text-right truncate max-w-[58%]', valueClass ?? 'text-foreground')}>{value}</span>
    </div>
  )
}
