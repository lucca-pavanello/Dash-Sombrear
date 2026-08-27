/**
 * A estante de resumos da IA — cada linha é um relatório pronto pra ler.
 *
 * Semanais e mensais chegam sozinhos (workflow n8n roda os números por código e
 * o Gemini escreve a prosa). Período avulso: a pessoa pede aqui e o resumo fica
 * pronto em até ~2 minutos — a lista se atualiza sozinha quando ele chega.
 */
import { useMemo, useState } from 'react'
import { CalendarRange, ChevronDown, FileText, Loader2, Sparkles } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Button, EmptyState } from '@/components/ui/primitives'
import DatePicker from '@/components/ui/DatePicker'
import {
  usePedidosPendentes, usePedirRelatorio, useRelatoriosIA,
  type KpisRelatorio, type RelatorioIA,
} from '@/hooks/useRelatoriosIA'

/**
 * DESIGN.md reserva emerald pra "fechado/ok" — um tipo de relatório não é um estado de
 * sucesso, então só semanal/mensal (categorias de verdade) ganham as duas cores
 * secundárias sancionadas (azul/violeta); ano e período avulso ficam neutros.
 */
const TIPO: Record<RelatorioIA['tipo'], { rotulo: string; classe: string }> = {
  semanal: { rotulo: 'Semana', classe: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  mensal:  { rotulo: 'Mês',    classe: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  anual:   { rotulo: 'Ano',    classe: 'border-border bg-muted/60 text-muted-foreground' },
  custom:  { rotulo: 'Período', classe: 'border-border bg-muted/60 text-muted-foreground' },
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function fmtDia(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1] ?? m}`
}

function fmtPeriodo(inicio: string, fim: string) {
  const anoIni = inicio.slice(0, 4)
  const anoFim = fim.slice(0, 4)
  const sufixo = anoFim !== String(new Date().getFullYear()) ? ` ${anoFim.slice(2)}` : ''
  if (inicio === fim) return `${fmtDia(inicio)}${sufixo}`
  if (anoIni !== anoFim) return `${fmtDia(inicio)} ${anoIni.slice(2)} – ${fmtDia(fim)} ${anoFim.slice(2)}`
  return `${fmtDia(inicio)} – ${fmtDia(fim)}${sufixo}`
}

/** Números do período em cards pequenos — só os que existem no relatório. */
function CardsKpi({ kpis }: { kpis: KpisRelatorio }) {
  const cards: { rotulo: string; valor: string; destaque?: boolean }[] = []
  const n = (v: number | null | undefined) => v != null && Number.isFinite(v)
  if (n(kpis.leads_novos)) cards.push({ rotulo: 'Leads novos', valor: String(kpis.leads_novos) })
  if (n(kpis.cotados)) cards.push({ rotulo: 'Orçados', valor: String(kpis.cotados) })
  if (n(kpis.fechados)) cards.push({ rotulo: 'Fecharam', valor: String(kpis.fechados), destaque: true })
  if (n(kpis.receita_fechada) && (kpis.receita_fechada ?? 0) > 0)
    cards.push({ rotulo: 'Receita', valor: formatCurrency(kpis.receita_fechada!), destaque: true })
  if (n(kpis.passados_pro_humano)) cards.push({ rotulo: 'Pro time', valor: String(kpis.passados_pro_humano) })
  if (n(kpis.perdidos_ou_sumiram)) cards.push({ rotulo: 'Perdidos', valor: String(kpis.perdidos_ou_sumiram) })
  if (n(kpis.aguardando_atendente_agora) && (kpis.aguardando_atendente_agora ?? 0) > 0)
    cards.push({ rotulo: 'Aguardando', valor: String(kpis.aguardando_atendente_agora) })
  if (n(kpis.sla_medio_horas)) cards.push({ rotulo: 'Resposta média', valor: `${kpis.sla_medio_horas}h` })
  if (cards.length === 0) return null

  const origens = Object.entries(kpis.por_origem ?? {}).filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  const temperaturas = Object.entries(kpis.por_temperatura ?? {}).filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap justify-center gap-2">
        {cards.map(c => (
          <div key={c.rotulo} className={cn(
            'min-w-[92px] flex-1 basis-24 rounded-lg border bg-background/60 px-2 py-1.5 text-center sm:max-w-[140px]',
            c.destaque && 'border-emerald-500/25 bg-emerald-500/[0.05]')}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40">{c.rotulo}</p>
            <p className={cn('text-sm font-bold tabular-nums',
              c.destaque && 'text-emerald-600 dark:text-emerald-400')}>{c.valor}</p>
          </div>
        ))}
      </div>
      {origens.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold">Origem:</span>{' '}
          {origens.map(([k, v]) => `${k} (${v})`).join(' · ')}
        </p>
      )}
      {temperaturas.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold">Temperatura:</span>{' '}
          {temperaturas.map(([k, v]) => `${k} (${v})`).join(' · ')}
        </p>
      )}
      {(kpis.objecoes_top?.length ?? 0) > 0 && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold">Objeções:</span> {kpis.objecoes_top!.join(' · ')}
        </p>
      )}
    </div>
  )
}

export default function ResumosIA() {
  const { data: relatorios = [], isLoading } = useRelatoriosIA()
  const { data: pendentes = [] } = usePedidosPendentes()
  const pedir = usePedirRelatorio()

  const [aberto, setAberto] = useState<string | null>(null)
  const [pedindo, setPedindo] = useState(false)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  const gerando = pendentes.length > 0

  const jaExiste = useMemo(
    () => relatorios.find(r => r.periodo_inicio === de && r.periodo_fim === ate),
    [relatorios, de, ate])

  async function gerar() {
    setAviso(null)
    if (!de || !ate) { setAviso('Escolha as duas datas.'); return }
    if (ate < de) { setAviso('A data final vem antes da inicial.'); return }
    if (jaExiste) {
      setAberto(jaExiste.id)
      setPedindo(false)
      setAviso(null)
      return
    }
    try {
      await pedir.mutateAsync({ inicio: de, fim: ate })
      setPedindo(false)
      setDe(''); setAte('')
    } catch {
      setAviso('Não deu para pedir agora — tenta de novo em instantes.')
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="font-display text-sm font-semibold tracking-wide">Resumos da IA</h3>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            escritos toda semana — ou do período que você pedir
          </span>
        </div>
        {!pedindo && (
          <Button variant="outline" onClick={() => { setPedindo(true); setAviso(null) }} disabled={gerando}>
            <CalendarRange className="h-4 w-4" aria-hidden="true" />
            Gerar de um período
          </Button>
        )}
      </div>

      {pedindo && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-5 py-3">
          <DatePicker value={de} onChange={setDe} placeholder="De" className="w-36" />
          <DatePicker value={ate} onChange={setAte} placeholder="Até" min={de || undefined} className="w-36" />
          <Button onClick={gerar} loading={pedir.isPending}>
            {jaExiste ? 'Abrir o que já existe' : 'Gerar resumo'}
          </Button>
          <Button variant="ghost" onClick={() => { setPedindo(false); setAviso(null) }}>Cancelar</Button>
          {aviso && <span className="text-xs font-medium text-destructive">{aviso}</span>}
          {jaExiste && !aviso && (
            <span className="text-xs text-muted-foreground">Esse período já tem resumo pronto.</span>
          )}
        </div>
      )}

      {gerando && (
        <div className="flex items-center justify-center gap-2 border-b bg-primary/[0.04] px-5 py-2.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
          <p className="text-xs font-medium text-foreground/70">
            Escrevendo o resumo… fica pronto em uns 2 minutos e aparece aqui sozinho.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : relatorios.length === 0 ? (
        <EmptyState icon={FileText} titulo="Nenhum resumo ainda"
          dica="Os semanais entram sozinhos toda segunda de manhã. Se quiser um agora, peça um período acima."
          className="px-6 py-10" />
      ) : (
        <ul className="divide-y divide-border/50">
          {relatorios.map(r => {
            const cfg = TIPO[r.tipo] ?? TIPO.custom
            const expandido = aberto === r.id
            const primeiraLinha = (r.texto ?? '').split('\n')[0]
            return (
              <li key={r.id}>
                <button type="button"
                  onClick={() => setAberto(expandido ? null : r.id)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-primary/[0.03]"
                  aria-expanded={expandido}>
                  <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', cfg.classe)}>
                    {cfg.rotulo}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtPeriodo(r.periodo_inicio, r.periodo_fim)}</span>
                  {!expandido && (
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{primeiraLinha}</span>
                  )}
                  <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform',
                    expandido && 'rotate-180')} aria-hidden="true" />
                </button>
                {expandido && (
                  <div className="border-t border-border/40 bg-muted/[0.15] px-5 py-4">
                    <p className="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                      {r.texto || 'Este resumo veio sem texto.'}
                    </p>
                    {r.kpis && <CardsKpi kpis={r.kpis} />}
                    <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      gerado em {new Date(r.gerado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
