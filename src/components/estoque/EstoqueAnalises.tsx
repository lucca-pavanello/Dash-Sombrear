import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import ChartTooltip from '@/components/shared/ChartTooltip'
import { useTopProdutosMovimentados, useConsumoMensal } from '@/hooks/useEstoqueAnalytics'
import { useEstoqueProdutos } from '@/hooks/useEstoqueProdutos'
import { useEstoqueMovimentacoes } from '@/hooks/useEstoqueMovimentacoes'
import type { EstoqueProduto } from '@/lib/supabase'
import { segmentado } from '@/components/shared/estilos'

// ---------------------------------------------------------------------------
// Cálculo local: projeção de dias de estoque restantes
// ---------------------------------------------------------------------------
function calcDiasRestantes(
  produto: EstoqueProduto,
  movimentacoes: Array<{ produto_id: string; tipo: string; quantidade: number; created_at: string }>
) {
  const sessenta = new Date()
  sessenta.setDate(sessenta.getDate() - 60)
  const saidas = movimentacoes
    .filter((m) =>
      m.produto_id === produto.id &&
      (m.tipo === 'saida' || m.tipo === 'perda') &&
      new Date(m.created_at) >= sessenta
    )
    .reduce((s, m) => s + m.quantidade, 0)
  const consumoDiario = saidas / 60
  if (consumoDiario <= 0) return null
  return produto.quantidade_atual / consumoDiario
}

function gerarInsights(
  produtos: EstoqueProduto[],
  movs: Array<{ produto_id: string; tipo: string; quantidade: number; created_at: string }>
): string[] {
  const insights: string[] = []

  // Produto com menor dias de estoque restantes
  const comDias = produtos
    .map((p) => ({ p, dias: calcDiasRestantes(p, movs) }))
    .filter((x) => x.dias !== null) as { p: EstoqueProduto; dias: number }[]
  comDias.sort((a, b) => a.dias - b.dias)
  if (comDias.length > 0) {
    const critico = comDias[0]
    if (critico.dias < 30) {
      insights.push(
        `⚠ "${critico.p.nome}" tem estoque para ~${Math.round(critico.dias)} dia${critico.dias !== 1 ? 's' : ''} de consumo — considere reabastecer.`
      )
    }
  }

  // Produtos sem nenhuma movimentação nos últimos 30 dias
  const trinta = new Date()
  trinta.setDate(trinta.getDate() - 30)
  const produtosComMov30 = new Set(movs.filter((m) => new Date(m.created_at) >= trinta).map((m) => m.produto_id))
  const semMov = produtos.filter((p) => !produtosComMov30.has(p.id))
  if (semMov.length > 0) {
    insights.push(
      `${semMov.length} produto${semMov.length !== 1 ? 's' : ''} sem movimentação nos últimos 30 dias.`
    )
  }

  // Comparação entrada vs saída do mês atual
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)
  const totalEntradas = movs
    .filter((m) => m.tipo === 'entrada' && new Date(m.created_at) >= inicioMes)
    .reduce((s, m) => s + m.quantidade, 0)
  const totalSaidas = movs
    .filter((m) => (m.tipo === 'saida' || m.tipo === 'perda') && new Date(m.created_at) >= inicioMes)
    .reduce((s, m) => s + m.quantidade, 0)
  if (totalEntradas > 0 || totalSaidas > 0) {
    if (totalSaidas > totalEntradas * 1.5) {
      insights.push(`Este mês as saídas (${totalSaidas.toFixed(1)}) superam as entradas (${totalEntradas.toFixed(1)}) — verifique o reabastecimento.`)
    } else if (totalEntradas > totalSaidas * 1.5) {
      insights.push(`Mês com forte reabastecimento: ${totalEntradas.toFixed(1)} de entrada vs ${totalSaidas.toFixed(1)} de saída.`)
    }
  }

  if (insights.length === 0) {
    insights.push('Nenhum alerta ou insight significativo para o período atual.')
  }
  return insights
}

export default function EstoqueAnalises({ resetKey }: { resetKey?: number } = {}) {
  const [meses, setMeses] = useState(6)
  const { data: produtos = [] } = useEstoqueProdutos()
  const { data: consumoMensal = [], isLoading: loadingMensal } = useConsumoMensal(meses)
  const { data: topProdutos = [], isLoading: loadingTop } = useTopProdutosMovimentados(10)
  const { data: movsData } = useEstoqueMovimentacoes({ page: 1 })
  const movs = movsData?.rows ?? []

  const insights = gerarInsights(produtos, movs)

  // Dias de estoque restantes para todos os produtos com consumo
  const diasEstoque = produtos
    .map((p) => ({ nome: p.nome, unidade: p.unidade, dias: calcDiasRestantes(p, movs) }))
    .filter((x) => x.dias !== null) as { nome: string; unidade: string; dias: number }[]
  diasEstoque.sort((a, b) => a.dias - b.dias)

  const maxDias = diasEstoque.length > 0 ? Math.max(...diasEstoque.map((d) => d.dias)) : 0

  return (
    <div className="space-y-6">
      {/* Insights textuais */}
      <div className="rounded-xl border-2 bg-card shadow-sm p-4 space-y-2">
        <h3 className="text-sm font-semibold">Insights Automáticos</h3>
        <ul className="space-y-1.5">
          {insights.map((insight, i) => (
            <li key={i} className="text-sm text-muted-foreground flex gap-2">
              <span className="shrink-0 mt-0.5 text-primary">›</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Consumo Mensal */}
      <div className="rounded-xl border-2 bg-card shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Consumo Mensal</h3>
          <div className={segmentado.trilho}>
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setMeses(m)}
                className={`${segmentado.item} ${meses === m ? segmentado.ativo : segmentado.inativo}`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
        {loadingMensal ? (
          <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart key={resetKey} data={consumoMensal} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={45} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} isAnimationActive animationBegin={0} animationDuration={700} animationEasing="ease-out" />
              <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} isAnimationActive animationBegin={100} animationDuration={700} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top produtos movimentados */}
      <div className="rounded-xl border-2 bg-card shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-4">Top 10 Produtos Mais Consumidos (90 dias)</h3>
        {loadingTop ? (
          <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
        ) : topProdutos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de movimentação nos últimos 90 dias.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, topProdutos.length * 32)}>
            <BarChart
              key={resetKey}
              data={topProdutos}
              layout="vertical"
              margin={{ top: 0, right: 32, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                type="category"
                dataKey="nome"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                width={130}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="total_saidas" name="Saídas" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} isAnimationActive animationBegin={200} animationDuration={1200} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Dias de estoque restantes */}
      {diasEstoque.length > 0 && (
        <div className="rounded-xl border-2 bg-card shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-4">Projeção de Dias de Estoque</h3>
          <p className="text-xs text-muted-foreground mb-3">Baseado no consumo médio dos últimos 60 dias.</p>
          <div className="space-y-3">
            {diasEstoque.slice(0, 15).map(({ nome, dias }) => {
              const pct = maxDias > 0 ? Math.min((dias / maxDias) * 100, 100) : 0
              const cor = dias < 7 ? 'bg-destructive' : dias < 30 ? 'bg-amber-500' : 'bg-primary/60'
              const textCor = dias < 7 ? 'text-destructive' : dias < 30 ? 'text-amber-600' : 'text-muted-foreground'
              return (
                <div key={nome}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate max-w-[60%]" title={nome}>{nome}</span>
                    <span className={`text-xs font-bold ${textCor}`}>
                      {Math.round(dias)} dias
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
