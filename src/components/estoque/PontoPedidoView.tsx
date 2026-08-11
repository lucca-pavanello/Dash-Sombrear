import { useState } from 'react'
import { AlertTriangle, AlertOctagon, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import KpiCard from '@/components/shared/KpiCard'
import { useEstoquePontoPedido } from '@/hooks/useEstoquePontoPedido'
import { ClasseABC } from './shared/ClasseABC'
import type { NivelAlerta } from './theme'
import type { ToastType } from '@/hooks/useToast'
import { CustomSelect } from '@/components/ui/CustomSelect'

const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

// ─── Badges ───────────────────────────────────────────────────────────────────

const NIVEL_ROW: Record<NivelAlerta, string> = {
  ruptura:  'bg-destructive/[0.07] dark:bg-destructive/[0.12]',
  critico:  'bg-destructive/[0.04] dark:bg-destructive/[0.07]',
  atencao:  'bg-muted/50',
  ok:       '',
  sem_dados:'',
}

const NIVEL_BADGE_CLS: Record<NivelAlerta, string> = {
  ruptura:  'bg-destructive/10 text-destructive',
  critico:  'bg-destructive/10 text-destructive',
  atencao:  'bg-muted text-foreground',
  ok:       'bg-muted text-muted-foreground',
  sem_dados:'text-muted-foreground italic',
}

const NIVEL_LABEL: Record<NivelAlerta, string> = {
  ruptura:  'Ruptura',
  critico:  'Crítico',
  atencao:  'Atenção',
  ok:       'OK',
  sem_dados:'—',
}


// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toast: (type: ToastType, message: string) => void
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PontoPedidoView(_: Props) {
  const { data = [], isLoading } = useEstoquePontoPedido()
  const [filtroNivel, setFiltroNivel] = useState<string>('todos')

  const rupturas  = data.filter(r => r.nivel_alerta === 'ruptura').length
  const criticos  = data.filter(r => r.nivel_alerta === 'critico').length
  const atencoes  = data.filter(r => r.nivel_alerta === 'atencao').length

  const filtered = filtroNivel === 'todos'
    ? data
    : data.filter(r => r.nivel_alerta === filtroNivel)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <h3 className="font-display text-base font-semibold">
          <InfoTooltip
            label="Quando comprar — detalhe completo"
            tip="O nível de estoque em que o sistema avisa: 'compra agora!'. Se esperar mais, o produto vai faltar antes do pedido chegar."
          />
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          O sistema avisa o momento exato de fazer o pedido pra cada produto.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Total analisado"
          value={isLoading ? '—' : data.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant="default"
          subtitle="produtos ativos"
        />
        <KpiCard
          title="Em ruptura"
          value={isLoading ? '—' : rupturas}
          icon={<AlertOctagon className="h-4 w-4" />}
          variant={rupturas > 0 ? 'orange' : 'default'}
          subtitle="estoque zerado"
        />
        <KpiCard
          title="Críticos"
          value={isLoading ? '—' : criticos}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={criticos > 0 ? 'orange' : 'default'}
          subtitle="abaixo do estoque de segurança"
        />
        <KpiCard
          title="Em atenção"
          value={isLoading ? '—' : atencoes}
          icon={<CircleCheck className="h-4 w-4" />}
          variant={atencoes > 0 ? 'amber' : 'default'}
          subtitle="abaixo do ponto de pedido"
        />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <p className="text-sm font-semibold mr-auto">Todos os produtos</p>
          <CustomSelect
            value={filtroNivel}
            onChange={setFiltroNivel}
            options={[
              { value: 'todos', label: 'Todos os níveis' },
              { value: 'ruptura', label: '🔴 Ruptura' },
              { value: 'critico', label: 'Crítico' },
              { value: 'atencao', label: '🟡 Atenção' },
              { value: 'ok', label: '✓ OK' },
              { value: 'sem_dados', label: 'Sem dados' },
            ]}
            className="w-44"
          />
        </div>

        {/* Cabeçalho da tabela */}
        <div className="hidden sm:grid sm:grid-cols-[90px_80px_1fr_60px_90px_90px_90px_90px_110px] gap-2 border-b bg-muted/40 px-4 py-2">
          {[
            'Alerta',
            'SKU',
            'Nome',
            <AbcHeader key="abc" />,
            'Estoque',
            <InfoTooltip key="es" label="Est. Segurança" tip="Quantidade mínima que você precisa ter pra não faltar enquanto espera o pedido novo chegar. Calculado em vendas diárias × prazo do fornecedor." />,
            <InfoTooltip key="pp" label="P. de Pedido" tip="O nível de estoque em que o sistema avisa: 'compra agora!'. Se esperar mais, o produto vai faltar antes do pedido chegar." />,
            'Cobertura',
            'Fornecedor',
          ].map((h, i) => (
            <span key={i} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {h}
            </span>
          ))}
        </div>

        {/* Linhas */}
        {isLoading ? (
          <div className="flex items-center justify-center py-14 text-sm text-muted-foreground">
            Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <CircleCheck className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum produto encontrado</p>
            <p className="text-xs text-muted-foreground/60">Tente ajustar o filtro</p>
          </div>
        ) : (
          <div>
            {filtered.map(row => (
              <div
                key={row.produto_id}
                className={cn(
                  'grid grid-cols-1 sm:grid-cols-[90px_80px_1fr_60px_90px_90px_90px_90px_110px] gap-2 px-4 py-3 border-b last:border-0 transition-colors',
                  NIVEL_ROW[row.nivel_alerta] ?? '',
                )}
              >
                {/* Nível */}
                <div className="flex items-center">
                  <span className={cn(
                    'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                    NIVEL_BADGE_CLS[row.nivel_alerta],
                  )}>
                    {NIVEL_LABEL[row.nivel_alerta]}
                  </span>
                </div>

                {/* SKU */}
                <div className="flex items-center">
                  <span className="text-xs font-mono text-muted-foreground">{row.sku ?? '—'}</span>
                </div>

                {/* Nome */}
                <div className="flex items-center">
                  <span className="text-sm font-medium truncate">{row.nome}</span>
                </div>

                {/* Classe ABC */}
                <div className="flex items-center">
                  <ClasseABC classe={row.classe_abc} />
                </div>

                {/* Estoque atual */}
                <div className="flex items-center">
                  <span className={cn(
                    'text-sm tabular-nums',
                    row.estoque_atual <= 0 ? 'text-destructive font-semibold' : '',
                  )}>
                    {fmtNum(row.estoque_atual)}
                  </span>
                </div>

                {/* Estoque de segurança */}
                <div className="flex items-center">
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {fmtNum(row.estoque_seguranca)}
                  </span>
                </div>

                {/* Ponto de pedido */}
                <div className="flex items-center">
                  <span className="text-sm tabular-nums font-medium">
                    {fmtNum(row.ponto_pedido)}
                  </span>
                </div>

                {/* Cobertura em dias */}
                <div className="flex items-center">
                  {row.nivel_alerta === 'sem_dados' || row.demanda_diaria === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : row.cobertura_dias <= 0 ? (
                    <span className="text-xs font-semibold text-destructive">Ruptura</span>
                  ) : (
                    <span className={cn(
                      'text-sm tabular-nums',
                      row.cobertura_dias <= row.lead_time_dias ? 'text-red-600 font-semibold' :
                      row.cobertura_dias <= row.lead_time_dias * 2 ? 'text-amber-600 font-medium' :
                      'text-muted-foreground',
                    )}>
                      {row.cobertura_dias}d
                    </span>
                  )}
                </div>

                {/* Fornecedor */}
                <div className="flex items-center">
                  <span className="text-xs text-muted-foreground truncate">
                    {row.fornecedor_nome ?? '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rodapé */}
        {filtered.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== data.length ? ` (${data.length} total)` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// Componente auxiliar para o header da coluna ABC
function AbcHeader() {
  return (
    <InfoTooltip
      label="Classe"
      tip="Classifica produtos pelo quanto geram de receita. Classe A = 20% dos produtos que dão 80% do dinheiro. Princípio de Pareto."
    />
  )
}
