import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useCrmLeads, useOrcamentosIA, useMarcarConvertido, STATUS_AGUARDANDO, STATUS_CONVERTIDO } from '@/hooks/useAgenteIA'
import { formatCurrency } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import {
  Bot, DollarSign, FileText, Moon, Users, CalendarCheck,
  ChevronDown, ChevronUp, ChevronsUpDown, Phone, ChevronRight,
  MessageSquare, CheckCircle2, Bell, Check,
  Clock, MessageCircle, XCircle, Circle, ChevronLeft,
} from 'lucide-react'
import SkeletonCard from '@/components/shared/SkeletonCard'
import { filterByPeriod } from '@/hooks/usePeriodFilter'

// ── Horário comercial ────────────────────────────────────────────────────────
const HORA_INICIO = 8
const HORA_FIM = 18
const ESPERA_HORAS = 2
const LEADS_PAGE_SIZE = 20
const ORCS_PAGE_SIZE = 20

function formatWaNumber(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

function isForaDoHorario(dateStr: string | null) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const day = d.getDay()
  const hour = d.getHours()
  return day === 0 || day === 6 || hour < HORA_INICIO || hour >= HORA_FIM
}

function horasDecorridas(ts: string | null | undefined): number {
  if (!ts) return 0
  return (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60)
}

// ── Formatação ───────────────────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── Sistema de cores de status (único e consistente) ─────────────────────────
type StatusInfo = { badge: string; label: string; Icon: React.ElementType }

function getStatus(raw: string | null): StatusInfo {
  const s = raw?.toLowerCase().trim() ?? ''
  if (s === STATUS_CONVERTIDO || s === 'fechado')
    return { badge: 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20', label: 'Convertido', Icon: CheckCircle2 }
  if (s === STATUS_AGUARDANDO || s === 'aguardando_atendente' || s === 'transferido')
    return { badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30', label: 'Aguardando atendimento', Icon: Clock }
  if (s === 'qualificado')
    return { badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', label: 'Qualificado', Icon: Circle }
  if (s === 'cotado')
    return { badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400', label: 'Cotado', Icon: FileText }
  if (s === 'agendado')
    return { badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-400', label: 'Agendado', Icon: CalendarCheck }
  if (s === 'em_atendimento' || s === 'em atendimento')
    return { badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-400', label: 'Em atendimento', Icon: MessageCircle }
  if (s === 'perdido' || s === 'desistiu')
    return { badge: 'bg-red-500/15 text-red-600 dark:text-red-400', label: 'Perdido', Icon: XCircle }
  if (s === 'fora_horario' || s === 'fora do horário' || s === 'fora horario')
    return { badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', label: 'Fora do horário', Icon: Moon }
  if (!s || s === 'aguardando' || s === 'novo')
    return { badge: 'bg-muted text-muted-foreground', label: raw ? (raw.charAt(0).toUpperCase() + raw.slice(1)) : 'Sem status', Icon: Circle }
  // Qualquer outro status desconhecido
  return { badge: 'bg-muted text-muted-foreground', label: raw!.charAt(0).toUpperCase() + raw!.slice(1).replace(/_/g, ' '), Icon: Circle }
}

function isConvertido(s: string | null) {
  const v = s?.toLowerCase().trim() ?? ''
  return v === STATUS_CONVERTIDO || v === 'fechado'
}
function isAguardando(s: string | null) {
  const v = s?.toLowerCase().trim() ?? ''
  return v === STATUS_AGUARDANDO || v === 'aguardando_atendente' || v === 'transferido'
}

// ── Componentes auxiliares ───────────────────────────────────────────────────
const PERIODOS = [
  { value: 'todos', label: 'Tudo' },
  { value: 'hoje',  label: 'Hoje' },
  { value: 'semana',label: 'Semana' },
  { value: 'mes',   label: 'Mês' },
]

function PeriodTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
      {PERIODOS.map(({ value: v, label }) => (
        <button key={v} onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all
            ${value === v ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, highlight, sub, attention, delay }: {
  label: string; value: string | number; icon: React.ElementType
  highlight?: boolean; attention?: boolean; sub?: string; delay: number
}) {
  return (
    <div
      className={`animate-in fade-in-0 slide-in-from-bottom-4 duration-500 rounded-xl border-2 p-4 shadow-sm transition-all duration-200 hover:shadow-elevated cursor-default
        ${attention  ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10'
        : highlight  ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
        : 'bg-card'}`}
      style={{ animationFillMode: 'both', animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/70 truncate">{label}</p>
          <p className={`font-display mt-1.5 text-2xl font-bold tracking-tight truncate tabular-nums
            ${attention ? 'text-amber-600 dark:text-amber-400'
            : highlight ? 'text-primary' : ''}`}>
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground/60 truncate">{sub}</p>}
        </div>
        <div className={`shrink-0 rounded-lg p-1.5
          ${attention ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : highlight ? 'bg-primary/15 text-primary'
          : 'bg-muted text-muted-foreground'}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

type LeadSort = { key: 'created_at' | 'nome' | 'timestamp_ultima_msg'; dir: 'asc' | 'desc' }
type OrcSort  = { key: 'created_at' | 'modelo' | 'valor'; dir: 'asc' | 'desc' }

// ── Componente principal ─────────────────────────────────────────────────────
export default function TabAgenteIA() {
  const { data: leads = [], isLoading: loadingCrm } = useCrmLeads()
  const { data: orcamentosIA = [], isLoading: loadingOrc } = useOrcamentosIA()
  const { mutate: marcarConvertido, isPending: marcando } = useMarcarConvertido()

  const [periodo, setPeriodo] = useState('mes')
  const [leadSort, setLeadSort] = useState<LeadSort>({ key: 'created_at', dir: 'desc' })
  const [orcSort,  setOrcSort]  = useState<OrcSort>({  key: 'created_at', dir: 'desc' })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [mobileConfirmId, setMobileConfirmId] = useState<string | null>(null)
  const [leadsPage, setLeadsPage] = useState(1)
  const [orcsPage, setOrcsPage] = useState(1)

  // Reset pages when filters or sort changes
  useEffect(() => { setLeadsPage(1) }, [periodo, leadSort])
  useEffect(() => { setOrcsPage(1) }, [periodo, orcSort])
  useEffect(() => { setExpandedId(null) }, [leadsPage])

  // Track first data load — skip count-up re-animation on period changes
  const hasLoadedRef = useRef(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  useEffect(() => {
    if (!loadingCrm && !loadingOrc && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      // Small delay so initial animation runs, then lock
      const t = setTimeout(() => setHasLoaded(true), 1200)
      return () => clearTimeout(t)
    }
  }, [loadingCrm, loadingOrc])

  // P3 — memoised filtered lists
  const filtrados = useMemo(
    () => filterByPeriod(leads, periodo, (l) => l.created_at),
    [leads, periodo]
  )
  const orcFiltrados = useMemo(
    () => filterByPeriod(orcamentosIA, periodo, (o) => o.created_at),
    [orcamentosIA, periodo]
  )

  // KPIs
  const aguardando       = filtrados.filter((l) => isAguardando(l.status_lead))
  const convertidos      = filtrados.filter((l) => isConvertido(l.status_lead))
  const comMedicao       = filtrados.filter((l) => l.data_medicao_instalacao?.trim())
  const foraLeads        = filtrados.filter((l) => isForaDoHorario(l.created_at))
  const foraMsgs         = filtrados.filter((l) => isForaDoHorario(l.timestamp_ultima_msg))
  const mensagensTotais  = filtrados.filter((l) => l.timestamp_ultima_msg).length
  const valorTotal       = orcFiltrados.reduce((s, o) =>
    s + (o.valor_venda_total_base ?? 0) + (o.valor_venda_acabamento_total ?? 0) + (o.valor_colocacao ?? 0), 0)

  // F3 — leads em espera
  const leadsEmEspera = useMemo(() =>
    filtrados.filter(l => {
      const status = l.status_lead?.toLowerCase().trim() ?? ''
      const convertido = status === 'convertido' || status === 'fechado'
      return !convertido && horasDecorridas(l.timestamp_ultima_msg) > ESPERA_HORAS
    }), [filtrados])

  const animLeads      = useCountUp(filtrados.length, 700, hasLoaded)
  const animAguard     = useCountUp(aguardando.length, 700, hasLoaded)
  const animConv       = useCountUp(convertidos.length, 750, hasLoaded)
  const animValor      = useCountUp(valorTotal, 900, hasLoaded)
  const animMed        = useCountUp(comMedicao.length, 750, hasLoaded)
  const animForaLeads  = useCountUp(foraLeads.length, 700, hasLoaded)
  const animMsgs       = useCountUp(mensagensTotais, 750, hasLoaded)
  const animForaMsgs   = useCountUp(foraMsgs.length, 700, hasLoaded)
  const animEspera     = useCountUp(leadsEmEspera.length, 700, hasLoaded)

  const alcanceKpis = [
    { label: 'Pessoas respondidas',      value: Math.round(animLeads),     icon: Users,         highlight: true,  sub: 'atendidas pelo agente' },
    { label: 'Pessoas fora do horário',  value: Math.round(animForaLeads), icon: Moon,          highlight: false, sub: 'entraram fora do comercial' },
    { label: 'Mensagens no total',       value: Math.round(animMsgs),      icon: MessageSquare, highlight: false, sub: 'conversas com troca de msgs' },
    { label: 'Msgs fora do horário',     value: Math.round(animForaMsgs),  icon: MessageCircle, highlight: false, sub: 'última msg fora do comercial' },
  ]

  const opKpis = [
    { label: 'Aguardando atendimento', value: Math.round(animAguard),  icon: Bell,          attention: true,  sub: 'querem atendimento humano' },
    { label: 'Convertidos',            value: Math.round(animConv),    icon: CheckCircle2,  highlight: false, sub: `de ${filtrados.length} leads` },
    { label: 'Valor cotado (IA)',       value: valorTotal > 0 ? formatCurrency(animValor) : '—', icon: DollarSign, highlight: false, sub: `${orcFiltrados.length} orçamento${orcFiltrados.length !== 1 ? 's' : ''}` },
    { label: 'Medições agendadas',     value: Math.round(animMed),     icon: CalendarCheck, highlight: false, sub: 'com data marcada' },
    { label: 'Em espera',              value: String(Math.round(animEspera)), icon: Clock, attention: leadsEmEspera.length > 0, sub: `aguardando +${ESPERA_HORAS}h` },
  ]

  // P3 — memoised sorts
  const sortedLeads = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      const wa = isAguardando(a.status_lead) ? -1 : 0
      const wb = isAguardando(b.status_lead) ? -1 : 0
      if (wa !== wb) return wa - wb  // aguardando sempre no topo, independente da direção
      let av: string, bv: string
      if (leadSort.key === 'nome') { av = a.nome ?? ''; bv = b.nome ?? '' }
      else if (leadSort.key === 'timestamp_ultima_msg') { av = a.timestamp_ultima_msg ?? ''; bv = b.timestamp_ultima_msg ?? '' }
      else { av = a.created_at; bv = b.created_at }
      if (av < bv) return leadSort.dir === 'asc' ? -1 : 1
      if (av > bv) return leadSort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtrados, leadSort])

  const sortedOrcs = useMemo(() => {
    return [...orcFiltrados].sort((a, b) => {
      let av: string | number, bv: string | number
      if (orcSort.key === 'modelo') { av = a.modelo ?? ''; bv = b.modelo ?? '' }
      else if (orcSort.key === 'valor') {
        av = (a.valor_venda_total_base ?? 0) + (a.valor_venda_acabamento_total ?? 0) + (a.valor_colocacao ?? 0)
        bv = (b.valor_venda_total_base ?? 0) + (b.valor_venda_acabamento_total ?? 0) + (b.valor_colocacao ?? 0)
      } else { av = a.created_at; bv = b.created_at }
      if (av < bv) return orcSort.dir === 'asc' ? -1 : 1
      if (av > bv) return orcSort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [orcFiltrados, orcSort])

  // U1 — pagination
  const totalLeadPages = Math.ceil(sortedLeads.length / LEADS_PAGE_SIZE)
  const paginatedLeads = useMemo(
    () => sortedLeads.slice((leadsPage - 1) * LEADS_PAGE_SIZE, leadsPage * LEADS_PAGE_SIZE),
    [sortedLeads, leadsPage]
  )

  const totalOrcPages = Math.ceil(sortedOrcs.length / ORCS_PAGE_SIZE)
  const paginatedOrcs = useMemo(
    () => sortedOrcs.slice((orcsPage - 1) * ORCS_PAGE_SIZE, orcsPage * ORCS_PAGE_SIZE),
    [sortedOrcs, orcsPage]
  )

  function LeadTh({ label, k }: { label: string; k?: 'created_at' | 'nome' | 'timestamp_ultima_msg' }) {
    const active = k && leadSort.key === k
    return (
      <th className={`px-5 py-3 text-left font-medium text-muted-foreground whitespace-nowrap ${k ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
        onClick={() => k && setLeadSort(s => s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' })}>
        <span className="flex items-center gap-1">
          {label}
          {k && (active
            ? (leadSort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />)
            : <ChevronsUpDown className="h-3 w-3 opacity-40" />)}
        </span>
      </th>
    )
  }

  function OrcTh({ label, k }: { label: string; k?: 'created_at' | 'modelo' | 'valor' }) {
    const active = k && orcSort.key === k
    return (
      <th className={`px-5 py-3 text-left font-medium text-muted-foreground whitespace-nowrap ${k ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
        onClick={() => k && setOrcSort(s => s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' })}>
        <span className="flex items-center gap-1">
          {label}
          {k && (active
            ? (orcSort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />)
            : <ChevronsUpDown className="h-3 w-3 opacity-40" />)}
        </span>
      </th>
    )
  }

  if (loadingCrm || loadingOrc) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="rounded-xl border-2 bg-card shadow-sm animate-pulse">
          <div className="border-b px-5 py-4"><div className="h-5 w-48 rounded bg-muted" /></div>
          <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded bg-muted" />)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Alcance do Agente ── */}
      <div key={periodo} className="space-y-3 animate-in fade-in-0 duration-200">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-0.5">Alcance do Agente</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {alcanceKpis.map(({ label, value, icon, highlight, sub }, i) => (
            <KpiCard key={label} label={label} value={value} icon={icon}
              highlight={highlight} sub={sub} delay={i * 80} />
          ))}
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-0.5 pt-1">Operacional</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {opKpis.map(({ label, value, icon, highlight, attention, sub }, i) => (
            <KpiCard key={label} label={label} value={value} icon={icon}
              highlight={highlight} attention={attention} sub={sub} delay={i * 80 + 320} />
          ))}
        </div>
      </div>

      {/* ── Banner: aguardando atendimento ── */}
      {aguardando.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 flex items-center gap-3">
          <Bell className="h-5 w-5 text-amber-500 shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {aguardando.length} lead{aguardando.length !== 1 ? 's' : ''} aguardando atendimento humano
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A IA passou o orçamento e o cliente quer falar com um atendente. Aparecem no topo da lista.
            </p>
          </div>
        </div>
      )}

      {/* ── Seletor de Período (único, acima das duas tabelas) ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Período:</span>
        <PeriodTabs value={periodo} onChange={setPeriodo} />
      </div>

      {/* ── Tabela de Leads ── */}
      <div className="rounded-xl border-2 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-medium tracking-wide">Leads do Agente IA</h2>
            <span className="text-xs text-muted-foreground">{filtrados.length} lead{filtrados.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
              <Bot className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium">Nenhum lead neste período</p>
            <p className="text-sm text-muted-foreground">{leads.length > 0 ? 'Tente um período maior' : 'Dados vêm da tabela crm_sombrear_ia'}</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <LeadTh label="Entrada"      k="created_at" />
                    <LeadTh label="Nome"          k="nome" />
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">WhatsApp</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Modelo / Ambiente</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Último valor</th>
                    <LeadTh label="Últ. mensagem" k="timestamp_ultima_msg" />
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead, rowIdx) => {
                    const aguard    = isAguardando(lead.status_lead)
                    const conv      = isConvertido(lead.status_lead)
                    const foraMsg   = isForaDoHorario(lead.timestamp_ultima_msg)
                    const foraEntr  = isForaDoHorario(lead.created_at)
                    const expanded  = expandedId === lead.id
                    const status    = getStatus(lead.status_lead)
                    const emEspera  = !conv && horasDecorridas(lead.timestamp_ultima_msg) > ESPERA_HORAS

                    return (
                      <React.Fragment key={lead.id}>
                        <tr
                          className={`border-b last:border-0 transition-colors cursor-pointer
                            ${aguard   ? 'border-l-2 border-l-amber-400' : ''}
                            ${conv     ? 'opacity-60' : ''}
                            ${emEspera ? 'bg-amber-500/5' : ''}
                            ${expanded ? 'bg-muted/30' : rowIdx % 2 === 1 ? 'bg-muted/[0.15] hover:bg-muted/30' : 'hover:bg-primary/[0.04]'}`}
                          onClick={() => setExpandedId(expanded ? null : lead.id)}
                        >
                          <td className="px-5 py-3.5 text-muted-foreground tabular-nums whitespace-nowrap"
                            onClick={() => setExpandedId(expanded ? null : lead.id)}>
                            <span className="block">{fmtDate(lead.created_at)}</span>
                            <span className="flex items-center gap-1 text-xs opacity-70">
                              {fmtTime(lead.created_at)}
                              {foraEntr && <Moon className="h-2.5 w-2.5 text-blue-400" />}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                            {lead.nome ?? '—'}
                          </td>
                          <td className="px-5 py-3.5" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                            {lead.whatsapp ? (
                              <span className="flex items-center gap-1.5">
                                <span className="text-muted-foreground text-xs flex items-center gap-1">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  {lead.whatsapp}
                                </span>
                                <a
                                  href={`https://wa.me/${formatWaNumber(lead.whatsapp)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Abrir no WhatsApp"
                                  className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                >
                                  <MessageCircle className="h-3 w-3 shrink-0" />
                                  WA
                                </a>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                            <span className="block font-medium">{lead.modelo_interesse ?? '—'}</span>
                            {lead.ambiente && <span className="text-xs text-muted-foreground">{lead.ambiente}</span>}
                          </td>
                          <td className="px-5 py-3.5 font-medium tabular-nums" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                            {lead.ultimo_valor_cotado && !isNaN(parseFloat(lead.ultimo_valor_cotado))
                              ? formatCurrency(parseFloat(lead.ultimo_valor_cotado))
                              : (lead.ultimo_valor_cotado ?? '—')}
                          </td>
                          <td className="px-5 py-3.5 tabular-nums whitespace-nowrap" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                            <span className={`flex items-center gap-1 block text-sm ${foraMsg ? 'text-blue-500 dark:text-blue-400' : emEspera ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                              {emEspera && <Clock className="h-3 w-3 text-amber-500 shrink-0" />}
                              {fmtDate(lead.timestamp_ultima_msg)}
                            </span>
                            <span className="flex items-center gap-1 text-xs opacity-70">
                              {fmtTime(lead.timestamp_ultima_msg)}
                              {foraMsg && <MessageSquare className="h-2.5 w-2.5 text-blue-400" />}
                            </span>
                          </td>
                          <td className="px-5 py-3.5" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                            <span
                              role="status"
                              aria-label={status.label}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${status.badge}`}
                            >
                              <status.Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              {!conv && (
                                confirmId === lead.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); marcarConvertido(lead.id); setConfirmId(null) }}
                                      disabled={marcando}
                                      className="rounded-lg bg-green-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-60 transition-colors"
                                    >
                                      {marcando ? '...' : <><Check className="inline h-3 w-3 mr-1" />Confirmar</>}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setConfirmId(null) }}
                                      className="rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                                    >
                                      Não
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmId(lead.id) }}
                                    className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-green-500/50 hover:text-green-600 hover:bg-green-500/5 transition-colors"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Converteu
                                  </button>
                                )
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : lead.id) }}
                                className="rounded p-1 hover:bg-muted transition-colors"
                              >
                                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expanded && (
                          <tr key={`${lead.id}-exp`} className="border-b bg-muted/10">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                                {lead.resumo_conversa && (
                                  <div className="col-span-2 sm:col-span-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Resumo da conversa</p>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{lead.resumo_conversa}</p>
                                  </div>
                                )}
                                {lead.medidas_coletadas    && <div><p className="text-xs text-muted-foreground mb-0.5">Medidas</p><p className="font-medium">{lead.medidas_coletadas}</p></div>}
                                {lead.tecido_cor           && <div><p className="text-xs text-muted-foreground mb-0.5">Tecido / Cor</p><p className="font-medium">{lead.tecido_cor}</p></div>}
                                {lead.acabamento_desejado  && <div><p className="text-xs text-muted-foreground mb-0.5">Acabamento</p><p className="font-medium">{lead.acabamento_desejado}</p></div>}
                                {lead.precisa_instalacao   && <div><p className="text-xs text-muted-foreground mb-0.5">Instalação</p><p className="font-medium">{lead.precisa_instalacao}</p></div>}
                                {lead.data_medicao_instalacao && <div><p className="text-xs text-muted-foreground mb-0.5">Data medição</p><p className="font-medium text-primary">{lead.data_medicao_instalacao}</p></div>}
                                {lead.endereco_cep         && <div><p className="text-xs text-muted-foreground mb-0.5">CEP</p><p className="font-medium">{lead.endereco_cep}</p></div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y">
              {paginatedLeads.map((lead) => {
                const aguard   = isAguardando(lead.status_lead)
                const conv     = isConvertido(lead.status_lead)
                const expanded = expandedId === lead.id
                const status   = getStatus(lead.status_lead)
                const emEspera = !conv && horasDecorridas(lead.timestamp_ultima_msg) > ESPERA_HORAS
                return (
                  <div key={lead.id} className={`${aguard ? 'border-l-2 border-l-amber-400' : ''} ${conv ? 'opacity-60' : ''} ${emEspera ? 'bg-amber-500/5' : ''}`}>
                    <div className="px-4 py-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="font-semibold text-sm">{lead.nome ?? 'Sem nome'}</p>
                          {lead.whatsapp && (
                            <span className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground">{lead.whatsapp}</span>
                              <a
                                href={`https://wa.me/${formatWaNumber(lead.whatsapp)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Abrir no WhatsApp"
                                className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                              >
                                <MessageCircle className="h-3 w-3 shrink-0" />
                                WA
                              </a>
                            </span>
                          )}
                        </div>
                        <span
                          role="status"
                          aria-label={status.label}
                          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.badge}`}
                        >
                          <status.Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {emEspera && <Clock className="h-3 w-3 text-amber-500 shrink-0" />}
                          {fmtDate(lead.created_at)} {fmtTime(lead.created_at)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {lead.ultimo_valor_cotado && !isNaN(parseFloat(lead.ultimo_valor_cotado)) && (
                            <span className="text-sm font-bold text-primary">{formatCurrency(parseFloat(lead.ultimo_valor_cotado))}</span>
                          )}
                          {!conv && (
                            mobileConfirmId === lead.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); marcarConvertido(lead.id); setMobileConfirmId(null) }}
                                  disabled={marcando}
                                  className="rounded-lg bg-green-500 px-2 py-0.5 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-60 transition-colors"
                                >
                                  {marcando ? '...' : <><Check className="inline h-3 w-3 mr-0.5" />Confirmar</>}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMobileConfirmId(null) }}
                                  className="rounded-lg border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setMobileConfirmId(lead.id) }}
                                className="rounded-lg border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:border-green-500/50 hover:text-green-600 transition-colors"
                              >
                                <CheckCircle2 className="inline h-3 w-3 mr-0.5" />Converteu
                              </button>
                            )
                          )}
                          <button onClick={() => setExpandedId(expanded ? null : lead.id)}>
                            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {expanded && (
                      <div className="px-4 pb-4 border-t bg-muted/10 space-y-2">
                        {lead.resumo_conversa && <div className="pt-3"><p className="text-xs text-muted-foreground mb-1">Resumo</p><p className="text-sm text-muted-foreground">{lead.resumo_conversa}</p></div>}
                        <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
                          {lead.modelo_interesse        && <div><p className="text-xs text-muted-foreground">Modelo</p><p className="font-medium">{lead.modelo_interesse}</p></div>}
                          {lead.tecido_cor              && <div><p className="text-xs text-muted-foreground">Tecido/Cor</p><p className="font-medium">{lead.tecido_cor}</p></div>}
                          {lead.medidas_coletadas       && <div><p className="text-xs text-muted-foreground">Medidas</p><p className="font-medium">{lead.medidas_coletadas}</p></div>}
                          {lead.data_medicao_instalacao && <div><p className="text-xs text-muted-foreground">Data medição</p><p className="font-medium text-primary">{lead.data_medicao_instalacao}</p></div>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {(foraLeads.length > 0 || foraMsgs.length > 0) && (
              <div className="border-t px-5 py-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                {foraLeads.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Moon className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span><span className="font-semibold text-foreground">{foraLeads.length}</span> pessoa{foraLeads.length !== 1 ? 's' : ''} entraram fora do horário comercial</span>
                  </span>
                )}
                {foraMsgs.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span><span className="font-semibold text-foreground">{foraMsgs.length}</span> última{foraMsgs.length !== 1 ? 's' : ''} mensagem{foraMsgs.length !== 1 ? 's' : ''} fora do horário</span>
                  </span>
                )}
              </div>
            )}

            {/* Leads pagination */}
            {totalLeadPages > 1 && (
              <div className="flex items-center justify-between border-t px-5 py-3">
                <span className="text-xs text-muted-foreground">
                  {(leadsPage - 1) * LEADS_PAGE_SIZE + 1}–{Math.min(leadsPage * LEADS_PAGE_SIZE, sortedLeads.length)} de {sortedLeads.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setLeadsPage(p => p - 1)} disabled={leadsPage === 1} className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 text-xs font-medium tabular-nums">{leadsPage} / {totalLeadPages}</span>
                  <button onClick={() => setLeadsPage(p => p + 1)} disabled={leadsPage === totalLeadPages} className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Tabela de Orçamentos IA ── */}
      <div className="rounded-xl border-2 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-medium tracking-wide">Orçamentos gerados pela IA</h2>
            <span className="text-xs text-muted-foreground">{orcFiltrados.length} orçamento{orcFiltrados.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {orcFiltrados.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
              <Bot className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium">Nenhum orçamento neste período</p>
            <p className="text-sm text-muted-foreground">{orcamentosIA.length > 0 ? 'Tente um período maior' : 'Dados vêm da tabela orcamentos_sombrear_ia'}</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <OrcTh label="Data"          k="created_at" />
                    <OrcTh label="Modelo"         k="modelo" />
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Ambiente</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Medidas / Qtd</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Tecido / Acab.</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Custo</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Valor venda</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Colocação</th>
                    <OrcTh label="Total"          k="valor" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrcs.map((o, rowIdx) => {
                    const total = (o.valor_venda_total_base ?? 0) + (o.valor_venda_acabamento_total ?? 0) + (o.valor_colocacao ?? 0)
                    const custoBase = o.custo_total_base != null ? formatCurrency(o.custo_total_base) : null
                    const custoAcab = o.custo_acabamento_total != null ? formatCurrency(o.custo_acabamento_total) : null
                    return (
                      <tr key={o.id} className={`border-b last:border-0 transition-colors ${rowIdx % 2 === 1 ? 'bg-muted/[0.15] hover:bg-muted/30' : 'hover:bg-primary/[0.04]'}`}>
                        <td className="px-5 py-3.5 text-muted-foreground tabular-nums whitespace-nowrap">
                          <span className="block">{fmtDate(o.created_at)}</span>
                          <span className="text-xs opacity-70">{fmtTime(o.created_at)}</span>
                        </td>
                        <td className="px-5 py-3.5 font-medium">{o.modelo ?? '—'}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{o.ambiente ?? '—'}</td>
                        <td className="px-5 py-3.5 tabular-nums whitespace-nowrap">
                          <span className="block">
                            {o.largura && o.altura ? `${o.largura}×${o.altura}m` : '—'}
                            {o.quantidade && o.quantidade > 1 ? ` (×${o.quantidade})` : ''}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="block">{o.tecido ?? '—'}</span>
                          {o.acabamento && <span className="text-xs text-muted-foreground">{o.acabamento}</span>}
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                          {custoBase ? <span className="block">{custoBase}</span> : <span>—</span>}
                          {custoAcab && <span className="text-xs opacity-70">{custoAcab}</span>}
                        </td>
                        <td className="px-5 py-3.5 tabular-nums">{o.valor_venda_total_base != null ? formatCurrency((o.valor_venda_total_base ?? 0) + (o.valor_venda_acabamento_total ?? 0)) : '—'}</td>
                        <td className="px-5 py-3.5 tabular-nums text-muted-foreground">{o.valor_colocacao != null ? formatCurrency(o.valor_colocacao) : '—'}</td>
                        <td className="px-5 py-3.5 font-bold text-primary tabular-nums">{total > 0 ? formatCurrency(total) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y">
              {paginatedOrcs.map((o) => {
                const total = (o.valor_venda_total_base ?? 0) + (o.valor_venda_acabamento_total ?? 0) + (o.valor_colocacao ?? 0)
                return (
                  <div key={o.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="font-semibold text-sm">{o.modelo ?? '—'}</p>
                        {o.ambiente && <p className="text-xs text-muted-foreground mt-0.5">{o.ambiente}</p>}
                      </div>
                      {total > 0 && <span className="shrink-0 text-sm font-bold text-primary tabular-nums">{formatCurrency(total)}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {o.largura && o.altura ? `${o.largura}×${o.altura}m · ` : ''}{o.tecido ?? ''}
                      {o.quantidade ? ` · ${o.quantidade}un` : ''} · {fmtDate(o.created_at)}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="border-t px-5 py-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span>Total cotado: <span className="font-semibold text-foreground">{formatCurrency(valorTotal)}</span></span>
              {orcFiltrados.some((o) => o.valor_colocacao) && (
                <span>Colocação: <span className="font-semibold text-foreground">{formatCurrency(orcFiltrados.reduce((s, o) => s + (o.valor_colocacao ?? 0), 0))}</span></span>
              )}
            </div>

            {/* Orcs pagination */}
            {totalOrcPages > 1 && (
              <div className="flex items-center justify-between border-t px-5 py-3">
                <span className="text-xs text-muted-foreground">
                  {(orcsPage - 1) * ORCS_PAGE_SIZE + 1}–{Math.min(orcsPage * ORCS_PAGE_SIZE, sortedOrcs.length)} de {sortedOrcs.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setOrcsPage(p => p - 1)} disabled={orcsPage === 1} className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 text-xs font-medium tabular-nums">{orcsPage} / {totalOrcPages}</span>
                  <button onClick={() => setOrcsPage(p => p + 1)} disabled={orcsPage === totalOrcPages} className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
