import { useState } from 'react'
import {
  ChevronDown, ChevronRight, ShoppingBag, Clock, BarChart2,
  ArrowLeftRight, TrendingUp, AlertTriangle,
  CircleCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { useSugestaoCompra } from '@/hooks/useEstoqueSugestao'
import { useEstoquePontoPedido } from '@/hooks/useEstoquePontoPedido'
import { useLeadTimeRows } from '@/hooks/useEstoqueLeadTime'
import { useEstoqueSugestoesMover } from '@/hooks/useEstoqueSugestoesMover'
import { useParetoData, useGiroAnual } from '@/hooks/useEstoqueAnalytics'
import ParetoChart from './dashboard/ParetoChart'
import TopAClassTable from './dashboard/TopAClassTable'
import RecalcularABCButton from './dashboard/RecalcularABCButton'
import GiroMensalChart from './analises/GiroMensalChart'
import type { ToastType } from '@/hooks/useToast'
import type { NivelAlerta } from './theme'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

function AbcBadge({ cls }: { cls: string | null }) {
  const c = cls ?? 'sem_dados'
  const style =
    c === 'A' ? 'bg-primary/10 text-primary' :
    c === 'B' ? 'bg-muted text-foreground' :
    c === 'C' ? 'bg-muted/60 text-muted-foreground' :
                'text-muted-foreground italic text-[10px]'
  return (
    <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold', style)}>
      {c === 'sem_dados' ? '—' : c}
    </span>
  )
}

function NivelBadge({ nivel }: { nivel: NivelAlerta }) {
  const style =
    nivel === 'ruptura' ? 'bg-red-100 text-red-700' :
    nivel === 'critico' ? 'bg-red-50 text-red-600' :
    nivel === 'atencao' ? 'bg-amber-100 text-amber-700' :
    nivel === 'ok'      ? 'bg-muted text-muted-foreground' :
                          'text-muted-foreground italic'
  const labels: Record<NivelAlerta, string> = {
    ruptura: 'Ruptura', critico: 'Crítico', atencao: 'Atenção', ok: 'OK', sem_dados: '—',
  }
  return (
    <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold', style)}>
      {labels[nivel]}
    </span>
  )
}

// ─── Seção collapsável ─────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
        <span className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  toast: (type: ToastType, message: string) => void
  onDrillDown: (tab: 'lead-time' | 'mover' | 'sugestao' | 'ponto-pedido') => void
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AnalisesUnificadas({ toast, onDrillDown }: Props) {
  return (
    <div className="space-y-4">
      {/* Header da página */}
      <div>
        <h3 className="font-display text-base font-semibold">Análises de Estoque</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          O sistema olha seus dados e te diz o que fazer. Veja abaixo o que ele descobriu.
        </p>
      </div>

      {/* S1 — O que comprar agora */}
      <SecaoSugestaoCompra onVerTodos={() => onDrillDown('sugestao')} />

      {/* S2 — Quando comprar */}
      <SecaoPontoPedido onVerTodos={() => onDrillDown('ponto-pedido')} />

      {/* S3 — O que está parado */}
      <SecaoLeadTime onVerTodos={() => onDrillDown('lead-time')} />

      {/* S4 — O que mais vende */}
      <SecaoCurvaAbc toast={toast} />

      {/* S5 — Como reorganizar */}
      <SecaoReorganizar onVerTodos={() => onDrillDown('mover')} />

      {/* S6 — Evolução do giro */}
      <SecaoGiroMensal />
    </div>
  )
}

// ─── S1: Sugestão de Compra ───────────────────────────────────────────────────

function SecaoSugestaoCompra({ onVerTodos }: { onVerTodos: () => void }) {
  const { data = [], isLoading } = useSugestaoCompra()
  const naoOk = data.filter(r => r.urgencia !== 'ok')
  const criticos = data.filter(r => r.urgencia === 'critico').length
  const totalEstimado = naoOk.reduce((s, r) => s + r.custo_estimado, 0)
  const top10 = naoOk.slice(0, 10)

  const badge = isLoading ? null : (
    <span className={cn(
      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
      criticos > 0 ? 'bg-red-100 text-red-700' : naoOk.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
    )}>
      {naoOk.length === 0 ? 'Tudo OK' : `${naoOk.length} produto${naoOk.length !== 1 ? 's' : ''}`}
    </span>
  )

  return (
    <Section
      icon={<ShoppingBag className="h-4 w-4" />}
      title={<InfoTooltip label="O que comprar agora" tip="Os produtos mais importantes que estão acabando e precisam de reposição." />}
      subtitle={isLoading ? 'Carregando...' : naoOk.length === 0 ? 'Nenhum produto precisa de reposição agora.' : `${naoOk.length} precisam de reposição · ${fmtBRL(totalEstimado)} estimado`}
      badge={badge}
      defaultOpen
    >
      {isLoading ? (
        <div className="p-4 space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg skeleton-shimmer" />)}
        </div>
      ) : top10.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <CircleCheck className="h-4 w-4" />
          Nenhum produto abaixo do ideal.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Urgência</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">SKU</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Nome</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Estoque</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                    <InfoTooltip label="LEC" tip="Lote Econômico de Compra. Quantidade ideal a comprar de cada vez pra gastar menos com pedidos e armazenagem. Calculado pelo sistema com base nas vendas dos últimos 12 meses." />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Fornecedor</th>
                </tr>
              </thead>
              <tbody>
                {top10.map(r => {
                  const ub: Record<string, string> = {
                    critico:       'bg-red-100 text-red-700',
                    abaixo_minimo: 'bg-amber-100 text-amber-700',
                    atencao:       'bg-amber-50 text-amber-600',
                    ok:            'bg-muted text-muted-foreground',
                  }
                  const ul: Record<string, string> = {
                    critico: 'Crítico', abaixo_minimo: 'Ab. mínimo', atencao: 'Atenção', ok: 'OK',
                  }
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2">
                        <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold', ub[r.urgencia] ?? '')}>
                          {ul[r.urgencia] ?? r.urgencia}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{r.codigo ?? '—'}</td>
                      <td className="px-3 py-2 font-medium max-w-[140px] truncate">{r.nome}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.quantidade_atual)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-primary">{fmtNum(r.lec_sugerido)}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{r.fornecedor_nome ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-2">
            <span className="text-xs text-muted-foreground">{data.length} produtos classe A analisados</span>
            <button
              onClick={onVerTodos}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver todos →
            </button>
          </div>
        </>
      )}
    </Section>
  )
}

// ─── S2: Ponto de Pedido ──────────────────────────────────────────────────────

function SecaoPontoPedido({ onVerTodos }: { onVerTodos: () => void }) {
  const { data = [], isLoading } = useEstoquePontoPedido()
  const alertas = data.filter(r => r.nivel_alerta !== 'ok' && r.nivel_alerta !== 'sem_dados')
  const rupturas = alertas.filter(r => r.nivel_alerta === 'ruptura').length
  const top10 = alertas.slice(0, 10)

  const badge = isLoading ? null : (
    <span className={cn(
      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
      rupturas > 0 ? 'bg-red-100 text-red-700' : alertas.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
    )}>
      {alertas.length === 0 ? 'Tudo OK' : `${alertas.length} produto${alertas.length !== 1 ? 's' : ''}`}
    </span>
  )

  return (
    <Section
      icon={<AlertTriangle className="h-4 w-4" />}
      title={<InfoTooltip label="Quando comprar" tip="O nível de estoque em que o sistema avisa: 'compra agora!'. Se você esperar mais, vai faltar produto antes do pedido chegar." />}
      subtitle={isLoading ? 'Carregando...' : alertas.length === 0 ? 'Nenhum produto abaixo do ponto de pedido.' : `${alertas.length} produto${alertas.length !== 1 ? 's' : ''} abaixo do ponto de pedido`}
      badge={badge}
      defaultOpen
    >
      {isLoading ? (
        <div className="p-4 space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg skeleton-shimmer" />)}
        </div>
      ) : top10.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <CircleCheck className="h-4 w-4" />
          Todos os produtos estão acima do ponto de pedido.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Alerta</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">SKU</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Nome</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Classe</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Estoque</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                    <InfoTooltip label="Ponto de Pedido" tip="O nível de estoque em que o sistema avisa: 'compra agora!'. Se esperar mais, o produto vai faltar antes do pedido chegar." />
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {top10.map(r => (
                  <tr key={r.produto_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2">
                      <NivelBadge nivel={r.nivel_alerta} />
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{r.sku ?? '—'}</td>
                    <td className="px-3 py-2 font-medium max-w-[140px] truncate">{r.nome}</td>
                    <td className="px-3 py-2 text-center"><AbcBadge cls={r.classe_abc} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.estoque_atual)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.ponto_pedido)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.cobertura_dias > 0 ? `${r.cobertura_dias}d` : <span className="text-destructive font-semibold">Ruptura</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-2">
            <span className="text-xs text-muted-foreground">{data.length} produtos analisados</span>
            <button onClick={onVerTodos} className="text-xs font-semibold text-primary hover:underline">
              Ver todos →
            </button>
          </div>
        </>
      )}
    </Section>
  )
}

// ─── S3: Lead Time ────────────────────────────────────────────────────────────

function SecaoLeadTime({ onVerTodos }: { onVerTodos: () => void }) {
  const { data: rows = [], isLoading } = useLeadTimeRows()
  const comEstoque = rows.filter(r => r.quantidade_atual > 0)
  const top10 = comEstoque.slice(0, 10)
  const valorTotal = rows.reduce((s, r) => s + Number(r.valor_parado_reais ?? 0), 0)

  const badge = isLoading ? null : (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
      {formatCurrency(valorTotal)} parado
    </span>
  )

  return (
    <Section
      icon={<Clock className="h-4 w-4" />}
      title={<InfoTooltip label="O que está parado" tip="Tempo médio que o produto fica parado em estoque entre comprar e vender. Quanto maior, mais dinheiro empatado." />}
      subtitle="Produtos sentados há mais tempo no estoque. Cada dia parado é dinheiro empatado."
      badge={badge}
    >
      {isLoading ? (
        <div className="p-4 space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg skeleton-shimmer" />)}
        </div>
      ) : top10.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          Nenhum produto com estoque ativo.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Nome</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Classe</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Dias parado</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Valor parado</th>
                </tr>
              </thead>
              <tbody>
                {top10.map(r => {
                  const dias = r.dias_em_estoque ?? 0
                  const diasCls = dias > 180 ? 'text-red-600 font-semibold' : dias > 90 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'
                  return (
                    <tr key={r.produto_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 font-medium max-w-[180px] truncate">{r.nome}</td>
                      <td className="px-3 py-2 text-center"><AbcBadge cls={r.classificacao_abc} /></td>
                      <td className={cn('px-3 py-2 text-right tabular-nums', diasCls)}>
                        {r.dias_em_estoque !== null ? `${r.dias_em_estoque}d` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.valor_parado_reais !== null ? formatCurrency(Number(r.valor_parado_reais)) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-2">
            <span className="text-xs text-muted-foreground">{comEstoque.length} produtos com estoque</span>
            <button onClick={onVerTodos} className="text-xs font-semibold text-primary hover:underline">
              Ver todos →
            </button>
          </div>
        </>
      )}
    </Section>
  )
}

// ─── S4: Curva ABC / Pareto ───────────────────────────────────────────────────

function SecaoCurvaAbc({ toast }: { toast: (type: ToastType, message: string) => void }) {
  const { data: paretoData, isLoading } = useParetoData()
  const hasData = (paretoData?.totalVendas ?? 0) >= 5

  return (
    <Section
      icon={<BarChart2 className="h-4 w-4" />}
      title={<InfoTooltip label="O que mais vende" tip="Classifica produtos pelo quanto geram de receita. Classe A = 20% dos produtos que dão 80% do dinheiro. Princípio de Pareto." />}
      subtitle="Os produtos que mais geram dinheiro pra você. Foco neles."
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Curva ABC — Top 20 produtos (últimos 90 dias)</p>
          <RecalcularABCButton toast={toast} />
        </div>
        {!hasData && !isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Registre pelo menos 5 vendas para ver a Curva ABC.
          </div>
        ) : (
          <>
            <ParetoChart items={paretoData?.items ?? []} isLoading={isLoading} />
            <TopAClassTable items={paretoData?.items ?? []} isLoading={isLoading} />
          </>
        )}
      </div>
    </Section>
  )
}

// ─── S5: Reorganizar ─────────────────────────────────────────────────────────

function SecaoReorganizar({ onVerTodos }: { onVerTodos: () => void }) {
  const { data: sugestoes = [], isLoading } = useEstoqueSugestoesMover()
  const top10 = sugestoes.slice(0, 10)

  const badge = isLoading ? null : (
    <span className={cn(
      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
      sugestoes.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
    )}>
      {sugestoes.length === 0 ? 'Tudo OK' : `${sugestoes.length} sugestão${sugestoes.length !== 1 ? 'ões' : ''}`}
    </span>
  )

  return (
    <Section
      icon={<ArrowLeftRight className="h-4 w-4" />}
      title="Como reorganizar a loja"
      subtitle="Sugestões pra deixar os produtos mais vendidos perto do balcão."
      badge={badge}
    >
      {isLoading ? (
        <div className="p-4 space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg skeleton-shimmer" />)}
        </div>
      ) : top10.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <CircleCheck className="h-4 w-4" />
          Todos os produtos estão bem alocados.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Nome</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Classe</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Local atual</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Sugestão</th>
                </tr>
              </thead>
              <tbody>
                {top10.map(s => (
                  <tr key={s.produto_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-medium max-w-[140px] truncate">{s.nome}</td>
                    <td className="px-3 py-2 text-center"><AbcBadge cls={s.classe_abc} /></td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{s.localizacao_codigo}</td>
                    <td className="px-3 py-2 text-amber-600 font-medium">{s.nivel_sugerido}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-2">
            <span className="text-xs text-muted-foreground">{sugestoes.length} sugestão{sugestoes.length !== 1 ? 'ões' : ''}</span>
            <button onClick={onVerTodos} className="text-xs font-semibold text-primary hover:underline">
              Ver todos →
            </button>
          </div>
        </>
      )}
    </Section>
  )
}

// ─── S6: Giro Mensal ─────────────────────────────────────────────────────────

function SecaoGiroMensal() {
  const { data: giro } = useGiroAnual()

  const fmtGiro = (v: number) =>
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

  return (
    <Section
      icon={<TrendingUp className="h-4 w-4" />}
      title={<InfoTooltip label="Evolução do giro" tip="Quantas vezes seu estoque inteiro é vendido e reposto num ano. Giro 6 = você 'troca' o estoque 6× por ano. Quanto maior, melhor." />}
      subtitle="Quantas vezes seu estoque girou em cada mês do último ano."
    >
      <div className="p-4 space-y-3">
        {giro && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              <InfoTooltip label="Giro anual" tip="Quantas vezes seu estoque inteiro é vendido e reposto num ano. Giro 6 = você 'troca' o estoque 6× por ano. Quanto maior, melhor." />
              {': '}
              <strong className="text-foreground">{fmtGiro(giro.giro_reais)}×</strong>
            </span>
            <span>
              <InfoTooltip label="Estoque médio" tip="Quanto produto, em média, você tem parado no estoque ao longo do ano. Quanto menor, mais eficiente é seu capital." />
              {': '}
              <strong className="text-foreground">{fmtBRL(giro.estoque_atual_reais)}</strong>
            </span>
          </div>
        )}
        <GiroMensalChart />
      </div>
    </Section>
  )
}
