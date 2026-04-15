import { useState } from 'react'
import { Package, DollarSign, AlertTriangle, AlertOctagon, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { formatCurrency, formatCompact } from '@/lib/utils'
import KpiCard from '@/components/shared/KpiCard'
import { useLeadTimeRows, useLeadTimeConfig } from '@/hooks/useEstoqueLeadTime'
import type { LeadTimeConfig } from '@/hooks/useEstoqueLeadTime'
import type { ToastType } from '@/hooks/useToast'

// ─── Constantes visuais ───────────────────────────────────────────────────────

const ABC_BADGE: Record<string, string> = {
  A:         'bg-primary/10 text-primary',
  B:         'bg-muted text-foreground',
  C:         'bg-muted/60 text-muted-foreground',
  sem_dados: 'bg-muted text-muted-foreground italic',
}

type Nivel = 'verde' | 'amarelo' | 'vermelho' | 'neutro'

const ROW_BG: Record<Nivel, string> = {
  verde:    '',
  amarelo:  'border-l-4 border-amber-500 bg-amber-50/40 dark:bg-amber-950/20',
  vermelho: 'border-l-4 border-red-600 bg-red-50/40 dark:bg-red-950/20',
  neutro:   '',
}

const NIVEL_TEXT: Record<Nivel, string> = {
  verde:    'text-muted-foreground',
  amarelo:  'text-amber-700 dark:text-amber-500',
  vermelho: 'text-red-700 dark:text-red-400',
  neutro:   'text-muted-foreground',
}

const NIVEL_BADGE: Record<Nivel, string> = {
  verde:    'bg-muted text-muted-foreground',
  amarelo:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  vermelho: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  neutro:   'bg-muted text-muted-foreground',
}

const NIVEL_LABEL: Record<Nivel, string> = {
  verde:    'Verde',
  amarelo:  'Amarelo',
  vermelho: 'Vermelho',
  neutro:   '—',
}

const selectClass =
  'rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-all'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNivel(dias: number | null, config: LeadTimeConfig): Nivel {
  if (dias === null || dias <= 0) return 'neutro'
  if (dias <= config.verde_max) return 'verde'
  if (dias <= config.amarelo_max) return 'amarelo'
  return 'vermelho'
}

function capitalize(s: string | null | undefined): string {
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toast: (type: ToastType, message: string) => void
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function LeadTimeView(_: Props) {
  const { data: rows = [], isLoading } = useLeadTimeRows()
  const { data: config = { verde_max: 90, amarelo_max: 180 } } = useLeadTimeConfig()

  const [filterTipo,  setFilterTipo]  = useState('all')
  const [filterAbc,   setFilterAbc]   = useState('all')
  const [filterNivel, setFilterNivel] = useState('all')

  // ── KPI derivados ──
  const comEstoque = rows.filter((r) => r.quantidade_atual > 0).length

  const valorTotal = rows.reduce(
    (acc, r) => acc + (r.valor_parado_reais ? Number(r.valor_parado_reais) : 0), 0
  )

  const valorAmarelo = rows.reduce((acc, r) => {
    const d = r.dias_em_estoque
    if (d !== null && d > config.verde_max && d <= config.amarelo_max)
      return acc + (r.valor_parado_reais ? Number(r.valor_parado_reais) : 0)
    return acc
  }, 0)

  const valorVermelho = rows.reduce((acc, r) => {
    const d = r.dias_em_estoque
    if (d !== null && d > config.amarelo_max)
      return acc + (r.valor_parado_reais ? Number(r.valor_parado_reais) : 0)
    return acc
  }, 0)

  // ── Filtragem ──
  const filtered = rows.filter((r) => {
    if (filterTipo !== 'all' && r.tipo !== filterTipo) return false
    const abc = r.classificacao_abc ?? 'sem_dados'
    if (filterAbc !== 'all' && abc !== filterAbc) return false
    if (filterNivel !== 'all') {
      const nivel = getNivel(r.dias_em_estoque, config)
      if (nivel !== filterNivel) return false
    }
    return true
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="font-display text-base font-semibold">
          <InfoTooltip label="O que está parado — detalhe completo" tip="Tempo médio que o produto fica parado em estoque entre a compra e a venda. Quanto maior, mais dinheiro empatado." />
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Produtos sentados há muito tempo no estoque. Cada dia parado é dinheiro empatado.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Produtos com estoque"
          value={comEstoque}
          icon={<Package className="h-4 w-4" />}
          variant="default"
          subtitle="itens ativos"
        />
        <KpiCard
          title="Valor total parado"
          value={isLoading ? '—' : formatCompact(valorTotal)}
          icon={<DollarSign className="h-4 w-4" />}
          variant="default"
          subtitle="soma dos lotes ativos"
        />
        <KpiCard
          title="Em alerta (amarelo)"
          value={isLoading ? '—' : formatCompact(valorAmarelo)}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant="amber"
          subtitle={`${config.verde_max}–${config.amarelo_max} dias`}
        />
        <KpiCard
          title="Em crítico (vermelho)"
          value={isLoading ? '—' : formatCompact(valorVermelho)}
          icon={<AlertOctagon className="h-4 w-4" />}
          variant="orange"
          subtitle={`acima de ${config.amarelo_max} dias`}
        />
      </div>

      {/* Tabela + filtros */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 border-b px-4 py-3">
          <p className="text-sm font-semibold mr-auto">Todos os produtos</p>
          <div className="flex flex-wrap gap-2">
            {/* Tipo */}
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className={selectClass}
            >
              <option value="all">Todos os tipos</option>
              <option value="tecido">Tecido</option>
              <option value="ferragem">Ferragem</option>
              <option value="acessorio">Acessório</option>
              <option value="outro">Outro</option>
            </select>

            {/* Classe ABC */}
            <select
              value={filterAbc}
              onChange={(e) => setFilterAbc(e.target.value)}
              className={selectClass}
            >
              <option value="all">Todas as classes</option>
              <option value="A">Classe A</option>
              <option value="B">Classe B</option>
              <option value="C">Classe C</option>
              <option value="sem_dados">Sem dados</option>
            </select>

            {/* Nível */}
            <select
              value={filterNivel}
              onChange={(e) => setFilterNivel(e.target.value)}
              className={selectClass}
            >
              <option value="all">Todos os níveis</option>
              <option value="verde">🟢 Verde (saudável)</option>
              <option value="amarelo">🟡 Amarelo (alerta)</option>
              <option value="vermelho">🔴 Vermelho (crítico)</option>
            </select>
          </div>
        </div>

        {/* Cabeçalho da tabela */}
        <div className="hidden sm:grid sm:grid-cols-[80px_1fr_90px_80px_100px_90px_110px] gap-3 border-b bg-muted/40 px-4 py-2">
          {['SKU', 'Nome', 'Tipo', 'Classe', 'Estoque', 'Dias parado', 'Valor parado'].map((h) => (
            <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {h}
            </span>
          ))}
        </div>

        {/* Linhas */}
        {isLoading ? (
          <div className="flex items-center justify-center py-14 text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <Clock className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum produto encontrado</p>
            <p className="text-xs text-muted-foreground/60">Tente ajustar os filtros</p>
          </div>
        ) : (
          <div>
            {filtered.map((row) => {
              const nivel = getNivel(row.dias_em_estoque, config)
              const abc = row.classificacao_abc ?? 'sem_dados'
              return (
                <div
                  key={row.produto_id}
                  className={cn(
                    'grid grid-cols-1 sm:grid-cols-[80px_1fr_90px_80px_100px_90px_110px] gap-2 sm:gap-3 px-4 py-3 border-b last:border-0 transition-colors',
                    ROW_BG[nivel]
                  )}
                >
                  {/* SKU */}
                  <div className="flex items-center">
                    <span className="text-xs font-mono text-muted-foreground">
                      {row.codigo ?? '—'}
                    </span>
                  </div>

                  {/* Nome */}
                  <div className="flex items-center">
                    <span className="text-sm font-medium truncate">{row.nome}</span>
                  </div>

                  {/* Tipo */}
                  <div className="flex items-center">
                    <span className="text-xs text-muted-foreground">{capitalize(row.tipo)}</span>
                  </div>

                  {/* Classe ABC */}
                  <div className="flex items-center">
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold',
                      ABC_BADGE[abc] ?? ABC_BADGE['sem_dados']
                    )}>
                      {abc === 'sem_dados' ? '—' : abc}
                    </span>
                  </div>

                  {/* Estoque atual */}
                  <div className="flex items-center">
                    <span className="text-sm tabular-nums">
                      {Number(row.quantidade_atual).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                    </span>
                  </div>

                  {/* Dias parado */}
                  <div className="flex items-center gap-1.5">
                    {row.dias_em_estoque !== null ? (
                      <>
                        <span className={cn('text-sm font-bold tabular-nums', NIVEL_TEXT[nivel])}>
                          {row.dias_em_estoque}d
                        </span>
                        <span className={cn(
                          'hidden sm:inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                          NIVEL_BADGE[nivel]
                        )}>
                          {NIVEL_LABEL[nivel]}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </div>

                  {/* Valor parado */}
                  <div className="flex items-center">
                    <span className="text-sm font-semibold tabular-nums">
                      {row.valor_parado_reais !== null
                        ? formatCurrency(Number(row.valor_parado_reais))
                        : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Rodapé */}
        {filtered.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== rows.length ? ` (${rows.length} total)` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
