import { useState } from 'react'
import {
  Send, CheckCircle2, Loader2, Plus, Trash2, Home,
  User, Ruler, Layers, MessageSquare, AlertCircle, RefreshCw,
  ChevronRight, Package,
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

const CORES_FERRAGEM = ['Sem', 'Branca', 'Preta']

const ACABAMENTOS = [
  'Sem', 'Bando Branco', 'Bando Preto', 'Kit Box',
  'Cadarço', 'Fita', 'Barra Niveladora',
]

const N8N_WEBHOOK = 'https://n8n-n8n.yjlhot.easypanel.host/webhook/Sombrear_sheet'

/* ─── Style tokens ───────────────────────────────────────── */
const inputCls =
  'w-full rounded-lg border border-border/80 bg-background px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 hover:border-border focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all duration-150'
const selectCls =
  'w-full cursor-pointer rounded-lg border border-border/80 bg-background px-3.5 py-2.5 text-sm text-foreground outline-none hover:border-border focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all duration-150'
const labelCls =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-foreground/70'

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
    cor_ferragem: 'Sem',
    acabamento: 'Sem',
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
  const primeiroModelo = modelos[0] ?? ''

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  function setAmbienteField(id: number, key: keyof Omit<Ambiente, 'id'>, value: string) {
    setAmbientes((prev) => prev.map((a) => (a.id === id ? { ...a, [key]: value } : a)))
  }
  function setModelo(id: number, modelo: string) {
    setAmbientes((prev) => prev.map((a) => (a.id === id ? { ...a, modelo, tecido: '' } : a)))
  }
  function addAmbiente() {
    setAmbientes((prev) => [...prev, newAmbiente(primeiroModelo)])
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
      if (!a.cor_ferragem) return `Cor Ferragem é obrigatória${n}.`
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
      toast('success', 'Orçamento enviado com sucesso!')
      setTimeout(() => {
        setIsSuccess(false)
        setForm(INITIAL_FORM)
        setAmbientes([newAmbiente(primeiroModelo)])
      }, 2500)
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

  const isFormValid = form.cliente.trim().length > 0 && ambientes.every(a =>
    a.largura && a.altura && a.modelo && a.tecido && a.quantidade
  )

  return (
    <>
      {/* ── Page Header ── */}
      <div className="mb-8 flex flex-col items-center text-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Dashboard</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-xs font-medium text-primary">Calcular Orçamento</span>
        </div>
        <div>
          <h2 className="font-gotham text-3xl font-bold tracking-tight text-foreground">
            Novo Orçamento
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha os dados e envie para o n8n gerar automaticamente.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          {catalogoLoading && (
            <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs font-medium text-primary">Carregando catálogo...</span>
            </div>
          )}
          {catalogoError && (
            <button
              type="button"
              onClick={() => catalogoRefetch()}
              className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <AlertCircle className="h-3 w-3" />
              Erro no catálogo
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/8 px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">n8n online</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-4">

            {/* ── SEÇÃO: Dados do Pedido ── */}
            <section>
              <SectionHeader
                step="1"
                icon={<User className="h-3.5 w-3.5" />}
                title="Dados do Pedido"
              />

              <div className="mt-3 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Responsável */}
                    <div>
                      <label className={labelCls}>Responsável <Req /></label>
                      <select
                        required
                        value={form.responsavel}
                        onChange={(e) => setField('responsavel', e.target.value)}
                        className={selectCls}
                      >
                        {RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    {/* Cliente */}
                    <div>
                      <label className={labelCls}>Cliente <Req /></label>
                      <input
                        type="text"
                        required
                        value={form.cliente}
                        onChange={(e) => setField('cliente', e.target.value)}
                        className={inputCls}
                        placeholder="Nome do cliente"
                      />
                    </div>

                    {/* WhatsApp — full width */}
                    <div className="sm:col-span-2">
                      <label className={labelCls}>
                        <MessageSquare className="inline h-3 w-3 mr-1 -mt-px" />
                        Envio
                      </label>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={form.whatsapp}
                        onClick={() => setField('whatsapp', !form.whatsapp)}
                        className={cn(
                          'group flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-200',
                          form.whatsapp
                            ? 'border-emerald-500/50 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400'
                            : 'border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-muted/30'
                        )}
                      >
                        {/* Toggle pill */}
                        <span className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-all duration-200',
                          form.whatsapp ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/30 bg-muted'
                        )}>
                          <span className={cn(
                            'absolute top-0 left-0 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                            form.whatsapp ? 'translate-x-4' : 'translate-x-0'
                          )} />
                        </span>
                        <span>Enviar pelo WhatsApp</span>
                        {form.whatsapp && (
                          <span className="ml-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400">Ativado</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── SEÇÃO: Ambientes ── */}
            <section>
              <SectionHeader
                step="2"
                icon={<Home className="h-3.5 w-3.5" />}
                title="Ambientes"
                badge={ambientes.length > 1 ? `${ambientes.length} adicionados` : undefined}
              />

              <div className="mt-3 space-y-3">
                {ambientes.map((a, index) => {
                  const l = parseFloat(a.largura) || 0
                  const h = parseFloat(a.altura) || 0
                  const q = parseInt(a.quantidade) || 1
                  const area = l * h
                  const areaTotal = area * q
                  const isFilled = !!(a.largura && a.altura && a.modelo && a.tecido)

                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-200',
                        isFilled ? 'border-primary/20' : 'border-border/60'
                      )}
                    >
                      {/* Card header */}
                      <div className={cn(
                        'flex items-center justify-between px-5 py-3.5 border-b',
                        isFilled ? 'bg-primary/[0.03] border-primary/15' : 'bg-muted/20 border-border/40'
                      )}>
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                            isFilled
                              ? 'bg-primary text-white'
                              : 'bg-muted-foreground/15 text-muted-foreground'
                          )}>
                            {index + 1}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {a.ambiente || (ambientes.length > 1 ? `Ambiente ${index + 1}` : 'Ambiente')}
                          </span>
                          {isFilled && area > 0 && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              {areaTotal.toFixed(1)} m²
                            </span>
                          )}
                        </div>
                        {ambientes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAmbiente(a.id)}
                            className="rounded-md p-1.5 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
                            title="Remover ambiente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="p-5 space-y-5">
                        {/* Nome do ambiente */}
                        <div>
                          <label className={labelCls}>Nome do Ambiente</label>
                          <input
                            type="text"
                            value={a.ambiente}
                            onChange={(e) => setAmbienteField(a.id, 'ambiente', e.target.value)}
                            className={inputCls}
                            placeholder="Sala, Quarto, Escritório..."
                          />
                        </div>

                        {/* Grupo: Produto */}
                        <FieldGroup icon={<Layers className="h-3 w-3" />} label="Produto">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className={labelCls}>Modelo <Req /></label>
                              <select
                                required
                                value={a.modelo}
                                onChange={(e) => setModelo(a.id, e.target.value)}
                                className={selectCls}
                                disabled={catalogoLoading}
                              >
                                {catalogoLoading
                                  ? <option value="">Carregando catálogo...</option>
                                  : modelos.length === 0
                                    ? <option value="">Nenhum modelo encontrado</option>
                                    : <>
                                        <option value="">Selecione o modelo...</option>
                                        {modelos.map((m) => <option key={m} value={m}>{m}</option>)}
                                      </>
                                }
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Tecido <Req /></label>
                              {(() => {
                                const opcoes = tecidosPorModelo[a.modelo] ?? []
                                return opcoes.length > 0 ? (
                                  <select
                                    required
                                    value={a.tecido}
                                    onChange={(e) => setAmbienteField(a.id, 'tecido', e.target.value)}
                                    className={selectCls}
                                  >
                                    <option value="">Selecione...</option>
                                    {opcoes.map((t) => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    required
                                    value={a.tecido}
                                    onChange={(e) => setAmbienteField(a.id, 'tecido', e.target.value)}
                                    className={inputCls}
                                    placeholder={catalogoLoading ? 'Aguardando...' : 'Ex: Blackout, Solar Screen...'}
                                  />
                                )
                              })()}
                            </div>
                            <div>
                              <label className={labelCls}>Cor Ferragem <Req /></label>
                              <select
                                required
                                value={a.cor_ferragem}
                                onChange={(e) => setAmbienteField(a.id, 'cor_ferragem', e.target.value)}
                                className={selectCls}
                              >
                                {CORES_FERRAGEM.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Acabamento</label>
                              <select
                                value={a.acabamento}
                                onChange={(e) => setAmbienteField(a.id, 'acabamento', e.target.value)}
                                className={selectCls}
                              >
                                {ACABAMENTOS.map((ac) => <option key={ac} value={ac}>{ac}</option>)}
                              </select>
                            </div>
                          </div>
                        </FieldGroup>

                        {/* Grupo: Medidas */}
                        <FieldGroup icon={<Ruler className="h-3 w-3" />} label="Medidas">
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className={labelCls}>Largura (m) <Req /></label>
                              <input
                                type="number" step="0.01" min="0" required
                                value={a.largura}
                                onChange={(e) => setAmbienteField(a.id, 'largura', e.target.value)}
                                className={inputCls}
                                placeholder="2.50"
                              />
                            </div>
                            <div>
                              <label className={labelCls}>Altura (m) <Req /></label>
                              <input
                                type="number" step="0.01" min="0" required
                                value={a.altura}
                                onChange={(e) => setAmbienteField(a.id, 'altura', e.target.value)}
                                className={inputCls}
                                placeholder="1.80"
                              />
                            </div>
                            <div>
                              <label className={labelCls}>Qtd <Req /></label>
                              <input
                                type="number" min="1" required
                                value={a.quantidade}
                                onChange={(e) => setAmbienteField(a.id, 'quantidade', e.target.value)}
                                className={inputCls}
                              />
                            </div>
                          </div>

                          {/* Área calculada */}
                          {area > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {a.largura} × {a.altura} m =
                              </span>
                              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                                {area.toFixed(2)} m²
                              </span>
                              {q > 1 && (
                                <>
                                  <span className="text-xs text-muted-foreground">× {q} unid =</span>
                                  <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                                    {areaTotal.toFixed(2)} m² total
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </FieldGroup>
                      </div>
                    </div>
                  )
                })}

                {/* Add ambiente */}
                <button
                  type="button"
                  onClick={addAmbiente}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/50 py-3.5 text-sm font-medium text-muted-foreground/70 transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary"
                >
                  <span className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full border-2 border-current transition-all duration-200',
                    'group-hover:bg-primary group-hover:border-primary group-hover:text-white'
                  )}>
                    <Plus className="h-3 w-3" />
                  </span>
                  Adicionar Ambiente
                </button>
              </div>
            </section>
          </div>

          {/* ── RIGHT COLUMN: Summary + Submit ── */}
          <div className="xl:sticky xl:top-24 h-fit space-y-3">

            {/* Resumo */}
            <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Resumo do Pedido</span>
                </div>
                {isFormValid && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                    <svg viewBox="0 0 10 8" fill="none" className="h-2 w-2">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>

              <div className="p-4 space-y-4">

                {/* Cliente destaque */}
                {form.cliente ? (
                  <div className="rounded-lg bg-primary/5 border border-primary/15 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">Cliente</p>
                    <p className="text-base font-bold text-foreground leading-tight">{form.cliente}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">via {form.responsavel}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/50 px-4 py-3">
                    <p className="text-xs text-muted-foreground italic">Aguardando dados do cliente...</p>
                  </div>
                )}

                {/* WhatsApp badge */}
                {form.whatsapp && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Envio via WhatsApp ativado</span>
                  </div>
                )}

                <div className="border-t border-border/40" />

                {/* Lista de ambientes */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-foreground/60">
                    Ambientes ({ambientes.length})
                  </p>
                  {ambientes.map((a, index) => {
                    const l = parseFloat(a.largura) || 0
                    const h = parseFloat(a.altura) || 0
                    const q = parseInt(a.quantidade) || 1
                    const area = l * h * q
                    const hasData = !!(a.largura && a.altura && a.modelo && a.tecido)

                    return (
                      <div
                        key={a.id}
                        className={cn(
                          'rounded-lg border overflow-hidden',
                          hasData ? 'border-border/50' : 'border-border/30 opacity-60'
                        )}
                      >
                        <div className={cn(
                          'flex items-center justify-between px-3 py-2',
                          hasData ? 'bg-muted/30' : 'bg-muted/15'
                        )}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn(
                              'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                              hasData ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                            )} style={{ width: 18, height: 18 }}>
                              {index + 1}
                            </span>
                            <span className="text-xs font-semibold truncate">
                              {a.ambiente || `Ambiente ${index + 1}`}
                            </span>
                          </div>
                          {area > 0 && (
                            <span className="text-[10px] font-bold text-primary shrink-0 ml-2">{area.toFixed(1)}m²</span>
                          )}
                        </div>
                        {hasData && (
                          <div className="px-3 py-2 space-y-1 bg-background/50">
                            <MiniRow k="Modelo" v={a.modelo} />
                            <MiniRow k="Tecido" v={a.tecido} />
                            <MiniRow k="Medidas" v={`${a.largura}×${a.altura}m × ${a.quantidade}`} />
                            {a.cor_ferragem !== 'Sem' && <MiniRow k="Ferragem" v={a.cor_ferragem} />}
                            {a.acabamento !== 'Sem' && <MiniRow k="Acabamento" v={a.acabamento} />}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Totais */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-primary/80">Ambientes</p>
                    <p className="font-display text-2xl font-bold text-primary leading-tight">{ambientes.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground dark:text-foreground/60">Área Total</p>
                    <p className="font-display text-lg font-bold text-foreground leading-tight mt-0.5">
                      {totalArea > 0 ? `${totalArea.toFixed(1)}` : '—'}
                      {totalArea > 0 && <span className="text-sm font-medium text-muted-foreground"> m²</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <button
                type="submit"
                disabled={isLoading || isSuccess}
                className={cn(
                  'w-full flex items-center justify-center gap-2.5 rounded-xl px-4 py-4 text-sm font-bold text-white transition-all duration-200 shadow-sm',
                  isSuccess
                    ? 'bg-emerald-500 cursor-default'
                    : isLoading
                      ? 'bg-primary/70 cursor-not-allowed'
                      : 'bg-brand-gradient shadow-brand hover:opacity-95 hover:shadow-md active:scale-[0.98]',
                )}
              >
                {isLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                  : isSuccess
                    ? <><CheckCircle2 className="h-4 w-4" /> Orçamento enviado!</>
                    : <><Send className="h-4 w-4" /> Gerar Orçamento</>
                }
              </button>
              <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
                Campos marcados com <span className="text-destructive font-bold">*</span> são obrigatórios
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

interface SectionHeaderProps {
  step: string
  icon: React.ReactNode
  title: string
  badge?: string
}

function SectionHeader({ step, icon, title, badge }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
        {step}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground dark:text-foreground/60">{icon}</span>
        <span className="text-sm font-bold text-foreground dark:text-foreground">{title}</span>
        {badge && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {badge}
          </span>
        )}
      </div>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  )
}

interface FieldGroupProps {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}

function FieldGroup({ icon, label, children }: FieldGroupProps) {
  return (
    <div className="rounded-lg bg-muted/20 border border-border/40 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-border/30 bg-muted/30">
        <span className="text-muted-foreground dark:text-foreground/50">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground dark:text-foreground/60">{label}</span>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  )
}

function MiniRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-2 text-[11px]">
      <span className="shrink-0 text-muted-foreground dark:text-foreground/60">{k}</span>
      <span className="truncate text-right font-medium text-foreground max-w-[55%]">{v}</span>
    </div>
  )
}
