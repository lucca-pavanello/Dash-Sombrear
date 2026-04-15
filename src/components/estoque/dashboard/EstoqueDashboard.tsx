import { Package, DollarSign, Star, Clock } from 'lucide-react'
import MetricCard from './MetricCard'
import { CardTecidoParado } from './CardTecidoParado'
import CardSemLocalizacao from './CardSemLocalizacao'
import { CardGiro } from './CardGiro'
import { CardSugestoesCompra } from './CardSugestoesCompra'
import EstoqueAlertasPanel from '@/components/estoque/EstoqueAlertasPanel'
import type { EstoqueProduto, EstoqueProdutoAlerta } from '@/lib/supabase'
import type { ToastType } from '@/hooks/useToast'

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface Props {
  toast: (type: ToastType, message: string) => void
  produtos: EstoqueProduto[]
  alertas: EstoqueProdutoAlerta[]
  onMovimentar: (p: EstoqueProduto | EstoqueProdutoAlerta, tipo: 'entrada' | 'saida' | 'ajuste' | 'perda') => void
  onNavigateToLeadTime?: () => void
  onNavigateToAnalises?: () => void
  onNavigateToSugestao?: () => void
  onNavigateToLocalizacoes?: () => void
}

export default function EstoqueDashboard({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toast: _toast,
  produtos,
  alertas,
  onMovimentar,
  onNavigateToLeadTime,
  onNavigateToAnalises,
  onNavigateToSugestao,
  onNavigateToLocalizacoes,
}: Props) {
  const ativos = produtos.filter((p) => p.ativo)
  const totalAtivos = ativos.length
  const valorEmEstoque = ativos.reduce(
    (s, p) => s + (p.quantidade_atual ?? 0) * (p.custo_unitario ?? 0),
    0,
  )
  const classeACount = produtos.filter((p) => p.classificacao_abc === 'A').length
  const semVenda90d = produtos.filter(
    (p) => p.classificacao_abc === 'sem_dados' && p.ativo,
  ).length

  return (
    <div className="space-y-5">

      {/* ── Seção 1: O que importa agora ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Ação — comprar agora? */}
        <CardSugestoesCompra onClick={onNavigateToSugestao} />
        {/* Financeiro — quanto tenho empatado? */}
        <MetricCard
          title="Valor em estoque"
          value={fmtBRL(valorEmEstoque)}
          subtitle="custo médio × qtd"
          icon={DollarSign}
          accent="default"
        />
        {/* Saúde — estoque girando? */}
        <CardGiro onClick={onNavigateToAnalises} />
        {/* Contexto — quantos produtos */}
        <MetricCard
          title="Produtos ativos"
          value={totalAtivos}
          subtitle="em estoque"
          icon={Package}
          accent="default"
        />
      </div>

      {/* ── Alertas de estoque mínimo ──────────────────────────────────────── */}
      {alertas.length > 0 && (
        <EstoqueAlertasPanel alertas={alertas} onMovimentar={onMovimentar} />
      )}

      {/* ── Seção 2: Análises rápidas ──────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
          Análises rápidas
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            title="Produtos classe A"
            value={classeACount}
            subtitle="top 80% do valor"
            icon={Star}
            accent="primary"
            onClick={onNavigateToAnalises}
          />
          <MetricCard
            title="Sem venda 90 dias"
            value={semVenda90d}
            subtitle="sem classificação ABC"
            icon={Clock}
            accent="default"
            onClick={onNavigateToAnalises}
          />
          <CardTecidoParado onClick={onNavigateToLeadTime} />
          <CardSemLocalizacao onClick={onNavigateToLocalizacoes} />
        </div>
      </div>

    </div>
  )
}
