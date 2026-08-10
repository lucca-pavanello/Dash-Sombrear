import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Send, CheckCircle2, Loader2, Plus, Trash2, Home,
  User, Ruler, Layers, MessageSquare, AlertCircle, RefreshCw,
  ChevronRight, ChevronDown, Package, PenLine, Copy, Tag, History,
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import Toaster from '@/components/ui/Toaster'
import { useModelosTecidos } from '@/hooks/useModelosTecidos'
import { useHistoricoCliente, resumoHistorico } from '@/hooks/useHistoricoCliente'
import { SUGESTOES_AMBIENTE, DEFAULT_RESPONSAVEL } from '@/lib/constants'
import { useResponsaveis } from '@/hooks/useResponsaveis'
import { supabase } from '@/lib/supabase'

/* ─── Constants ─────────────────────────────────────────── */
const CORES_FERRAGEM = ['Sem', 'Branca', 'Preta']
const ACABAMENTOS = [
  'Sem', 'Bando Branco', 'Bando Preto', 'Kit Box',
  'Cadarço', 'Fita', 'Barra Niveladora',
]
const MODEL_PH50 = 'PH_50'

/**
 * A loja só tem ferragem preta no tubo 38. Acima de 2,51m de largura (ou 3,01m
 * de altura) a rolô exige tubo 50, que só existe em branca — avisamos aqui, na
 * hora de digitar, em vez de deixar o orçamento quebrar no agente.
 */
function pretaIndisponivel(modelo: string, cor: string, largura: string, altura: string): boolean {
  if (!/rolo/i.test(modelo) || !/pret/i.test(cor)) return false
  const l = parseFloat(largura) || 0
  const a = parseFloat(altura) || 0
  return l >= 2.51 || a >= 3.01
}
const PH50_ACABAMENTOS = ['Cadarço', 'Fita']
const DRAFT_KEY = 'sombrear-cotacao-draft-v3'
const MAIS_BARATO = 'MAIS BARATO (a partir de)'
/**
 * Categorias do "mais barato" (economico_tipo). Vêm do banco (view
 * precos_tipos_tecido), então uma categoria nova criada pela loja aparece
 * sozinha aqui — sem depender de alguém lembrar de mexer no código.
 */
const ROTULO_TIPO: Record<string, string> = {
  blackout: 'Blackout', tela_solar: 'Tela Solar', decorativo: 'Decorativo',
}
const rotularTipo = (t: string) =>
  ROTULO_TIPO[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const normTecido = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').trim()
const fmtDataBR = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}` : iso
}

/* ─── Style tokens ───────────────────────────────────────── */
const inputCls =
  'w-full rounded-lg border border-border bg-background px-3.5 py-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50 hover:border-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/30'
const labelCls =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-foreground/50 dark:text-foreground/55'

/* ─── Types ──────────────────────────────────────────────── */
interface Medida {
  id: number
  largura: string
  altura: string
  quantidade: string
}

interface Persiana {
  id: number
  modelo: string
  tecido: string
  cor_ferragem: string
  acabamento: string
  economico_tipo: string
  medidas: Medida[]
}

interface Ambiente {
  id: number
  ambiente: string
  persianas: Persiana[]
  collapsed: boolean
}

interface FormState {
  responsavel: string
  whatsapp: boolean
  cliente: string
}

/* ─── Helpers ────────────────────────────────────────────── */
function newMedida(nextIdRef: React.MutableRefObject<number>): Medida {
  return { id: nextIdRef.current++, largura: '', altura: '', quantidade: '1' }
}

function newPersiana(nextIdRef: React.MutableRefObject<number>): Persiana {
  return { id: nextIdRef.current++, modelo: '', tecido: '', cor_ferragem: 'Sem', acabamento: 'Sem', economico_tipo: 'Qualquer', medidas: [newMedida(nextIdRef)] }
}

function copyPersiana(p: Persiana, nextIdRef: React.MutableRefObject<number>): Persiana {
  return { ...p, id: nextIdRef.current++, medidas: [newMedida(nextIdRef)] }
}

function newAmbiente(nextIdRef: React.MutableRefObject<number>): Ambiente {
  return { id: nextIdRef.current++, ambiente: '', persianas: [newPersiana(nextIdRef)], collapsed: false }
}

const medidaFilled = (m: Medida) =>
  parseFloat(m.largura) > 0 && parseFloat(m.altura) > 0 && parseInt(m.quantidade) >= 1

const persianaFilled = (p: Persiana) =>
  !!(p.modelo && p.tecido && p.medidas.length > 0 && p.medidas.every(medidaFilled) &&
    (p.modelo !== MODEL_PH50 || PH50_ACABAMENTOS.includes(p.acabamento)))

function ambienteFilled(a: Ambiente) {
  return a.persianas.length > 0 && a.persianas.every(persianaFilled)
}

const INITIAL_FORM: FormState = { responsavel: DEFAULT_RESPONSAVEL, whatsapp: false, cliente: '' }

function loadDraft(): { form: FormState; ambientes: Ambiente[] } | null {
  try {
    const s = localStorage.getItem(DRAFT_KEY)
    if (!s) return null
    const draft = JSON.parse(s)
    if (!draft?.ambientes?.[0]?.persianas) return null
    // Force expand all ambientes on draft load
    if (draft?.ambientes) {
      draft.ambientes = draft.ambientes.map((a: Ambiente) => ({
        ...a,
        collapsed: false,
        persianas: a.persianas.map(p => ({ ...p, economico_tipo: p.economico_tipo ?? 'Qualquer' })),
      }))
    }
    // Aceita qualquer nome não-vazio — a lista agora é dinâmica (useResponsaveis)
    if (!draft.form.responsavel) {
      draft.form.responsavel = DEFAULT_RESPONSAVEL
    }
    return draft
  } catch { return null }
}

/* ─── Component ──────────────────────────────────────────── */
export default function TabCotacao() {
  const responsaveis = useResponsaveis()
  const nextIdRef = useRef(1)
  const notifyChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const notifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Limpa canal de notificação ao desmontar
  useEffect(() => {
    return () => {
      if (notifyChannelRef.current) supabase.removeChannel(notifyChannelRef.current)
      if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current)
    }
  }, [])
  const draftRef = useRef(loadDraft())
  const [form, setForm] = useState<FormState>(() => draftRef.current?.form ?? INITIAL_FORM)
  const [ambientes, setAmbientes] = useState<Ambiente[]>(() => draftRef.current?.ambientes ?? [newAmbiente(nextIdRef)])
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [resetCountdown, setResetCountdown] = useState<number | null>(null)
  const resetTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const newAmbienteRef = useRef<HTMLDivElement>(null)
  const newPersianaRefs = useRef<Record<number, HTMLDivElement | null>>({})
  // Sync nextIdRef to max id in loaded draft to avoid id collisions
  useEffect(() => {
    const allIds = ambientes.flatMap(a => [
      a.id,
      ...a.persianas.flatMap(p => [p.id, ...p.medidas.map(m => m.id)]),
    ])
    if (allIds.length > 0) nextIdRef.current = Math.max(...allIds) + 1
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const { toasts, toast, dismiss } = useToast()

  const { data: catalogoData, isLoading: catalogoLoading, isError: catalogoError, refetch: catalogoRefetch } = useModelosTecidos()
  const modelos = catalogoData?.modelos ?? []
  const tecidosPorModelo = catalogoData?.tecidosPorModelo ?? {}

  /* ── Promoções vigentes (view segura, sem preços) ── */
  const { data: promoData } = useQuery({
    queryKey: ['promocoes-ativas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('precos_promocoes_ativas').select('nome, desconto_pct, promo_fim')
      if (error) throw error
      return data as { nome: string; desconto_pct: number; promo_fim: string }[]
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const promoPorTecido = useMemo(() => {
    const mapa = new Map<string, { desconto_pct: number; promo_fim: string }>()
    for (const p of promoData ?? []) mapa.set(normTecido(p.nome), p)
    return mapa
  }, [promoData])

  const { data: historicoCliente } = useHistoricoCliente(form.cliente)

  /* categorias de tecido, do banco — alimentam o seletor do "mais barato" */
  const { data: tiposTecido } = useQuery({
    queryKey: ['tipos-tecido'],
    queryFn: async () => {
      const { data, error } = await supabase.from('precos_tipos_tecido').select('tipo, tecidos')
      if (error) throw error
      return data as { tipo: string; tecidos: number }[]
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const opcoesEconomico = useMemo(() => ([
    { value: 'Qualquer', label: 'Qualquer tecido' },
    ...(tiposTecido ?? []).map(t => ({
      value: t.tipo,
      label: `${rotularTipo(t.tipo)} (${t.tecidos} tecido${t.tecidos > 1 ? 's' : ''})`,
    })),
  ]), [tiposTecido])

  /* ── Auto-save draft ── */
  useEffect(() => {
    if (isSuccess) return
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, ambientes }))
  }, [form, ambientes, isSuccess])

  /* ── Cleanup timer ── */
  useEffect(() => {
    return () => { if (resetTimerRef.current) clearInterval(resetTimerRef.current) }
  }, [])

  /* ── State helpers ── */
  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setPersianaField(ambienteId: number, persianaId: number, key: keyof Omit<Persiana, 'id' | 'medidas'>, value: string) {
    setAmbientes(prev => prev.map(a =>
      a.id === ambienteId
        ? { ...a, persianas: a.persianas.map(p => p.id === persianaId ? { ...p, [key]: value } : p) }
        : a
    ))
  }

  function setPersianaModelo(ambienteId: number, persianaId: number, modelo: string) {
    setAmbientes(prev => prev.map(a =>
      a.id === ambienteId
        ? {
            ...a, persianas: a.persianas.map(p => {
              if (p.id !== persianaId) return p
              const acabamento = modelo === MODEL_PH50 && !PH50_ACABAMENTOS.includes(p.acabamento) ? '' : p.acabamento
              return { ...p, modelo, tecido: '', acabamento }
            })
          }
        : a
    ))
  }

  function setMedidaField(ambienteId: number, persianaId: number, medidaId: number, key: keyof Omit<Medida, 'id'>, value: string) {
    setAmbientes(prev => prev.map(a =>
      a.id === ambienteId
        ? {
            ...a, persianas: a.persianas.map(p =>
              p.id === persianaId
                ? { ...p, medidas: p.medidas.map(m => m.id === medidaId ? { ...m, [key]: value } : m) }
                : p
            )
          }
        : a
    ))
  }

  function addMedida(ambienteId: number, persianaId: number) {
    const nova = newMedida(nextIdRef)
    setAmbientes(prev => prev.map(a =>
      a.id === ambienteId
        ? { ...a, persianas: a.persianas.map(p => p.id === persianaId ? { ...p, medidas: [...p.medidas, nova] } : p) }
        : a
    ))
  }

  function removeMedida(ambienteId: number, persianaId: number, medidaId: number) {
    setAmbientes(prev => prev.map(a =>
      a.id === ambienteId
        ? {
            ...a, persianas: a.persianas.map(p =>
              p.id === persianaId
                ? { ...p, medidas: p.medidas.filter(m => m.id !== medidaId) }
                : p
            )
          }
        : a
    ))
  }

  function setAmbienteNome(ambienteId: number, nome: string) {
    setAmbientes(prev => prev.map(a => a.id === ambienteId ? { ...a, ambiente: nome } : a))
  }

  function toggleCollapse(ambienteId: number) {
    setAmbientes(prev => prev.map(a => a.id === ambienteId ? { ...a, collapsed: !a.collapsed } : a))
  }

  function addAmbiente() {
    const novo = newAmbiente(nextIdRef)
    setAmbientes(prev => {
      // Colapsa ambientes preenchidos ao adicionar novo
      const updated = prev.map(a => ambienteFilled(a) ? { ...a, collapsed: true } : a)
      return [...updated, novo]
    })
    requestAnimationFrame(() => {
      newAmbienteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function removeAmbiente(id: number) {
    setAmbientes(prev => prev.filter(a => a.id !== id))
  }

  function addPersiana(ambienteId: number) {
    setAmbientes(prev => prev.map(a => {
      if (a.id !== ambienteId) return a
      const lastP = a.persianas[a.persianas.length - 1]
      const novo = lastP ? copyPersiana(lastP, nextIdRef) : newPersiana(nextIdRef)
      requestAnimationFrame(() => {
        newPersianaRefs.current[novo.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return { ...a, persianas: [...a.persianas, novo] }
    }))
  }

  function removePersiana(ambienteId: number, persianaId: number) {
    delete newPersianaRefs.current[persianaId]
    setAmbientes(prev => prev.map(a =>
      a.id === ambienteId
        ? { ...a, persianas: a.persianas.filter(p => p.id !== persianaId) }
        : a
    ))
  }

  function startResetCountdown() {
    if (resetTimerRef.current) {
      clearInterval(resetTimerRef.current)
      resetTimerRef.current = null
    }
    setResetCountdown(3)
    resetTimerRef.current = setInterval(() => {
      setResetCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (resetTimerRef.current) clearInterval(resetTimerRef.current)
          setIsSuccess(false)
          setForm(INITIAL_FORM)
          setAmbientes([newAmbiente(nextIdRef)])
          localStorage.removeItem(DRAFT_KEY)
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  function cancelReset() {
    if (resetTimerRef.current) clearInterval(resetTimerRef.current)
    setResetCountdown(null)
    setIsSuccess(false)
  }

  function validate(): string | null {
    const validDecimal = /^\d+(\.\d+)?$/
    if (!form.responsavel) return 'Responsável é obrigatório.'
    if (!form.cliente.trim()) return 'Cliente é obrigatório.'
    for (let i = 0; i < ambientes.length; i++) {
      const a = ambientes[i]
      const nA = ambientes.length > 1 ? ` (Amb. ${i + 1})` : ''
      if (!a.ambiente.trim()) return `Nome do ambiente é obrigatório${nA || ' (ex.: Sala, Quarto, Escritório)'}.`
      if (a.persianas.length === 0) return `Adicione ao menos uma persiana no ambiente ${a.ambiente || i + 1}.`
      for (let j = 0; j < a.persianas.length; j++) {
        const p = a.persianas[j]
        const nP = a.persianas.length > 1 ? ` — P${j + 1}` : ''
        const n = `${nA}${nP}`
        if (!p.modelo) return `Modelo é obrigatório${n}.`
        for (const m of p.medidas) {
          if (pretaIndisponivel(p.modelo, p.cor_ferragem, m.largura, m.altura)) {
            return `Ferragem preta não existe em ${m.largura}×${m.altura}m${n} — nessa medida o tubo é 50mm, que só tem em branca. Troque a ferragem para Branca ou ajuste a medida.`
          }
        }
        if (p.modelo === MODEL_PH50 && !PH50_ACABAMENTOS.includes(p.acabamento))
          return `Modelo ${MODEL_PH50} requer acabamento Cadarço ou Fita${n}.`
        if (!p.tecido.trim()) return `Tecido é obrigatório${n}.`
        if (p.medidas.length === 0) return `Adicione ao menos uma medida${n}.`
        for (let k = 0; k < p.medidas.length; k++) {
          const m = p.medidas[k]
          const nM = p.medidas.length > 1 ? ` — Medida ${k + 1}` : ''
          const nm = `${n}${nM}`
          if (!m.largura || !validDecimal.test(m.largura.trim()) || parseFloat(m.largura) <= 0) return `Largura inválida${nm}.`
          if (!m.altura || !validDecimal.test(m.altura.trim()) || parseFloat(m.altura) <= 0) return `Altura inválida${nm}.`
          if (!m.quantidade || parseInt(m.quantidade) < 1) return `Quantidade inválida${nm}.`
        }
      }
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const error = validate()
    if (error) { toast('error', error); return }

    setIsLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id ?? null
    const payload = {
      responsavel: form.responsavel,
      whatsapp: form.whatsapp,
      cliente: form.cliente.trim(),
      fonte: 'planilha',
      user_id: userId,
      ambientes: ambientes.map((a, aIdx) => ({
        ambiente: a.ambiente.trim(),
        persianas: a.persianas.flatMap((p, pIdx) =>
          p.medidas.map(m => ({
            modelo: p.modelo,
            tecido: p.tecido.trim(),
            largura: parseFloat(m.largura),
            altura: parseFloat(m.altura),
            quantidade: parseInt(m.quantidade) || 1,
            cor_ferragem: p.cor_ferragem.trim(),
            acabamento: p.acabamento.trim(),
            persiana_grupo: `a${aIdx}p${pIdx}`,
            economico_tipo: p.tecido === MAIS_BARATO && p.economico_tipo !== 'Qualquer'
              ? p.economico_tipo
              : null,
          }))
        ),
      })),
    }

    try {
      const { error: fnError } = await supabase.functions.invoke('n8n-cotacao', { body: payload })
      if (fnError) {
        // Tenta extrair mensagem detalhada do body da Edge Function
        let detail = fnError.message
        try {
          const ctx = (fnError as { context?: Response }).context
          if (ctx) { const j = await ctx.json(); detail = j?.error ?? detail }
        } catch { /* noop */ }
        throw new Error(detail)
      }
      setIsSuccess(true)
      toast('success', 'Orçamento enviado! Aguarde o resultado…')
      startResetCountdown()

      // Escuta o Supabase para notificar quando o n8n terminar de processar
      if (userId) {
        const clienteNome = form.cliente.trim()
        const isWhatsapp = form.whatsapp
        if (notifyChannelRef.current) supabase.removeChannel(notifyChannelRef.current)
        if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current)

        const ch = supabase
          .channel('cotacao-notify-' + Date.now())
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'orcamentos',
            filter: `user_id=eq.${userId}`,
          }, (evt) => {
            const row = evt.new as Record<string, unknown>
            if (String(row.cliente ?? '').toLowerCase() === clienteNome.toLowerCase()) {
              const msg = isWhatsapp
                ? `Orçamento de ${clienteNome} enviado via WhatsApp ✓`
                : `Orçamento de ${clienteNome} calculado ✓`
              toast('success', msg, { duration: 8000 })
              supabase.removeChannel(ch)
              notifyChannelRef.current = null
            }
          })
          .subscribe()

        notifyChannelRef.current = ch
        // Auto-cleanup após 10 minutos se o n8n demorar demais
        notifyTimeoutRef.current = setTimeout(() => {
          supabase.removeChannel(ch)
          notifyChannelRef.current = null
        }, 600000)
      }
    } catch (err) {
      console.error('[TabCotacao] submit error:', err)
      const msg = err instanceof Error ? err.message : 'Erro ao enviar. Tente novamente.'
      toast('error', msg)
    } finally {
      setIsLoading(false)
    }
  }

  const totalArea = ambientes.reduce((sum, a) =>
    sum + a.persianas.reduce((s, p) =>
      s + p.medidas.reduce((ms, m) => ms + (parseFloat(m.largura) || 0) * (parseFloat(m.altura) || 0) * (parseInt(m.quantidade) || 1), 0), 0), 0)
  const totalPersianas = ambientes.reduce((sum, a) => sum + a.persianas.length, 0)
  const isFormValid = form.cliente.trim().length > 0 && ambientes.every(a => a.persianas.every(persianaFilled))
  const sec1Done = !!(form.responsavel && form.cliente.trim())

  return (
    <>
      {/* ── Page Header ── */}
      <div className="mb-6 flex flex-col items-center text-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground/40">Dashboard</span>
          <ChevronRight className="h-3 w-3 text-foreground/30" />
          <span className="text-xs font-medium text-primary">Calcular Orçamento</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Novo Orçamento</h2>
          <p className="mt-0.5 text-sm text-foreground/50">Preencha os dados e envie para gerar o orçamento.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {catalogoLoading && (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs font-medium text-primary">Carregando catálogo…</span>
            </div>
          )}
          {catalogoError && (
            <button type="button" onClick={() => catalogoRefetch()}
              className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <AlertCircle className="h-3 w-3" />Erro no catálogo — Tentar novamente<RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px] xl:gap-5">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-4">

            {/* SEÇÃO 1: Dados do Pedido */}
            <section>
              <SectionHeader
                step="1" icon={<User className="h-3.5 w-3.5" />} title="Dados do Pedido"
                done={sec1Done}
              />
              <div className="mt-3 rounded-xl border border-border bg-card shadow-sm">
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Responsável <Req /></label>
                      <CustomSelect value={form.responsavel} onChange={v => setField('responsavel', v)} options={responsaveis} />
                    </div>
                    <div>
                      <label className={labelCls}>Cliente <Req /></label>
                      <input
                        type="text" required value={form.cliente}
                        onChange={e => setField('cliente', e.target.value)}
                        className={inputCls} placeholder="Nome do cliente" autoComplete="off"
                      />
                      {historicoCliente && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                          <History className="h-3 w-3 shrink-0" />
                          Cliente conhecido: {resumoHistorico(historicoCliente)}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>
                        <MessageSquare className="inline h-3 w-3 mr-1 -mt-px" />
                        Envio via WhatsApp
                      </label>
                      <button
                        type="button" role="checkbox" aria-checked={form.whatsapp}
                        onClick={() => setField('whatsapp', !form.whatsapp)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all duration-200 touch-manipulation',
                          form.whatsapp
                            ? 'border-emerald-500/50 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300'
                            : 'border-border bg-background text-foreground/60 hover:border-muted-foreground/40 hover:bg-muted/30'
                        )}
                      >
                        <span className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-all duration-200', form.whatsapp ? 'border-emerald-500 bg-emerald-500' : 'border-foreground/20 bg-muted')}>
                          <span className={cn('absolute top-0 left-0 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200', form.whatsapp ? 'translate-x-4' : 'translate-x-0')} />
                        </span>
                        <span>Enviar pelo WhatsApp</span>
                        {form.whatsapp && <span className="ml-auto text-xs font-bold text-emerald-600 dark:text-emerald-400">Ativado</span>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SEÇÃO 2: Ambientes */}
            <section>
              <SectionHeader
                step="2" icon={<Home className="h-3.5 w-3.5" />} title="Ambientes"
                badge={ambientes.length > 1 ? `${ambientes.length} ambientes` : undefined}
                done={ambientes.length > 0 && ambientes.every(ambienteFilled)}
              />

              <div className="mt-3 space-y-3">
                {ambientes.map((a, ambienteIndex) => {
                  const totalAmbienteArea = a.persianas.reduce((s, p) =>
                    s + p.medidas.reduce((ms, m) => ms + (parseFloat(m.largura) || 0) * (parseFloat(m.altura) || 0) * (parseInt(m.quantidade) || 1), 0), 0)
                  const isFilled = ambienteFilled(a)
                  const isCollapsed = a.collapsed && isFilled
                  const isLast = ambienteIndex === ambientes.length - 1
                  const refProp = isLast ? { ref: newAmbienteRef } : {}

                  return (
                    <div key={a.id} {...refProp}
                      className={cn(
                        'rounded-xl border bg-card shadow-sm transition-all duration-200',
                        isFilled ? 'border-primary/25' : 'border-border'
                      )}
                    >
                      {/* Ambiente header */}
                      <div
                        className={cn(
                          'flex items-center justify-between px-4 py-3 sm:px-5',
                          isCollapsed ? 'rounded-xl' : 'rounded-t-xl border-b',
                          isFilled ? 'bg-primary/[0.04] border-primary/15' : 'bg-muted/20 border-border/60'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleCollapse(a.id)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                        >
                          <span className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
                            isFilled ? 'bg-primary text-white' : 'bg-foreground/10 text-foreground/50'
                          )}>
                            {isFilled ? <CheckCircle2 className="h-3.5 w-3.5" /> : ambienteIndex + 1}
                          </span>
                          <span className="text-sm font-semibold text-foreground truncate">
                            {a.ambiente || (ambientes.length > 1 ? `Ambiente ${ambienteIndex + 1}` : 'Ambiente')}
                          </span>
                          {isCollapsed && (
                            <span className="hidden sm:flex items-center gap-1.5 flex-wrap">
                              {a.persianas.map((p, pi) => {
                                const medidasPreenchidas = p.medidas.filter(m => parseFloat(m.largura) > 0 && parseFloat(m.altura) > 0)
                                return (
                                  <span key={p.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {p.modelo}{a.persianas.length > 1 ? ` P${pi + 1}` : ''}
                                    {medidasPreenchidas.map(m => ` · ${m.largura}×${m.altura}m`).join('')}
                                  </span>
                                )
                              })}
                            </span>
                          )}
                          {totalAmbienteArea > 0 && !isCollapsed && (
                            <span className="hidden xs:inline-flex shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              {totalAmbienteArea.toFixed(2)} m²
                            </span>
                          )}
                          {a.persianas.length > 1 && !isCollapsed && (
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {a.persianas.length} persianas
                            </span>
                          )}
                        </button>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {isFilled && (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(a.id)}
                              className="rounded-lg p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
                              title={isCollapsed ? 'Expandir' : 'Recolher'}
                            >
                              <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', !isCollapsed && 'rotate-180')} />
                            </button>
                          )}
                          {ambientes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAmbiente(a.id)}
                              className="rounded-lg p-1.5 text-foreground/30 hover:bg-destructive/10 hover:text-destructive transition-all duration-150 touch-manipulation"
                              title="Remover ambiente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Conteúdo do ambiente */}
                      {!isCollapsed && (
                        <div className="p-4 space-y-4 sm:p-5 sm:space-y-5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                          {/* Nome do ambiente */}
                          <div>
                            <label className={labelCls}>Nome do Ambiente <Req /></label>
                            <input
                              type="text" value={a.ambiente}
                              onChange={e => setAmbienteNome(a.id, e.target.value)}
                              className={inputCls}
                              placeholder="Sala, Quarto, Escritório…"
                              list="sugestoes-ambiente"
                            />
                          </div>

                          {/* Persianas */}
                          <div className="space-y-5">
                            {a.persianas.map((p, persianaIndex) => {
                              const tecidoBase = tecidosPorModelo[p.modelo] ?? []
                              // Opção especial: o n8n detecta "MAIS BARATO" e resolve o tecido
                              // mais barato do modelo ao vivo no banco (orçamento "a partir de")
                              const tecidoOpcoes = tecidoBase.length > 0
                                ? [MAIS_BARATO, ...tecidoBase]
                                : tecidoBase
                              const tecidoLivre = !catalogoLoading && tecidoOpcoes.length === 0
                              const isLastPersiana = persianaIndex === a.persianas.length - 1
                              const isPH50 = p.modelo === MODEL_PH50
                              const isEconomico = p.tecido === MAIS_BARATO
                              const promo = !isEconomico && p.tecido ? promoPorTecido.get(normTecido(p.tecido)) : undefined

                              return (
                                <div
                                  key={p.id}
                                  ref={el => { newPersianaRefs.current[p.id] = el }}
                                >
                                  {/* Persiana header — só quando há mais de 1 */}
                                  {a.persianas.length > 1 && (
                                    <div className="mb-3 flex items-center gap-2">
                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                                        {persianaIndex + 1}
                                      </span>
                                      <span className="text-xs font-semibold text-muted-foreground">
                                        Persiana {persianaIndex + 1}
                                      </span>
                                      <div className="flex-1 h-px bg-border/50" />
                                      {/* Copiar da persiana anterior */}
                                      {persianaIndex > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const prev = a.persianas[persianaIndex - 1]
                                            setAmbientes(s => s.map(amb => amb.id === a.id ? {
                                              ...amb,
                                              persianas: amb.persianas.map(pp => pp.id === p.id
                                                ? { ...pp, modelo: prev.modelo, tecido: prev.tecido, cor_ferragem: prev.cor_ferragem, acabamento: prev.acabamento }
                                                : pp
                                              )
                                            } : amb))
                                          }}
                                          className="flex items-center gap-1 shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                          title="Copiar modelo/tecido da persiana anterior"
                                        >
                                          <Copy className="h-3 w-3" />
                                          Copiar anterior
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => removePersiana(a.id, p.id)}
                                        className="shrink-0 rounded-lg p-1.5 text-foreground/30 hover:bg-destructive/10 hover:text-destructive transition-all duration-150 touch-manipulation"
                                        title="Remover persiana"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}

                                  {/* Grupo: Produto */}
                                  <FieldGroup icon={<Layers className="h-3 w-3" />} label="Produto">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                      <div>
                                        <label className={labelCls}>Modelo <Req /></label>
                                        <CustomSelect
                                          value={p.modelo}
                                          onChange={v => setPersianaModelo(a.id, p.id, v)}
                                          options={modelos}
                                          placeholder={catalogoLoading ? 'Carregando…' : modelos.length === 0 ? 'Nenhum modelo' : 'Selecione…'}
                                          disabled={catalogoLoading}
                                        />
                                      </div>
                                      <div key={p.modelo}>
                                        <div className="mb-1.5 flex items-center justify-between">
                                          <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/50 dark:text-foreground/55">
                                            Tecido <Req />
                                          </label>
                                          {tecidoLivre && p.modelo && (
                                            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                              <PenLine className="h-2.5 w-2.5" />Texto livre
                                            </span>
                                          )}
                                        </div>
                                        {tecidoOpcoes.length > 0 ? (
                                          <CustomSelect
                                            value={p.tecido}
                                            onChange={v => setPersianaField(a.id, p.id, 'tecido', v)}
                                            options={tecidoOpcoes}
                                            placeholder="Selecione o tecido…"
                                            disabled={!p.modelo}
                                          />
                                        ) : (
                                          <input
                                            type="text" required disabled={!p.modelo}
                                            value={p.tecido}
                                            onChange={e => setPersianaField(a.id, p.id, 'tecido', e.target.value)}
                                            className={inputCls}
                                            placeholder={!p.modelo ? 'Selecione um modelo primeiro' : 'Ex: Blackout, Solar Screen…'}
                                          />
                                        )}
                                        {promo && (
                                          <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1.5">
                                            <Tag className="h-3 w-3 shrink-0 text-primary" />
                                            <span className="text-[11px] font-semibold text-primary">
                                              Em promoção: −{promo.desconto_pct}% até {fmtDataBR(promo.promo_fim)} — avise o cliente!
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      {isEconomico && (
                                        <div className="sm:col-span-2">
                                          <label className={labelCls}>Tipo de tecido (mais barato)</label>
                                          <CustomSelect
                                            value={p.economico_tipo}
                                            onChange={v => setPersianaField(a.id, p.id, 'economico_tipo', v)}
                                            options={opcoesEconomico}
                                          />
                                          <p className="mt-1 text-[11px] text-foreground/50">
                                            Ex.: Blackout = o BK mais barato do modelo, não o tecido mais barato em geral.
                                          </p>
                                        </div>
                                      )}
                                      <div>
                                        <label className={labelCls}>Cor Ferragem</label>
                                        <CustomSelect
                                          value={p.cor_ferragem}
                                          onChange={v => setPersianaField(a.id, p.id, 'cor_ferragem', v)}
                                          options={CORES_FERRAGEM}
                                        />
                                      </div>
                                      <div>
                                        <label className={labelCls}>
                                          Acabamento{isPH50 && <Req />}
                                          {isPH50 && (
                                            <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                              PH_50: obrigatório
                                            </span>
                                          )}
                                        </label>
                                        <CustomSelect
                                          value={p.acabamento}
                                          onChange={v => setPersianaField(a.id, p.id, 'acabamento', v)}
                                          options={isPH50 ? PH50_ACABAMENTOS : ACABAMENTOS}
                                          placeholder={isPH50 ? 'Selecione Cadarço ou Fita…' : undefined}
                                        />
                                      </div>
                                    </div>
                                  </FieldGroup>

                                  {/* Grupo: Medidas */}
                                  <div className="mt-3">
                                    <FieldGroup icon={<Ruler className="h-3 w-3" />} label="Medidas">
                                      <div className="space-y-2">
                                        {p.medidas.map((m, medidaIndex) => {
                                          const l = parseFloat(m.largura) || 0
                                          const h = parseFloat(m.altura) || 0
                                          const q = parseInt(m.quantidade) || 1
                                          const area = l * h
                                          const areaTotal = area * q

                                          return (
                                            <div key={m.id} className="rounded-lg border border-border/60 bg-muted/10 p-3">
                                              {p.medidas.length > 1 && (
                                                <div className="mb-2 flex items-center gap-2">
                                                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-bold text-foreground/50">
                                                    {medidaIndex + 1}
                                                  </span>
                                                  {areaTotal > 0 && (
                                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                                      {areaTotal.toFixed(2)} m²
                                                    </span>
                                                  )}
                                                  <div className="flex-1" />
                                                  <button
                                                    type="button"
                                                    onClick={() => removeMedida(a.id, p.id, m.id)}
                                                    className="rounded-md p-1 text-foreground/30 hover:bg-destructive/10 hover:text-destructive transition-all duration-150 touch-manipulation"
                                                    title="Remover medida"
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </button>
                                                </div>
                                              )}
                                              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                                <div>
                                                  <label className={labelCls}>
                                                    <span className="sm:hidden">Larg. (m)</span>
                                                    <span className="hidden sm:inline">Largura (m)</span>
                                                    {' '}<Req />
                                                  </label>
                                                  <input type="text" inputMode="decimal"
                                                    value={m.largura} onChange={e => setMedidaField(a.id, p.id, m.id, 'largura', e.target.value.replace(',', '.'))}
                                                    onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                                                    className={inputCls} placeholder="2.50" />
                                                </div>
                                                <div>
                                                  <label className={labelCls}>
                                                    <span className="sm:hidden">Alt. (m)</span>
                                                    <span className="hidden sm:inline">Altura (m)</span>
                                                    {' '}<Req />
                                                  </label>
                                                  <input type="text" inputMode="decimal"
                                                    value={m.altura} onChange={e => setMedidaField(a.id, p.id, m.id, 'altura', e.target.value.replace(',', '.'))}
                                                    onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                                                    className={inputCls} placeholder="1.80" />
                                                </div>
                                                <div>
                                                  <label className={labelCls}>Qtd <Req /></label>
                                                  <input type="number" min="1" required inputMode="numeric"
                                                    value={m.quantidade} onChange={e => setMedidaField(a.id, p.id, m.id, 'quantidade', e.target.value)}
                                                    onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                                                    className={inputCls} />
                                                </div>
                                              </div>
                                              {pretaIndisponivel(p.modelo, p.cor_ferragem, m.largura, m.altura) && (
                                                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                                                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                                  <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                                      Nessa medida a ferragem preta não existe
                                                    </p>
                                                    <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
                                                      Acima de 2,51m de largura (ou 3,01m de altura) a rolô usa tubo de 50mm, que a loja só tem em <strong>branca</strong>.
                                                    </p>
                                                    <button
                                                      type="button"
                                                      onClick={() => setPersianaField(a.id, p.id, 'cor_ferragem', 'Branca')}
                                                      className="mt-1.5 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-300"
                                                    >
                                                      Trocar para branca
                                                    </button>
                                                  </div>
                                                </div>
                                              )}
                                              {area > 0 && p.medidas.length === 1 && (
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                  <span className="text-xs text-foreground/50">{m.largura} × {m.altura} m =</span>
                                                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{area.toFixed(2)} m²</span>
                                                  {q > 1 && (
                                                    <>
                                                      <span className="text-xs text-foreground/50">× {q} unid =</span>
                                                      <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">{areaTotal.toFixed(2)} m² total</span>
                                                    </>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>

                                      {/* Botão adicionar medida */}
                                      <button
                                        type="button" onClick={() => addMedida(a.id, p.id)}
                                        className="group mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-2 text-xs font-semibold text-foreground/40 transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary touch-manipulation"
                                      >
                                        <span className="flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-current transition-all duration-200 group-hover:bg-primary group-hover:border-primary group-hover:text-white">
                                          <Plus className="h-2.5 w-2.5" />
                                        </span>
                                        Adicionar medida
                                      </button>
                                    </FieldGroup>
                                  </div>

                                  {/* Separador entre persianas */}
                                  {!isLastPersiana && <div className="mt-5 border-t border-dashed border-border/60" />}
                                </div>
                              )
                            })}
                          </div>

                          {/* Botão adicionar persiana */}
                          <button
                            type="button" onClick={() => addPersiana(a.id)}
                            className="group flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-2.5 text-xs font-semibold text-foreground/40 transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary touch-manipulation"
                          >
                            <span className="flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-current transition-all duration-200 group-hover:bg-primary group-hover:border-primary group-hover:text-white">
                              <Plus className="h-2.5 w-2.5" />
                            </span>
                            {a.persianas.length > 0 ? `Adicionar Persiana ${a.persianas.length + 1}` : 'Adicionar Persiana'}
                            {a.persianas.length > 0 && (
                              <span className="text-[10px] font-normal text-muted-foreground/60 group-hover:text-primary/60">
                                (modelo diferente)
                              </span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Datalist sugestões */}
                <datalist id="sugestoes-ambiente">
                  {SUGESTOES_AMBIENTE.map(s => <option key={s} value={s} />)}
                </datalist>

                {/* Botão adicionar ambiente */}
                <button
                  type="button" onClick={addAmbiente}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-sm font-semibold text-foreground/40 transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.03] hover:text-primary touch-manipulation"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current transition-all duration-200 group-hover:bg-primary group-hover:border-primary group-hover:text-white">
                    <Plus className="h-3 w-3" />
                  </span>
                  Adicionar Ambiente
                </button>
              </div>
            </section>

            {/* ── SUBMIT mobile ── */}
            <div className="xl:hidden rounded-xl border border-border bg-card p-4 shadow-sm">
              <SubmitButton isLoading={isLoading} isSuccess={isSuccess} isValid={isFormValid} />
              {resetCountdown !== null && <ResetBanner countdown={resetCountdown} onCancel={cancelReset} />}
              <p className="mt-2 text-center text-xs text-foreground/60 font-medium">
                Campos com <span className="text-destructive font-bold">*</span> são obrigatórios
              </p>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="xl:sticky xl:top-24 h-fit space-y-3">

            {/* Resumo */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">Resumo do Pedido</span>
                </div>
                {isFormValid && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                    <svg viewBox="0 0 10 8" fill="none" className="h-2 w-2">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3">
                {form.cliente ? (
                  <div className="rounded-lg bg-primary/5 border border-primary/15 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">Cliente</p>
                    <p className="text-base font-bold text-foreground leading-tight">{form.cliente}</p>
                    <p className="text-xs font-medium text-foreground/60 mt-0.5">via {form.responsavel}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-3">
                    <p className="text-xs text-foreground/40 italic">Aguardando dados do cliente…</p>
                  </div>
                )}

                {form.whatsapp && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Envio via WhatsApp ativado</span>
                  </div>
                )}

                <div className="border-t border-border/50" />

                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Ambientes ({ambientes.length})
                  </p>
                  {ambientes.map((a, aIdx) => {
                    const ambienteArea = a.persianas.reduce((s, p) =>
                      s + p.medidas.reduce((ms, m) => ms + (parseFloat(m.largura) || 0) * (parseFloat(m.altura) || 0) * (parseInt(m.quantidade) || 1), 0), 0)
                    const hasData = a.persianas.some(persianaFilled)

                    return (
                      <div key={a.id} className={cn('rounded-lg border overflow-hidden transition-opacity', hasData ? 'border-border/60' : 'border-border/30 opacity-50')}>
                        <div className={cn('flex items-center justify-between px-3 py-2', hasData ? 'bg-muted/30' : 'bg-muted/10')}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn('flex shrink-0 items-center justify-center rounded-full text-[9px] font-bold', hasData ? 'bg-primary/15 text-primary' : 'bg-foreground/10 text-foreground/40')} style={{ width: 18, height: 18 }}>
                              {aIdx + 1}
                            </span>
                            <span className="text-xs font-semibold text-foreground truncate">{a.ambiente || `Ambiente ${aIdx + 1}`}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {a.persianas.length > 1 && <span className="text-[10px] font-semibold text-muted-foreground">{a.persianas.length}×</span>}
                            {ambienteArea > 0 && <span className="text-[10px] font-bold text-primary">{ambienteArea.toFixed(2)}m²</span>}
                          </div>
                        </div>
                        {a.persianas.map((p, pIdx) => {
                          if (!persianaFilled(p)) return null
                          const pArea = p.medidas.reduce((s, m) => s + (parseFloat(m.largura) || 0) * (parseFloat(m.altura) || 0) * (parseInt(m.quantidade) || 1), 0)
                          return (
                            <div key={p.id} className={cn('px-3 py-2 bg-background/50', pIdx > 0 && 'border-t border-border/30')}>
                              {a.persianas.length > 1 && <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Persiana {pIdx + 1}</p>}
                              <div className="space-y-0.5">
                                <MiniRow k="Modelo" v={p.modelo} />
                                <MiniRow k="Tecido" v={p.tecido} />
                                {p.tecido === MAIS_BARATO && p.economico_tipo !== 'Qualquer' && (
                                  <MiniRow k="Tipo" v={rotularTipo(p.economico_tipo)} />
                                )}
                                {p.tecido !== MAIS_BARATO && promoPorTecido.has(normTecido(p.tecido)) && (
                                  <MiniRow k="Promoção" v={`−${promoPorTecido.get(normTecido(p.tecido))!.desconto_pct}% até ${fmtDataBR(promoPorTecido.get(normTecido(p.tecido))!.promo_fim)}`} />
                                )}
                                {p.medidas.filter(m => parseFloat(m.largura) > 0).map((m, mi) => (
                                  <MiniRow key={m.id} k={p.medidas.length > 1 ? `Medida ${mi + 1}` : 'Medidas'} v={`${m.largura}×${m.altura}m × ${m.quantidade}`} />
                                ))}
                                {pArea > 0 && <MiniRow k="Área total" v={`${pArea.toFixed(2)} m²`} />}
                                {p.cor_ferragem !== 'Sem' && <MiniRow k="Ferragem" v={p.cor_ferragem} />}
                                {p.acabamento !== 'Sem' && <MiniRow k="Acabamento" v={p.acabamento} />}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                {/* Totais */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-primary/70">Ambientes</p>
                    <p className="font-display text-2xl font-bold text-primary leading-tight">{ambientes.length}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/45">Persianas</p>
                    <p className="font-display text-2xl font-bold text-foreground leading-tight">{totalPersianas}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/45">Área</p>
                    <p className="font-display text-lg font-bold text-foreground leading-tight mt-0.5">
                      {totalArea > 0 ? totalArea.toFixed(1) : '—'}
                      {totalArea > 0 && <span className="text-xs font-medium text-foreground/50">m²</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit desktop */}
            <div className="hidden xl:block rounded-xl border border-border bg-card p-4 shadow-sm">
              <SubmitButton isLoading={isLoading} isSuccess={isSuccess} isValid={isFormValid} />
              {resetCountdown !== null && <ResetBanner countdown={resetCountdown} onCancel={cancelReset} />}
              <p className="mt-2 text-center text-xs text-foreground/60 font-medium">
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

function Req() { return <span className="text-destructive ml-0.5">*</span> }

function ResetBanner({ countdown, onCancel }: { countdown: number; onCancel: () => void }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
      <span className="text-xs text-emerald-700 dark:text-emerald-400">
        Formulário será limpo em <strong>{countdown}s</strong>…
      </span>
      <button type="button" onClick={onCancel} className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 underline underline-offset-2 hover:opacity-70 transition-opacity">
        Cancelar
      </button>
    </div>
  )
}

function SubmitButton({ isLoading, isSuccess }: { isLoading: boolean; isSuccess: boolean; isValid: boolean }) {
  return (
    <button
      type="submit"
      disabled={isLoading || isSuccess}
      className={cn(
        'w-full flex items-center justify-center gap-2.5 rounded-xl px-4 py-4 text-sm font-bold text-white transition-all duration-200 touch-manipulation',
        isSuccess ? 'bg-emerald-500 cursor-default'
          : isLoading ? 'bg-primary/70 cursor-not-allowed'
          : 'bg-brand-gradient shadow-brand hover:opacity-95 active:scale-[0.98]',
      )}
    >
      {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
        : isSuccess ? <><CheckCircle2 className="h-4 w-4" /> Orçamento enviado!</>
        : <><Send className="h-4 w-4" /> Gerar Orçamento</>}
    </button>
  )
}

interface SectionHeaderProps {
  step: string
  icon: React.ReactNode
  title: string
  badge?: string
  done?: boolean
}

function SectionHeader({ step, icon, title, badge, done }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white transition-colors duration-300',
        done ? 'bg-emerald-500' : 'bg-primary'
      )}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground/40">{icon}</span>
        <span className="text-sm font-bold text-foreground">{title}</span>
        {badge && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{badge}</span>}
        {done && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Completo</span>}
      </div>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

interface FieldGroupProps { icon: React.ReactNode; label: string; children: React.ReactNode }

function FieldGroup({ icon, label, children }: FieldGroupProps) {
  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-2 select-none pointer-events-none"
        aria-hidden="true"
      >
        <span className="text-primary/40 shrink-0">{icon}</span>
        <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-foreground/35">
          {label}
        </span>
        <div className="flex-1 h-px bg-border/50" />
      </div>
      <div>{children}</div>
    </div>
  )
}

function MiniRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-2 text-[11px]">
      <span className="shrink-0 font-medium text-foreground/50">{k}</span>
      <span className="truncate text-right font-semibold text-foreground max-w-[55%]">{v}</span>
    </div>
  )
}
