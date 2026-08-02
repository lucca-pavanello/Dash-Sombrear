import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, Calculator, CircleDollarSign, Package, ShieldCheck, FileText, CheckCircle2, Clock, TrendingUp, Command } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useOrcamentos } from '@/hooks/useOrcamentos'
import { useCrmLeads } from '@/hooks/useAgenteIA'
import { usePresence } from '@/hooks/usePresence'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import CommandPalette from '@/components/shared/CommandPalette'
import AvatarInitials from '@/components/shared/AvatarInitials'
import { formatCurrency, cn } from '@/lib/utils'
import { ADMIN_EMAIL, ESTOQUE_EMAIL } from '@/lib/constants'

const CARD_CLS = 'group w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] bg-card border border-border rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-sm hover:shadow-2xl hover:border-primary/40 hover:-translate-y-1 transition-all flex flex-col items-center text-center relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
const ICON_WRAP_CLS = 'h-14 w-14 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-primary/10 flex items-center justify-center mb-4 md:mb-6 group-hover:bg-primary group-hover:scale-105 transition-all'
const ICON_CLS = 'h-7 w-7 md:h-10 md:w-10 text-primary group-hover:text-white transition-colors'

type Badge = { label: string; tone: 'primary' | 'amber' }

function AreaCard({ titulo, descricao, icon: Icon, onClick, badge }: {
  titulo: string; descricao: string; icon: typeof Calculator; onClick: () => void; badge?: Badge
}) {
  return (
    <button onClick={onClick} className={CARD_CLS}>
      {badge && (
        <span className={cn(
          'absolute top-4 right-4 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums',
          badge.tone === 'amber'
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            : 'bg-primary/12 text-primary'
        )}>
          {badge.label}
        </span>
      )}
      <div className={ICON_WRAP_CLS}>
        <Icon className={ICON_CLS} />
      </div>
      <h2 className="text-lg md:text-2xl font-bold text-foreground mb-2 md:mb-3">{titulo}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4 md:mb-8 max-w-xs mx-auto">{descricao}</p>
      <div className="mt-auto inline-flex items-center text-sm font-medium text-primary">
        Acessar
        <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  )
}

function saudacao(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function primeiroNome(profile: { full_name?: string | null; email?: string | null } | null | undefined): string {
  const raw = profile?.full_name?.trim() || profile?.email?.split('@')[0] || ''
  const nome = raw.split(/\s+/)[0]
  return nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : ''
}

function tempoAtras(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'agora'
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

function PulsoPill({ icon: Icon, valor, rotulo, atencao }: {
  icon: typeof FileText; valor: string; rotulo: string; atencao?: boolean
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-full border px-3.5 py-1.5 bg-card shadow-sm',
      atencao ? 'border-amber-500/40' : 'border-border'
    )}>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', atencao ? 'text-amber-500' : 'text-primary')} />
      <span className="text-sm font-bold tabular-nums text-foreground">{valor}</span>
      <span className="text-xs text-muted-foreground">{rotulo}</span>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { data: profile, isLoading } = useProfile()
  const { data: orcamentos = [] } = useOrcamentos()
  const { data: leads = [] } = useCrmLeads()
  const others = usePresence(profile ?? null, 'inicio')
  const { open: paletteOpen, close: closePalette } = useCommandPalette()

  useEffect(() => { document.title = 'Sombrear - Início' }, [])

  const isAdmin      = profile?.email === ADMIN_EMAIL || profile?.is_admin === true
  const canOrcamento = isAdmin || profile?.pode_orcamento === true
  const canEstoque   = isAdmin || profile?.pode_estoque === true || profile?.email === ESTOQUE_EMAIL
  const canAgenteIA  = isAdmin || profile?.pode_agente_ia === true
  const canPrecos    = isAdmin || profile?.pode_precos === true

  const noAccess = !isLoading && profile && !canOrcamento && !canEstoque && !canAgenteIA && !canPrecos && !isAdmin

  // ── Pulso do dia ──
  const pulso = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const semana = new Date(hoje); semana.setDate(semana.getDate() - 6)
    const deHoje = orcamentos.filter(o => new Date(o.created_at) >= hoje)
    const fechadosSemana = orcamentos.filter(o => o.fechado && new Date(o.created_at) >= semana)
    const cotadoHoje = deHoje.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instalacao ?? 0), 0)
    const aguardando = leads.filter(l => {
      const v = l.status_lead?.toLowerCase().trim() ?? ''
      return v === 'aguardando_atendimento' || v === 'aguardando_atendente' || v === 'transferido'
    })
    return { deHoje: deHoje.length, cotadoHoje, fechadosSemana: fechadosSemana.length, aguardando: aguardando.length }
  }, [orcamentos, leads])

  const recentes = useMemo(
    () => [...orcamentos]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4),
    [orcamentos]
  )

  const nome = primeiroNome(profile)
  const dataLonga = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      {/* Logo + saudação */}
      <div className="text-center mb-8 md:mb-12">
        <div className="inline-flex h-16 w-16 md:h-24 md:w-24 rounded-2xl md:rounded-3xl bg-brand-gradient items-center justify-center mb-4 md:mb-6 shadow-brand">
          <span className="text-white text-3xl md:text-5xl font-bold font-display tracking-tight">S</span>
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-bold text-foreground tracking-tight">
          {nome ? `${saudacao()}, ${nome}` : 'Sombrear'}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2 capitalize">{dataLonga}</p>

        {/* Presença: quem mais está no sistema agora */}
        {others.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <div className="flex -space-x-1.5">
              {others.slice(0, 3).map(u => <AvatarInitials key={u.id} name={u.name} size="xs" />)}
            </div>
            <span className="text-xs text-muted-foreground">
              {others.length === 1 ? `${others[0].name.split(' ')[0]} está online` : `${others.length} pessoas online`}
            </span>
          </div>
        )}
      </div>

      {/* Pulso do dia */}
      {(canOrcamento || canAgenteIA) && !noAccess && (
        <div className="flex flex-wrap justify-center gap-2 mb-8 md:mb-10">
          {canOrcamento && (
            <>
              <PulsoPill icon={FileText} valor={String(pulso.deHoje)} rotulo={pulso.deHoje === 1 ? 'orçamento hoje' : 'orçamentos hoje'} />
              {pulso.cotadoHoje > 0 && (
                <PulsoPill icon={TrendingUp} valor={formatCurrency(pulso.cotadoHoje)} rotulo="cotado hoje" />
              )}
              <PulsoPill icon={CheckCircle2} valor={String(pulso.fechadosSemana)} rotulo="fechados na semana" />
            </>
          )}
          {canAgenteIA && pulso.aguardando > 0 && (
            <PulsoPill icon={Clock} valor={String(pulso.aguardando)} rotulo="leads aguardando" atencao />
          )}
        </div>
      )}

      {noAccess ? (
        <div className="max-w-md w-full rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Acesso pendente</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sua conta ainda não possui permissões configuradas. Fale com o administrador do sistema.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 max-w-5xl w-full">
          {canOrcamento && (
            <AreaCard titulo="Orçamento" icon={Calculator}
              descricao="Calcular preços, gerar propostas, gerenciar planilhas de orçamento e custos."
              badge={pulso.deHoje > 0 ? { label: `${pulso.deHoje} hoje`, tone: 'primary' } : undefined}
              onClick={() => navigate('/orcamentos/calcular-orcamento')} />
          )}
          {canEstoque && (
            <AreaCard titulo="Estoque" icon={Package}
              descricao="Gerenciar produtos, fornecedores, registrar entradas, vendas e analisar performance."
              onClick={() => navigate('/estoque')} />
          )}
          {canAgenteIA && (
            <AreaCard titulo="Agente IA" icon={Bot}
              descricao="Acompanhar os leads do WhatsApp, conversas e orçamentos gerados pela IA."
              badge={pulso.aguardando > 0 ? { label: `${pulso.aguardando} aguardando`, tone: 'amber' } : undefined}
              onClick={() => navigate('/agente-ia')} />
          )}
          {canPrecos && (
            <AreaCard titulo="Tabela de Preços" icon={CircleDollarSign}
              descricao="Preços, promoções, simulador e o assistente — a fonte central dos orçamentos."
              onClick={() => navigate('/precos')} />
          )}
          {isAdmin && (
            <AreaCard titulo="Admin" icon={ShieldCheck}
              descricao="Gerenciar usuários, aprovar acessos e configurar permissões do sistema."
              onClick={() => navigate('/admin')} />
          )}
        </div>
      )}

      {/* Atividade recente */}
      {canOrcamento && !noAccess && recentes.length > 0 && (
        <div className="mt-8 md:mt-10 w-full max-w-5xl">
          <div className="rounded-2xl border border-border bg-card/60 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-50 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Atividade recente</p>
            </div>
            <div className="divide-y divide-border/50">
              {recentes.map(o => {
                const total = (o.valor_venda ?? 0) + (o.instalacao ?? 0)
                return (
                  <button
                    key={o.id}
                    onClick={() => navigate('/orcamentos/orcamentos')}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
                  >
                    <AvatarInitials name={o.responsavel} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      <span className="font-medium">{o.cliente ?? o.responsavel}</span>
                      <span className="text-muted-foreground"> · {o.modelo}</span>
                    </span>
                    {o.fechado && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                    {total > 0 && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">{formatCurrency(total)}</span>
                    )}
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{tempoAtras(o.created_at)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <p className="mt-10 flex items-center gap-1.5 text-xs text-muted-foreground/60">
        <Command className="h-3 w-3" />
        <kbd className="rounded border border-border bg-muted/50 px-1 py-0.5 text-[10px] font-semibold">K</kbd>
        busca rápida em qualquer tela · Sombrear — Sistema de Gestão
      </p>

      <CommandPalette open={paletteOpen} onClose={closePalette} orcamentos={orcamentos} />
    </div>
  )
}
