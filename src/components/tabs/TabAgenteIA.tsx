import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useCrmLeads, useOrcamentosIA, useMarcarConvertido, STATUS_AGUARDANDO, STATUS_CONVERTIDO, type CrmLead, type OrcamentoIA } from '@/hooks/useAgenteIA'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'
import { useCountUp } from '@/hooks/useCountUp'
import {
  Bot, DollarSign, FileText, Moon, Users, CalendarCheck,
  ChevronDown, ChevronUp, ChevronsUpDown, Phone, ChevronRight,
  MessageSquare, CheckCircle2, Bell, Check,
  Clock, MessageCircle, XCircle, Circle, ChevronLeft,
  AlertCircle, Minimize2, Maximize2, FilePlus2, ExternalLink, Filter,
} from 'lucide-react'
import DatePicker from '@/components/ui/DatePicker'
import SkeletonCard from '@/components/shared/SkeletonCard'
import NovoOrcamentoForm from '@/components/orcamentos/NovoOrcamentoForm'
import InsightsStella from '@/components/agente/InsightsStella'
import ClassificadorConversas, { SeloClassificacao } from '@/components/agente/ClassificadorConversas'
import FollowupControle from '@/components/agente/FollowupControle'
import { useProfile } from '@/hooks/useProfile'
import { ADMIN_EMAIL } from '@/lib/constants'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import { useToast } from '@/hooks/useToast'
import Toaster from '@/components/ui/Toaster'
import { HORA_INICIO, HORA_FIM, ESPERA_HORAS, LEADS_PAGE_SIZE, ORCS_PAGE_SIZE, MODELOS, CHATWOOT_BASE_URL } from '@/lib/constants'

// ── Horário comercial ────────────────────────────────────────────────────────

function formatWaNumber(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

function chatwootUrl(lead: CrmLead): string | null {
  if (!lead.id_conta_chatwoot || !lead.id_conversa_chatwoot) return null
  return `${CHATWOOT_BASE_URL}/app/accounts/${lead.id_conta_chatwoot}/conversations/${lead.id_conversa_chatwoot}`
}

// Monta o pré-preenchimento do NovoOrcamentoForm a partir de um lead do agente
function leadToOrcamentoInitial(l: CrmLead) {
  const medidas = l.medidas_coletadas?.match(/(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)/i)
  const modeloMatch = MODELOS.find((m) => l.modelo_interesse?.toLowerCase().includes(m.toLowerCase()))
  const qtd = parseInt(l.quantidade ?? '', 10)
  // "R$ 1.234,56" → "1234.56" (pré-preenche o valor de venda com o último valor cotado pela IA)
  const valorCotado = l.ultimo_valor_cotado
    ? parseFloat(l.ultimo_valor_cotado.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
    : NaN
  return {
    valor_venda: Number.isFinite(valorCotado) && valorCotado > 0 ? String(valorCotado) : '',
    responsavel: 'Stella',
    cliente: l.nome ?? '',
    telefone: l.whatsapp ?? '',
    ambiente: l.ambiente ?? '',
    modelo: modeloMatch ?? MODELOS[0],
    tecido: l.tecido_cor ?? '',
    quantidade: Number.isInteger(qtd) && qtd >= 1 ? String(qtd) : '1',
    largura: medidas ? medidas[1].replace(',', '.') : '',
    altura: medidas ? medidas[2].replace(',', '.') : '',
    acabamentos: l.acabamento_desejado ?? '',
    observacoes: [
      'Criado a partir de lead do Agente IA (WhatsApp).',
      l.modelo_interesse && !modeloMatch ? `Modelo de interesse: ${l.modelo_interesse}` : null,
      l.medidas_coletadas && !medidas ? `Medidas coletadas: ${l.medidas_coletadas}` : null,
      l.ultimo_valor_cotado ? `Último valor cotado pela IA: ${l.ultimo_valor_cotado}` : null,
      l.precisa_instalacao ? `Instalação: ${l.precisa_instalacao}` : null,
      l.endereco_cep ? `CEP: ${l.endereco_cep}` : null,
    ].filter(Boolean).join('\n'),
  }
}

function isForaDoHorario(dateStr: string | null) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(d)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase() ?? ''
  const isWeekend = weekday.startsWith('sáb') || weekday.startsWith('dom')
  return isWeekend || hour < HORA_INICIO || hour >= HORA_FIM
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

// ── Sistema de cores de status (paleta da marca) ──────────────────────────────
type StatusInfo = { badge: string; label: string; Icon: React.ElementType }

function getStatus(raw: string | null): StatusInfo {
  const s = raw?.toLowerCase().trim() ?? ''
  if (s === STATUS_CONVERTIDO || s === 'fechado')
    return { badge: 'bg-primary/15 text-primary border border-primary/30', label: 'Convertido', Icon: CheckCircle2 }
  if (s === STATUS_AGUARDANDO || s === 'aguardando_atendente' || s === 'transferido')
    return { badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30', label: 'Aguardando atendimento', Icon: Clock }
  if (s === 'qualificado')
    return { badge: 'bg-amber-400/15 text-amber-700 dark:text-amber-400 border border-amber-400/20', label: 'Qualificado', Icon: Circle }
  if (s === 'cotado')
    return { badge: 'bg-primary/20 text-primary border border-primary/25', label: 'Cotado', Icon: FileText }
  if (s === 'agendado')
    return { badge: 'bg-amber-600/15 text-amber-800 dark:text-amber-300 border border-amber-600/20', label: 'Agendado', Icon: CalendarCheck }
  if (s === 'em_atendimento' || s === 'em atendimento')
    return { badge: 'bg-amber-300/20 text-amber-700 dark:text-amber-400 border border-amber-300/30', label: 'Em atendimento', Icon: MessageCircle }
  if (s === 'perdido' || s === 'desistiu')
    return { badge: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20', label: 'Perdido', Icon: XCircle }
  if (s === 'fora_horario' || s === 'fora do horário' || s === 'fora horario')
    return { badge: 'bg-amber-400/15 text-amber-600 dark:text-amber-300 border border-amber-400/20', label: 'Fora do horário', Icon: Moon }
  if (!s || s === 'aguardando' || s === 'novo')
    return { badge: 'bg-muted text-muted-foreground', label: raw ? (raw.charAt(0).toUpperCase() + raw.slice(1)) : 'Sem status', Icon: Circle }
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
  { value: 'todos',  label: 'Tudo' },
  { value: 'hoje',   label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes',    label: 'Mês' },
  { value: 'custom', label: 'Período' },
]

function PeriodTabs({
  value, onChange, customFrom, customTo, onFromChange, onToChange,
}: {
  value: string
  onChange: (v: string) => void
  customFrom: string
  customTo: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
        {PERIODOS.map(({ value: v, label }) => (
          <button key={v} onClick={() => onChange(v)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all
              ${value === v ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>
      {value === 'custom' && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">De</span>
          <DatePicker value={customFrom} onChange={onFromChange} placeholder="Data inicial" max={customTo || undefined} />
          <span className="text-xs font-medium text-muted-foreground">até</span>
          <DatePicker value={customTo} onChange={onToChange} placeholder="Data final" min={customFrom || undefined} />
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, alcance, sub, attention, delay }: {
  label: string; value: string | number; icon: React.ElementType
  alcance?: boolean; attention?: boolean; sub?: string; delay: number
}) {
  return (
    <div
      className={`animate-in fade-in-0 slide-in-from-bottom-4 duration-500 rounded-xl border-2 p-4 shadow-sm transition-all duration-200 hover:shadow-elevated cursor-default
        ${attention ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10'
        : alcance   ? 'border-primary/35 bg-primary/10 dark:bg-primary/15'
        :             'border-primary/20 bg-primary/5 dark:bg-primary/8'}`}
      style={{ animationFillMode: 'both', animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/70 truncate">{label}</p>
          <p className={`font-display mt-1.5 text-2xl font-bold tracking-tight truncate tabular-nums
            ${attention ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground/60 truncate">{sub}</p>}
        </div>
        <div className={`shrink-0 rounded-lg p-1.5
          ${attention ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : 'bg-primary/15 text-primary'}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

// ── Funil de conversão ───────────────────────────────────────────────────────
function FunnelChart({ stages }: { stages: { label: string; value: number; hint: string }[] }) {
  const max = stages[0]?.value ?? 0
  return (
    <div className="rounded-xl border-2 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Funil de conversão</h2>
        <span className="text-xs text-muted-foreground">no período selecionado</span>
      </div>
      <div className="space-y-2.5">
        {stages.map((s, i) => {
          const pct = max > 0 ? (s.value / max) * 100 : 0
          const pctLabel = max > 0 ? `${Math.round(pct)}%` : '—'
          return (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-xs font-medium text-muted-foreground truncate" title={s.hint}>{s.label}</span>
              <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-muted/50">
                <div
                  className="h-full rounded-lg bg-primary transition-all duration-500"
                  style={{ width: `${Math.max(pct, s.value > 0 ? 4 : 0)}%`, opacity: 1 - i * 0.16 }}
                />
                <span className="absolute inset-y-0 left-2.5 flex items-center text-xs font-bold tabular-nums text-foreground mix-blend-luminosity">
                  {s.value}
                </span>
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i === 0 ? '100%' : pctLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type LeadSort = { key: 'created_at' | 'nome' | 'timestamp_ultima_msg'; dir: 'asc' | 'desc' }
type OrcSort  = { key: 'created_at' | 'modelo' | 'valor'; dir: 'asc' | 'desc' }

// ── Componente principal ─────────────────────────────────────────────────────
/** Rótulo de bloco do painel do lead — um estilo só pra todos */
function RotuloPainel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-foreground/45">
      {children}
    </p>
  )
}

/** Campo do painel: some quando está vazio, sem deixar buraco no grid */
function CampoLead({ rotulo, valor, destaque }: {
  rotulo: string
  valor: string | number | null | undefined
  destaque?: boolean
}) {
  if (valor == null || valor === '') return null
  return (
    <div className="min-w-0">
      <dt className="mb-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className={cn('truncate text-sm', destaque ? 'font-bold tabular-nums text-primary' : 'font-medium')}
        title={String(valor)}>
        {valor}
      </dd>
    </div>
  )
}

export default function TabAgenteIA({ resetKey }: { resetKey?: number } = {}) {
  const { data: leads = [], isLoading: loadingCrm, isError: errorCrm, refetch: refetchCrm } = useCrmLeads()
  const { data: orcamentosIA = [], isLoading: loadingOrc, isError: errorOrc, refetch: refetchOrc } = useOrcamentosIA()
  const { mutate: marcarConvertido, isPending: marcando } = useMarcarConvertido()
  const { toasts, toast, dismiss } = useToast()
  const { data: perfil } = useProfile()
  const ehAdmin = perfil?.email === ADMIN_EMAIL || perfil?.is_admin === true

  const [periodo, setPeriodo] = useState('todos')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [leadSort, setLeadSort] = useState<LeadSort>({ key: 'created_at', dir: 'desc' })
  const [orcSort,  setOrcSort]  = useState<OrcSort>({  key: 'created_at', dir: 'desc' })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [mobileConfirmId, setMobileConfirmId] = useState<string | null>(null)
  const [leadsPage, setLeadsPage] = useState(1)
  const [orcsPage, setOrcsPage] = useState(1)
  const [leadsCollapsed, setLeadsCollapsed] = useState(false)
  const [orcsCollapsed, setOrcsCollapsed] = useState(false)
  const [leadOrcamento, setLeadOrcamento] = useState<CrmLead | null>(null)
  const [orcFechado, setOrcFechado] = useState(false)

  // Orçamentos da IA indexados por lead (cliente_id FK + identificador_whats)
  const orcsPorLead = useMemo(() => {
    const map = new Map<string, OrcamentoIA[]>()
    const add = (key: string, o: OrcamentoIA) => {
      const arr = map.get(key)
      if (arr) { if (!arr.some(x => x.id === o.id)) arr.push(o) }
      else map.set(key, [o])
    }
    for (const o of orcamentosIA) {
      if (o.cliente_id) add(`id:${o.cliente_id}`, o)
      const wa = o.identificador_whats?.replace(/\D/g, '')
      if (wa) add(`wa:${wa}`, o)
    }
    return map
  }, [orcamentosIA])

  function orcsDoLead(lead: CrmLead): OrcamentoIA[] {
    const byId = orcsPorLead.get(`id:${lead.id}`) ?? []
    const wa = (lead.whatsapp ?? lead.identificador_usuario ?? '').replace(/\D/g, '')
    const byWa = wa ? (orcsPorLead.get(`wa:${wa}`) ?? []) : []
    const seen = new Set<string>()
    return [...byId, ...byWa].filter(o => (seen.has(o.id) ? false : (seen.add(o.id), true)))
  }

  const initialOrcamento = useMemo(
    () => (leadOrcamento ? leadToOrcamentoInitial(leadOrcamento) : undefined),
    [leadOrcamento]
  )

  // Reset pages when filters or sort changes
  useEffect(() => { setLeadsPage(1) }, [periodo, leadSort, customFrom, customTo])
  useEffect(() => { setOrcsPage(1) }, [periodo, orcSort, customFrom, customTo])
  useEffect(() => { setExpandedId(null) }, [leadsPage])

  // Track first data load — skip count-up re-animation on period changes
  const hasLoadedRef = useRef(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  useEffect(() => {
    if (!loadingCrm && !loadingOrc && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      const t = setTimeout(() => setHasLoaded(true), 1200)
      return () => clearTimeout(t)
    }
  }, [loadingCrm, loadingOrc])

  // Conversas históricas do WhatsApp da loja (status_lead='historico') existem para a
  // leitura da IA — ficam FORA dos KPIs, do funil e da lista da operação viva da Stella,
  // senão meses de conversa antiga distorceriam as métricas do atendimento atual.
  const { leadsVivos, historicos } = useMemo(() => {
    const eHistorico = (l: CrmLead) => (l.status_lead ?? '').toLowerCase().trim() === 'historico'
    return { leadsVivos: leads.filter(l => !eHistorico(l)), historicos: leads.filter(eHistorico) }
  }, [leads])

  // O período do lead é a ATIVIDADE (última mensagem), não a criação da linha:
  // um cliente antigo que volta a escrever hoje precisa aparecer em "hoje" — a linha
  // dele pode ter sido criada meses atrás (importação do histórico da loja).
  const dataAtividade = (l: CrmLead): string => {
    const ultima = l.timestamp_ultima_msg ? new Date(l.timestamp_ultima_msg).getTime() : NaN
    const criada = new Date(l.created_at).getTime()
    return Number.isFinite(ultima) && ultima > criada ? (l.timestamp_ultima_msg as string) : l.created_at
  }

  const filtrados = useMemo(
    () => filterByPeriod(leadsVivos, periodo, dataAtividade, customFrom || undefined, customTo || undefined),
    [leadsVivos, periodo, customFrom, customTo]
  )
  const orcFiltrados = useMemo(
    () => filterByPeriod(orcamentosIA, periodo, (o) => o.created_at, customFrom || undefined, customTo || undefined),
    [orcamentosIA, periodo, customFrom, customTo]
  )

  // KPIs
  const { aguardando, convertidos, comMedicao, foraLeads, foraMsgs, mensagensTotais, valorTotal } = useMemo(() => ({
    aguardando:      filtrados.filter((l) => isAguardando(l.status_lead)),
    convertidos:     filtrados.filter((l) => isConvertido(l.status_lead)),
    comMedicao:      filtrados.filter((l) => !!l.data_medicao_instalacao?.trim()),
    foraLeads:       filtrados.filter((l) => isForaDoHorario(l.created_at)),
    foraMsgs:        filtrados.filter((l) => isForaDoHorario(l.timestamp_ultima_msg)),
    mensagensTotais: filtrados.filter((l) => !!l.timestamp_ultima_msg).length,
    valorTotal:      orcFiltrados.reduce((s, o) =>
      s + (o.valor_venda_total_base ?? 0) + (o.valor_venda_acabamento_total ?? 0) + (o.valor_colocacao ?? 0), 0),
  }), [filtrados, orcFiltrados])

  const leadsEmEspera = useMemo(() =>
    filtrados.filter(l => {
      const status = l.status_lead?.toLowerCase().trim() ?? ''
      const convertido = status === 'convertido' || status === 'fechado'
      return !convertido && horasDecorridas(l.timestamp_ultima_msg) > ESPERA_HORAS
    }), [filtrados])

  // Funil: respondidos → cotados → pediram humano → convertidos
  const cotados = useMemo(
    () => filtrados.filter(l => !!l.ultimo_valor_cotado?.trim() || orcsDoLead(l).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtrados, orcsPorLead]
  )
  const funnelStages = useMemo(() => [
    { label: 'Respondidos pelo agente', value: filtrados.length,   hint: 'Leads atendidos pela IA no período' },
    { label: 'Receberam cotação',       value: cotados.length,     hint: 'Leads com valor cotado ou orçamento gerado' },
    { label: 'Pediram atendimento',     value: aguardando.length,  hint: 'Querem falar com um humano' },
    { label: 'Convertidos',             value: convertidos.length, hint: 'Marcados como convertidos' },
  ], [filtrados.length, cotados.length, aguardando.length, convertidos.length])

  const animLeads      = useCountUp(filtrados.length, 700, hasLoaded, resetKey)
  const animAguard     = useCountUp(aguardando.length, 700, hasLoaded, resetKey)
  const animConv       = useCountUp(convertidos.length, 750, hasLoaded, resetKey)
  const animValor      = useCountUp(valorTotal, 900, hasLoaded, resetKey)
  const animMed        = useCountUp(comMedicao.length, 750, hasLoaded, resetKey)
  const animForaLeads  = useCountUp(foraLeads.length, 700, hasLoaded, resetKey)
  const animMsgs       = useCountUp(mensagensTotais, 750, hasLoaded, resetKey)
  const animForaMsgs   = useCountUp(foraMsgs.length, 700, hasLoaded, resetKey)
  const animEspera     = useCountUp(leadsEmEspera.length, 700, hasLoaded, resetKey)

  const alcanceKpis = [
    { label: 'Pessoas respondidas',      value: Math.round(animLeads),     icon: Users,         alcance: true,  sub: 'atendidas pelo agente' },
    { label: 'Pessoas fora do horário',  value: Math.round(animForaLeads), icon: Moon,          alcance: true,  sub: 'entraram fora do comercial' },
    { label: 'Mensagens no total',       value: Math.round(animMsgs),      icon: MessageSquare, alcance: true,  sub: 'conversas com troca de msgs' },
    { label: 'Msgs fora do horário',     value: Math.round(animForaMsgs),  icon: MessageCircle, alcance: true,  sub: 'última msg fora do comercial' },
  ]

  const opKpis = [
    { label: 'Aguardando atendimento', value: Math.round(animAguard),  icon: Bell,          attention: true,  sub: 'querem atendimento humano' },
    { label: 'Convertidos',            value: Math.round(animConv),    icon: CheckCircle2,  attention: false, sub: `de ${filtrados.length} leads` },
    { label: 'Valor cotado (IA)',       value: valorTotal > 0 ? formatCurrency(animValor) : '—', icon: DollarSign, attention: false, sub: `${orcFiltrados.length} orçamento${orcFiltrados.length !== 1 ? 's' : ''}` },
    { label: 'Medições agendadas',     value: Math.round(animMed),     icon: CalendarCheck, attention: false, sub: 'com data marcada' },
    { label: 'Em espera',              value: String(Math.round(animEspera)), icon: Clock, attention: leadsEmEspera.length > 0, sub: `aguardando +${ESPERA_HORAS}h` },
  ]

  const sortedLeads = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      const wa = isAguardando(a.status_lead) ? -1 : 0
      const wb = isAguardando(b.status_lead) ? -1 : 0
      if (wa !== wb) return wa - wb
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

  // ── Th helpers ───────────────────────────────────────────────────────────────
  function LeadTh({ label, k }: { label: string; k?: 'created_at' | 'nome' | 'timestamp_ultima_msg' }) {
    const active = k && leadSort.key === k
    return (
      <th className={`px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap border-r border-border/30 last:border-r-0 ${k ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
        onClick={() => k && setLeadSort(s => s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' })}>
        <span className="inline-flex items-center gap-1 justify-center">
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
      <th className={`px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap border-r border-border/30 last:border-r-0 ${k ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
        onClick={() => k && setOrcSort(s => s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' })}>
        <span className="inline-flex items-center gap-1 justify-center">
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
        <div className="kpi-cascade grid grid-cols-2 gap-3 lg:grid-cols-4">
          {alcanceKpis.map(({ label, value, icon, alcance, sub }, i) => (
            <KpiCard key={label} label={label} value={value} icon={icon}
              alcance={alcance} sub={sub} delay={i * 80} />
          ))}
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-0.5 pt-1">Operacional</p>
        <div className="kpi-cascade grid grid-cols-2 gap-3 lg:grid-cols-5">
          {opKpis.map(({ label, value, icon, attention, sub }, i) => (
            <KpiCard key={label} label={label} value={value} icon={icon}
              attention={attention} sub={sub} delay={i * 80 + 320} />
          ))}
        </div>
      </div>

      {/* ── Funil de conversão ── */}
      <FunnelChart stages={funnelStages} />

      {/* ── Veredito da IA por conversa (venda / negociação / perdida + motivo) ──
           inclui as históricas de propósito: são o material mais rico de leitura */}
      <ClassificadorConversas leads={[...filtrados, ...historicos]} toast={toast} />

      {/* ── Insights da Stella (síntese das conversas via Gemini) ── */}
      <InsightsStella leads={leads} orcamentosIA={orcamentosIA} toast={toast} />

      {/* ── Follow-up automático (só admin controla) ── */}
      {ehAdmin && <FollowupControle toast={toast} />}

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

      {/* ── Seletor de Período — centralizado ── */}
      <div className="flex justify-center py-1">
        <PeriodTabs
          value={periodo}
          onChange={(v) => { setPeriodo(v); if (v !== 'custom') { setCustomFrom(''); setCustomTo('') } }}
          customFrom={customFrom}
          customTo={customTo}
          onFromChange={setCustomFrom}
          onToChange={setCustomTo}
        />
      </div>

      {/* ── Tabela de Leads ── */}
      {errorCrm && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">Erro ao carregar leads do CRM.</p>
          </div>
          <button onClick={() => refetchCrm()} className="text-xs text-destructive underline hover:no-underline">Tentar novamente</button>
        </div>
      )}
      <div className="rounded-xl border-2 bg-card shadow-sm">
        {/* Header centralizado — clicável para colapsar */}
        <button
          type="button"
          onClick={() => setLeadsCollapsed(v => !v)}
          className="relative flex w-full items-center justify-center border-b px-5 py-4 hover:bg-muted/30 transition-colors rounded-t-xl"
        >
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold tracking-wide">Leads do Agente IA</h2>
            <span className="text-xs text-muted-foreground">{filtrados.length} lead{filtrados.length !== 1 ? 's' : ''}</span>
          </div>
          <span className="absolute right-4 rounded-lg p-1.5 text-muted-foreground">
            {leadsCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </span>
        </button>

        {!leadsCollapsed && (
          filtrados.length === 0 ? (
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
                      <LeadTh label="Entrada"       k="created_at" />
                      <LeadTh label="Nome"           k="nome" />
                      <th className="whitespace-nowrap border-r border-border/30 px-4 py-3 text-center text-xs font-semibold text-muted-foreground">WhatsApp</th>
                      <th className="whitespace-nowrap border-r border-border/30 px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Modelo / Ambiente</th>
                      <th className="whitespace-nowrap border-r border-border/30 px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Último valor</th>
                      <LeadTh label="Últ. mensagem"  k="timestamp_ultima_msg" />
                      <th className="whitespace-nowrap border-r border-border/30 px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Ação</th>
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
                            <td className="px-4 py-3.5 text-center text-muted-foreground tabular-nums whitespace-nowrap border-r border-border/20">
                              <span className="block">{fmtDate(lead.created_at)}</span>
                              <span className="flex items-center justify-center gap-1 text-xs opacity-70">
                                {fmtTime(lead.created_at)}
                                {foraEntr && <Moon className="h-2.5 w-2.5 text-amber-500" />}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center font-medium border-r border-border/20">
                              <span className="block">{lead.nome ?? '—'}</span>
                              <SeloClassificacao lead={lead} className="mt-1" />
                            </td>
                            <td className="px-4 py-3.5 text-center border-r border-border/20" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                              {lead.whatsapp ? (
                                <span className="flex items-center justify-center gap-1.5">
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
                                    className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                                  >
                                    <MessageCircle className="h-3 w-3 shrink-0" />
                                    WA
                                  </a>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center border-r border-border/20" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                              <span className="block font-medium">{lead.modelo_interesse ?? '—'}</span>
                              {lead.ambiente && <span className="text-xs text-muted-foreground">{lead.ambiente}</span>}
                            </td>
                            <td className="px-4 py-3.5 text-center font-medium tabular-nums border-r border-border/20" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                              {lead.ultimo_valor_cotado && !isNaN(parseFloat(lead.ultimo_valor_cotado))
                                ? formatCurrency(parseFloat(lead.ultimo_valor_cotado))
                                : (lead.ultimo_valor_cotado ?? '—')}
                            </td>
                            <td className="px-4 py-3.5 text-center tabular-nums whitespace-nowrap border-r border-border/20" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                              <span className={`flex items-center justify-center gap-1 text-sm ${foraMsg ? 'text-amber-600 dark:text-amber-400' : emEspera ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                {emEspera && <Clock className="h-3 w-3 text-amber-500 shrink-0" />}
                                {fmtDate(lead.timestamp_ultima_msg)}
                              </span>
                              <span className="flex items-center justify-center gap-1 text-xs opacity-70">
                                {fmtTime(lead.timestamp_ultima_msg)}
                                {foraMsg && <MessageSquare className="h-2.5 w-2.5 text-amber-500" />}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center border-r border-border/20" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                              <span
                                role="status"
                                aria-label={status.label}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${status.badge}`}
                              >
                                <status.Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                {status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <div className="inline-flex items-center gap-1.5 justify-center">
                                {!conv && (
                                  confirmId === lead.id ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          marcarConvertido(lead.id, {
                                            onError: () => toast('error', 'Erro ao marcar como convertido.'),
                                            onSuccess: () => {
                                              // já emenda o fechamento: form pré-preenchido salvando direto como fechado
                                              setOrcFechado(true)
                                              setLeadOrcamento(lead)
                                              toast('success', 'Convertido! Confira os dados e salve o orçamento fechado.')
                                            },
                                          })
                                          setConfirmId(null)
                                        }}
                                        disabled={marcando}
                                        className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
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
                                      title="Marca este lead como convertido no CRM. Para registrar o faturamento, feche o orçamento correspondente na aba Planilha."
                                      className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Converteu
                                    </button>
                                  )
                                )}
                                {chatwootUrl(lead) && (
                                  <a
                                    href={chatwootUrl(lead)!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Abrir conversa no Chatwoot"
                                    className="rounded-lg border p-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </a>
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
                              <td colSpan={8} className="px-6 py-5">
                                <div className="mx-auto w-full max-w-4xl space-y-4">
                                {lead.resumo_conversa && (
                                  <div className="rounded-xl border bg-card p-4">
                                    <RotuloPainel>Resumo da conversa</RotuloPainel>
                                    {/* prosa longa fica presa em ~70ch: a tabela é larga demais pra ler corrido */}
                                    <p className="max-w-[68ch] text-pretty text-sm leading-relaxed text-foreground/75">
                                      {lead.resumo_conversa}
                                    </p>
                                  </div>
                                )}

                                {/* auto-fit: os campos preenchem a linha em vez de deixar buraco */}
                                <dl className="grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
                                  <CampoLead rotulo="Medidas" valor={lead.medidas_coletadas} />
                                  <CampoLead rotulo="Tecido / Cor" valor={lead.tecido_cor} />
                                  <CampoLead rotulo="Acabamento" valor={lead.acabamento_desejado} />
                                  <CampoLead rotulo="Instalação" valor={lead.precisa_instalacao} />
                                  <CampoLead rotulo="Data medição" valor={lead.data_medicao_instalacao} destaque />
                                  <CampoLead rotulo="CEP" valor={lead.endereco_cep} />
                                  <CampoLead rotulo="Cidade" valor={lead.cidade} />
                                  <CampoLead rotulo="Tipo de imóvel" valor={lead.tipo_imovel} />
                                  <CampoLead rotulo="Quantidade" valor={lead.quantidade} />
                                  <CampoLead rotulo="Último valor cotado" valor={lead.ultimo_valor_cotado} destaque />
                                </dl>

                                {/* Orçamentos da IA vinculados a este lead */}
                                {(() => {
                                  const orcs = orcsDoLead(lead)
                                  if (orcs.length === 0) return null
                                  return (
                                    <div className="border-t border-border/40 pt-4">
                                      <RotuloPainel>Orçamentos da IA deste lead ({orcs.length})</RotuloPainel>
                                      <div className="flex flex-wrap gap-2">
                                        {orcs.map(o => {
                                          const total = (o.valor_venda_total_base ?? 0) + (o.valor_venda_acabamento_total ?? 0) + (o.valor_colocacao ?? 0)
                                          return (
                                            <span key={o.id}
                                              className="inline-flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-xs">
                                              <FileText className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                                              <span className="font-medium">{o.modelo ?? '—'}</span>
                                              {o.largura && o.altura && (
                                                <span className="tabular-nums text-muted-foreground">{o.largura}×{o.altura}m</span>
                                              )}
                                              {/* valor sempre no mesmo lugar: sem ele as pastilhas ficavam desencontradas */}
                                              <span className={cn('ml-auto tabular-nums',
                                                total > 0 ? 'font-bold text-primary' : 'text-muted-foreground/40')}>
                                                {total > 0 ? formatCurrency(total) : 'sem valor'}
                                              </span>
                                              <span className="tabular-nums text-muted-foreground/60">{fmtDate(o.created_at)}</span>
                                            </span>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })()}

                                {/* Ações do lead */}
                                <div className="flex flex-wrap justify-center gap-2 border-t border-border/40 pt-4">
                                  <Button size="sm"
                                    onClick={(e) => { e.stopPropagation(); setOrcFechado(false); setLeadOrcamento(lead) }}>
                                    <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    Criar orçamento com estes dados
                                  </Button>
                                  {chatwootUrl(lead) && (
                                    <a
                                      href={chatwootUrl(lead)!}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                      Ver conversa no Chatwoot
                                    </a>
                                  )}
                                </div>
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
                            <SeloClassificacao lead={lead} className="mt-1" />
                            {lead.whatsapp && (
                              <span className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-muted-foreground">{lead.whatsapp}</span>
                                <a
                                  href={`https://wa.me/${formatWaNumber(lead.whatsapp)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Abrir no WhatsApp"
                                  className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors"
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
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      marcarConvertido(lead.id, {
                                        onError: () => toast('error', 'Erro ao marcar como convertido.'),
                                        onSuccess: () => {
                                          setOrcFechado(true)
                                          setLeadOrcamento(lead)
                                          toast('success', 'Convertido! Confira os dados e salve o orçamento fechado.')
                                        },
                                      })
                                      setMobileConfirmId(null)
                                    }}
                                    disabled={marcando}
                                    className="rounded-lg bg-primary px-2 py-0.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
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
                                  title="Marca este lead como convertido no CRM. Para registrar o faturamento, feche o orçamento correspondente na aba Planilha."
                                  className="rounded-lg border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                                >
                                  <CheckCircle2 className="inline h-3 w-3 mr-0.5" />Converteu
                                </button>
                              )
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : lead.id) }}
                              aria-label={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                              title={expanded ? 'Recolher' : 'Expandir'}
                            >
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
                          <div className="flex flex-wrap gap-2 pt-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); setOrcFechado(false); setLeadOrcamento(lead) }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors active:scale-95"
                            >
                              <FilePlus2 className="h-3.5 w-3.5" />
                              Criar orçamento
                            </button>
                            {chatwootUrl(lead) && (
                              <a
                                href={chatwootUrl(lead)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Conversa
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Footer centralizado */}
              {(foraLeads.length > 0 || foraMsgs.length > 0) && (
                <div className="border-t px-5 py-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  {foraLeads.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Moon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span><span className="font-semibold text-foreground">{foraLeads.length}</span> pessoa{foraLeads.length !== 1 ? 's' : ''} entraram fora do horário comercial</span>
                    </span>
                  )}
                  {foraMsgs.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-amber-500 shrink-0" />
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
          )
        )}
      </div>

      {/* ── Tabela de Orçamentos IA ── */}
      {errorOrc && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">Erro ao carregar orçamentos do Agente IA.</p>
          </div>
          <button onClick={() => refetchOrc()} className="text-xs text-destructive underline hover:no-underline">Tentar novamente</button>
        </div>
      )}
      <div className="rounded-xl border-2 bg-card shadow-sm">
        {/* Header centralizado — clicável para colapsar */}
        <button
          type="button"
          onClick={() => setOrcsCollapsed(v => !v)}
          className="relative flex w-full items-center justify-center border-b px-5 py-4 hover:bg-muted/30 transition-colors rounded-t-xl"
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold tracking-wide">Orçamentos gerados pela IA</h2>
            <span className="text-xs text-muted-foreground">{orcFiltrados.length} orçamento{orcFiltrados.length !== 1 ? 's' : ''}</span>
          </div>
          <span className="absolute right-4 rounded-lg p-1.5 text-muted-foreground">
            {orcsCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </span>
        </button>

        {!orcsCollapsed && (
          orcFiltrados.length === 0 ? (
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground border-r border-border/30">Ambiente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground border-r border-border/30">Medidas / Qtd</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground border-r border-border/30">Tecido / Acab.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground border-r border-border/30">Custo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground border-r border-border/30">Valor venda</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground border-r border-border/30">Colocação</th>
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
                          <td className="px-4 py-3.5 text-center text-muted-foreground tabular-nums whitespace-nowrap border-r border-border/20">
                            <span className="block">{fmtDate(o.created_at)}</span>
                            <span className="text-xs opacity-70">{fmtTime(o.created_at)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-medium border-r border-border/20">{o.modelo ?? '—'}</td>
                          <td className="px-4 py-3.5 text-muted-foreground border-r border-border/20">{o.ambiente ?? '—'}</td>
                          <td className="px-4 py-3.5 text-center tabular-nums whitespace-nowrap border-r border-border/20">
                            <span className="block">
                              {o.largura && o.altura ? `${o.largura}×${o.altura}m` : '—'}
                              {o.quantidade && o.quantidade > 1 ? ` (×${o.quantidade})` : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center border-r border-border/20">
                            <span className="block">{o.tecido ?? '—'}</span>
                            {o.acabamento && <span className="text-xs text-muted-foreground">{o.acabamento}</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center tabular-nums text-muted-foreground border-r border-border/20">
                            {custoBase ? <span className="block">{custoBase}</span> : <span>—</span>}
                            {custoAcab && <span className="text-xs opacity-70">{custoAcab}</span>}
                          </td>
                          <td className="px-4 py-3.5 tabular-nums border-r border-border/20">{o.valor_venda_total_base != null ? formatCurrency((o.valor_venda_total_base ?? 0) + (o.valor_venda_acabamento_total ?? 0)) : '—'}</td>
                          <td className="px-4 py-3.5 text-center tabular-nums text-muted-foreground border-r border-border/20">{o.valor_colocacao != null ? formatCurrency(o.valor_colocacao) : '—'}</td>
                          <td className="px-4 py-3.5 font-bold text-primary tabular-nums">{total > 0 ? formatCurrency(total) : '—'}</td>
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

              {/* Footer centralizado */}
              <div className="border-t px-5 py-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
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
          )
        )}
      </div>
      {/* Lead → orçamento em 1 clique (fechado=true quando vem do botão Converteu) */}
      <NovoOrcamentoForm
        open={!!leadOrcamento}
        onClose={() => { setLeadOrcamento(null); setOrcFechado(false) }}
        toast={toast}
        initial={initialOrcamento}
        fonte="agente-ia"
        fechado={orcFechado}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
