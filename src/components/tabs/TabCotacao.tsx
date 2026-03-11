import { useState } from 'react'
import {
  Send, CheckCircle2, Loader2, Plus, Trash2, Home,
  User, Ruler, Layers, MessageSquare, ArrowRight, AlertCircle, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import Toaster from '@/components/ui/Toaster'
import { useModelosTecidos } from '@/hooks/useModelosTecidos'

/* ─── Constants ─────────────────────────────────────────── */
const RESPONSAVEIS = [
  'Stella', 'Rogério', 'Thais', 'Gregório',
  'Sueli', 'Sombrear Teste', 'Persianas de Fábrica',
]

const N8N_WEBHOOK = 'https://n8n-n8n.yjlhot.easypanel.host/webhook/Sombrear_sheet'

const inputClass =
  'w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring focus:border-primary transition-all duration-150'
const selectClass =
  'w-full cursor-pointer rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all duration-150'
const labelClass =
  'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70'

/* ─── Types ──────────────────────────────────────────────── */
interface Ambiente {
  id: number
  ambiente: string
  modelo: string
  tecido: string
  largura: string
  altura: string
  quantidade: string
  cor_ferragem: string
  acabamento: string
}

interface FormState {
  responsavel: string
  whatsapp: boolean
  cliente: string
}

/* ─── Helpers ────────────────────────────────────────────── */
let nextId = 1
function newAmbiente(primeiroModelo = ''): Ambiente {
  return {
    id: nextId++,
    ambiente: '',
    modelo: primeiroModelo,
    tecido: '',
    largura: '',
    altura: '',
    quantidade: '1',
    cor_ferragem: '',
    acabamento: '',
  }
}

const INITIAL_FORM: FormState = {
  responsavel: RESPONSAVEIS[0],
  whatsapp: false,
  cliente: '',
}

/* ─── Component ──────────────────────────────────────────── */
export default function TabCotacao() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [ambientes, setAmbientes] = useState<Ambiente[]>([newAmbiente()])
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  const {
    data: catalogoData,
    isLoading: catalogoLoading,
    isError: catalogoError,
    refetch: catalogoRefetch,
  } = useModelosTecidos()

  const modelos = catalogoData?.modelos ?? []
  const tecidosPorModelo = catalogoData?.tecidosPorModelo ?? {}

  // quando o catálogo carrega pela primeira vez, inicializa o modelo do primeiro ambiente
  const primeiroModelo = modelos[0] ?? ''

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  function setAmbienteField(id: number, key: keyof Omit<Ambiente, 'id'>, value: string) {
    setAmbientes((prev) => prev.map((a) => (a.id === id ? { ...a, [key]: value } : a)))
  }
  function setModelo(id: number, modelo: string) {
    // ao trocar modelo, reseta tecido pois as opções mudam
    setAmbientes((prev) => prev.map((a) => (a.id === id ? { ...a, modelo, tecido: '' } : a)))
  }
  function addAmbiente() {
    setAmbientes((prev) => [...prev, newAmbiente(primeiroModelo)])
  }
  function removeAmbiente(id: number) { setAmbientes((prev) => prev.filter((a) => a.id !== id)) }

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
        cor_ferragem: a.cor_ferragem.trim(),
        acabamento: a.acabamento.trim(),
      })),
    }

    try {
      const res = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setIsSuccess(true)
      toast('success', 'Orçamento enviado ao n8n com sucesso!')
      setTimeout(() => {
        setIsSuccess(false)
        setForm(INITIAL_FORM)
        setAmbientes([newAmbiente(primeiroModelo)])
      }, 2000)
    } catch (err) {
      console.error('[TabCotacao] submit error:', err)
      toast('error', 'Erro ao enviar. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const totalArea = ambientes.reduce((sum, a) => {
    const l = parseFloat(a.largura) || 0
    const h = parseFloat(a.altura) || 0
    const q = parseInt(a.quantidade) || 1
    return sum + l * h * q
  }, 0)

  return (
    <>
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Calcular Orçamento
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha os dados e envie para o n8n gerar o orçamento automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-emerald-500/30 bg-emerald-500/8 px-3.5 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">n8n conectado</span>
        </div>
      </div>

      {/* Banner de status do catálogo */}
      {catalogoLoading && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">Carregando modelos e tecidos da planilha...</p>
        </div>
      )}
      {catalogoError && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">Erro ao carregar catálogo da planilha. Verifique a API key e tente novamente.</p>
          </div>
          <button
            type="button"
            onClick={() => catalogoRefetch()}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
            Tentar novamente
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">

          {/* ── LEFT ── */}
          <div className="space-y-4">

            {/* Card: Identificação */}
            <FormCard
              icon={<User className="h-4 w-4 text-primary" />}
              title="Identificação"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Responsável — full width */}
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Responsável <Req />
                  </label>
                  <select
                    required
                    value={form.responsavel}
                    onChange={(e) => setField('responsavel', e.target.value)}
                    className={selectClass}
                  >
                    {RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Cliente */}
                <div>
                  <label className={labelClass}>
                    Cliente <Req />
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
                    <MessageSquare className="inline h-3 w-3 mr-1 -mt-px" />
                    WhatsApp
                  </label>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={form.whatsapp}
                    onClick={() => setField('whatsapp', !form.whatsapp)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-150',
                      form.whatsapp
                        ? 'border-emerald-500/40 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400'
                        : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/40'
                    )}
                  >
                    {/* Custom checkbox */}
                    <span className={cn(
                      'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                      form.whatsapp
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-muted-foreground/30 bg-transparent'
                    )} style={{ width: 18, height: 18 }}>
                      {form.whatsapp && (
                        <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    Enviar pelo WhatsApp
                  </button>
                </div>
              </div>
            </FormCard>

            {/* Cards: Ambientes */}
            {ambientes.map((a, index) => {
              const l = parseFloat(a.largura) || 0
              const h = parseFloat(a.altura) || 0
              const q = parseInt(a.quantidade) || 1
              const area = l * h
              const areaTotal = area * q

              return (
                <FormCard
                  key={a.id}
                  icon={<Home className="h-4 w-4 text-primary" />}
                  title={a.ambiente || (ambientes.length > 1 ? `Ambiente ${index + 1}` : 'Ambiente')}
                  badge={ambientes.length > 1 ? `#${index + 1}` : undefined}
                  onRemove={ambientes.length > 1 ? () => removeAmbiente(a.id) : undefined}
                >
                  <div className="space-y-5">
                    {/* Nome */}
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

                    {/* Sub-section: Produto */}
                    <SubSection icon={<Layers className="h-3.5 w-3.5" />} label="Produto">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Modelo <Req /></label>
                          <select
                            required
                            value={a.modelo}
                            onChange={(e) => setModelo(a.id, e.target.value)}
                            className={selectClass}
                            disabled={catalogoLoading}
                          >
                            {catalogoLoading && <option value="">Carregando...</option>}
                            {!catalogoLoading && modelos.length === 0 && (
                              <option value="">Nenhum modelo encontrado</option>
                            )}
                            {modelos.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Tecido <Req /></label>
                          {(() => {
                            const opcoes = tecidosPorModelo[a.modelo] ?? []
                            return opcoes.length > 0 ? (
                              <select
                                required
                                value={a.tecido}
                                onChange={(e) => setAmbienteField(a.id, 'tecido', e.target.value)}
                                className={selectClass}
                              >
                                <option value="">Selecione o tecido...</option>
                                {opcoes.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                            ) : (
                              <input
                                type="text"
                                required
                                value={a.tecido}
                                onChange={(e) => setAmbienteField(a.id, 'tecido', e.target.value)}
                                className={inputClass}
                                placeholder={catalogoLoading ? 'Aguardando catálogo...' : 'Ex: Blackout, Solar Screen...'}
                              />
                            )
                          })()}
                        </div>
                        <div>
                          <label className={labelClass}>Cor Ferragem</label>
                          <input
                            type="text"
                            value={a.cor_ferragem}
                            onChange={(e) => setAmbienteField(a.id, 'cor_ferragem', e.target.value)}
                            className={inputClass}
                            placeholder="Ex: Branco, Preto..."
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Acabamento</label>
                          <input
                            type="text"
                            value={a.acabamento}
                            onChange={(e) => setAmbienteField(a.id, 'acabamento', e.target.value)}
                            className={inputClass}
                            placeholder="Ex: Bandô, Sem acabamento..."
                          />
                        </div>
                      </div>
                    </SubSection>

                    {/* Sub-section: Medidas */}
                    <SubSection icon={<Ruler className="h-3.5 w-3.5" />} label="Medidas">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={labelClass}>Largura (m) <Req /></label>
                          <input
                            type="number" step="0.01" required
                            value={a.largura}
                            onChange={(e) => setAmbienteField(a.id, 'largura', e.target.value)}
                            className={inputClass}
                            placeholder="2.50"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Altura (m) <Req /></label>
                          <input
                            type="number" step="0.01" required
                            value={a.altura}
                            onChange={(e) => setAmbienteField(a.id, 'altura', e.target.value)}
                            className={inputClass}
                            placeholder="1.80"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Qtd <Req /></label>
                          <input
                            type="number" min="1" required
                            value={a.quantidade}
                            onChange={(e) => setAmbienteField(a.id, 'quantidade', e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      {/* Área ao vivo */}
                      {area > 0 && (
                        <div className="mt-3 flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/15 px-4 py-2.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{a.largura}</span>
                            <span>×</span>
                            <span className="font-medium text-foreground">{a.altura}</span>
                            <span>m</span>
                          </div>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                          <span className="text-xs font-bold text-primary">{area.toFixed(2)} m²</span>
                          {q > 1 && (
                            <>
                              <span className="text-xs text-muted-foreground">× {q}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                              <span className="text-xs font-bold text-primary">{areaTotal.toFixed(2)} m² total</span>
                            </>
                          )}
                        </div>
                      )}
                    </SubSection>
                  </div>
                </FormCard>
              )
            })}

            {/* Add ambiente */}
            <button
              type="button"
              onClick={addAmbiente}
              className="group flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border/60 py-4 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/4 hover:text-primary"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-current transition-all duration-200 group-hover:bg-primary group-hover:border-primary group-hover:text-white">
                <Plus className="h-3.5 w-3.5" />
              </span>
              Adicionar Ambiente
            </button>
          </div>

          {/* ── RIGHT: Sticky summary ── */}
          <div className="space-y-4 xl:sticky xl:top-24 h-fit">

            {/* Resumo card */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="border-b bg-muted/30 px-5 py-4">
                <h3 className="font-display text-base font-semibold">Resumo</h3>
              </div>

              <div className="p-5 space-y-5">
                {/* Identificação */}
                <div className="space-y-2">
                  <SummaryRow label="Responsável" value={form.responsavel} />
                  <SummaryRow label="Cliente" value={form.cliente || '—'} />
                  <SummaryRow
                    label="WhatsApp"
                    value={form.whatsapp ? 'Sim' : 'Não'}
                    valueClass={form.whatsapp ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : undefined}
                  />
                </div>

                <div className="border-t border-dashed" />

                {/* Ambientes */}
                <div className="space-y-3">
                  {ambientes.map((a, index) => (
                    <div key={a.id} className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                      {/* Ambiente header */}
                      <div className="flex items-center gap-2 border-b border-border/40 bg-primary/5 px-3 py-2">
                        <Home className="h-3 w-3 text-primary shrink-0" />
                        <p className="text-xs font-bold text-primary truncate">
                          {a.ambiente || `Ambiente ${index + 1}`}
                        </p>
                      </div>
                      <div className="px-3 py-2.5 space-y-1.5">
                        <SummaryRow label="Modelo" value={a.modelo} small />
                        <SummaryRow label="Tecido" value={a.tecido || '—'} small />
                        <SummaryRow
                          label="Medidas"
                          value={a.largura && a.altura ? `${a.largura}×${a.altura}m` : '—'}
                          small
                        />
                        <SummaryRow label="Qtd" value={a.quantidade ? `${a.quantidade}×` : '—'} small />
                        {a.cor_ferragem && <SummaryRow label="Cor Ferragem" value={a.cor_ferragem} small />}
                        {a.acabamento && <SummaryRow label="Acabamento" value={a.acabamento} small />}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totais */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ambientes</p>
                    <p className="mt-0.5 font-display text-2xl font-bold text-primary">{ambientes.length}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Área Total</p>
                    <p className="mt-0.5 font-display text-lg font-bold text-foreground">
                      {totalArea > 0 ? `${totalArea.toFixed(1)}m²` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit card */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <button
                type="submit"
                disabled={isLoading || isSuccess}
                className={cn(
                  'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold text-white transition-all duration-200',
                  isSuccess ? 'bg-emerald-500' : 'bg-brand-gradient shadow-brand hover:opacity-90 active:scale-[0.98]',
                  (isLoading || isSuccess) && 'cursor-not-allowed opacity-80',
                )}
              >
                {isLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                  : isSuccess
                    ? <><CheckCircle2 className="h-4 w-4" /> Enviado com sucesso!</>
                    : <><Send className="h-4 w-4" /> Enviar para n8n</>
                }
              </button>
              <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
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

/* ─── Sub-components ─────────────────────────────────────── */

function Req() {
  return <span className="text-destructive ml-0.5">*</span>
}

interface FormCardProps {
  icon: React.ReactNode
  title: string
  badge?: string
  onRemove?: () => void
  children: React.ReactNode
}

function FormCard({ icon, title, badge, onRemove, children }: FormCardProps) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/25 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            {icon}
          </div>
          <span className="font-display text-base font-semibold leading-none">{title}</span>
          {badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {badge}
            </span>
          )}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Remover ambiente"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

interface SubSectionProps {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}

function SubSection({ icon, label, children }: SubSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-muted-foreground/60">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">{label}</span>
      </div>
      {children}
    </div>
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
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('truncate text-right font-medium', small ? 'max-w-[55%]' : 'max-w-[60%]', valueClass ?? 'text-foreground')}>
        {value}
      </span>
    </div>
  )
}
