/**
 * O dinheiro.
 *
 * Duas correções em relação ao painel antigo: a receita usa `valor_cobrado` quando
 * existe (era o que fazia esta aba e a "Por canal" mostrarem faturamentos diferentes
 * para o mesmo mês), e o ticket médio é por PEDIDO, não por item — três persianas num
 * pedido só são três linhas em `orcamentos`, e dividir por linha dava um ticket que não
 * existe em nota fiscal nenhuma.
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import { Wallet } from 'lucide-react'
import ChartTooltip from '@/components/shared/ChartTooltip'
import { tabela, kpi } from '@/components/shared/estilos'
import type { MesReceita, LinhaModelo, ResumoDinheiro } from '@/lib/analises'
import { formatCurrency, cn } from '@/lib/utils'
import { SecaoAnalise } from './base'

export default function BlocoDinheiro({
  porMes, porModelo, dinheiro, resetKey,
}: {
  porMes: MesReceita[]
  porModelo: LinhaModelo[]
  dinheiro: ResumoDinheiro
  resetKey?: number
}) {
  const semFechamento = porMes.every((m) => m.receita === 0)
  const comVenda = porModelo.filter((l) => l.vendas > 0)
  const totais = comVenda.reduce(
    (s, l) => ({ vendas: s.vendas + l.vendas, receita: s.receita + l.receita, custo: s.custo + l.custo }),
    { vendas: 0, receita: 0, custo: 0 },
  )

  return (
    <SecaoAnalise
      icone={Wallet}
      titulo="O dinheiro"
      pergunta="Quanto entrou, com que margem e em que produto"
    >
      {/* mesma composição centrada da receita `kpi`, sem o chip: são números de apoio
          dentro de uma seção, não os KPIs de abertura */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          {
            rotulo: 'Ticket por pedido',
            valor: dinheiro.ticketPorPedido !== null ? formatCurrency(dinheiro.ticketPorPedido) : '—',
            sub: `${dinheiro.pedidos} pedido${dinheiro.pedidos === 1 ? '' : 's'}, ${dinheiro.itens} ite${dinheiro.itens === 1 ? 'm' : 'ns'}`,
          },
          {
            rotulo: 'Margem média',
            valor: dinheiro.margemMedia !== null ? `${dinheiro.margemMedia.toFixed(1)}%` : '—',
            sub: dinheiro.comMargem > 0
              ? `${dinheiro.comMargem} pedidos com custo calculado`
              : 'registre o custo pra ver a margem',
          },
          {
            rotulo: 'Receita no período',
            valor: formatCurrency(dinheiro.receita),
            sub: 'o que o cliente pagou de fato',
            destaque: true,
          },
        ].map((k) => (
          <div key={k.rotulo} className={cn('text-center', k.destaque && 'col-span-2 sm:col-span-1')}>
            <p className={kpi.rotulo}>{k.rotulo}</p>
            <p className={cn(kpi.valor, 'text-xl', k.destaque ? kpi.valorCor.primario : kpi.valorCor.neutro)}>
              {k.valor}
            </p>
            <p className={kpi.sub}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-foreground/50">
          Receita fechada, mês a mês
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart key={resetKey} data={porMes} margin={{ top: 18, right: 4, bottom: 0, left: -8 }} barCategoryGap="28%">
            {/* só as horizontais: linha vertical em série temporal vira gaiola e
                atrapalha justamente a leitura de altura que o gráfico existe pra dar */}
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} dy={4}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tickLine={false} axisLine={false} width={52}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: number) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v}`)} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.45)' }}
              content={<ChartTooltip formatter={(v) => formatCurrency(Number(v))} />} />
            <Bar dataKey="receita" name="Receita" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))"
              cursor="pointer" isAnimationActive animationBegin={0} animationDuration={600}
              animationEasing="ease-out">
              {/* rótulo direto: com seis meses cabe, e evita o vai-e-vem barra→eixo */}
              <LabelList dataKey="receita" position="top" offset={6}
                formatter={(v: number) => (v > 0 ? `R$ ${(v / 1000).toFixed(1)}k` : '')}
                style={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {semFechamento && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Nenhum fechamento registrado nesses meses — o Semanário começou a registrar vendas em agosto.
          </p>
        )}
      </div>

      {comVenda.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-foreground/50">
            Rentabilidade por modelo
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-center">
              <thead>
                <tr className={tabela.theadRow}>
                  <th className={cn(tabela.th, 'text-center')}>Modelo</th>
                  <th className={tabela.th}>Cotações</th>
                  <th className={tabela.th}>Vendas</th>
                  <th className={tabela.th}>Receita</th>
                  <th className={tabela.th}>Custo</th>
                  <th className={tabela.th}>Margem</th>
                </tr>
              </thead>
              <tbody>
                {comVenda.map((l) => (
                  <tr key={l.modelo} className={tabela.tr}>
                    <td className={cn(tabela.td, 'text-center font-medium')}>{l.modelo}</td>
                    <td className={cn(tabela.td, 'tabular-nums text-muted-foreground')}>{l.cotacoes}</td>
                    <td className={cn(tabela.td, 'tabular-nums')}>{l.vendas}</td>
                    <td className={cn(tabela.td, 'tabular-nums font-semibold')}>{formatCurrency(l.receita)}</td>
                    <td className={cn(tabela.td, 'tabular-nums text-muted-foreground')}>
                      {l.custo > 0 ? formatCurrency(l.custo) : '—'}
                    </td>
                    <td className={cn(tabela.td, 'tabular-nums')}>
                      {l.margem !== null ? `${l.margem.toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={tabela.tfootRow}>
                  <td className={cn(tabela.tfootCell, 'text-center')}>Total</td>
                  <td className={tabela.tfootCell} />
                  <td className={cn(tabela.tfootCell, 'tabular-nums')}>{totais.vendas}</td>
                  <td className={cn(tabela.tfootCell, 'tabular-nums')}>{formatCurrency(totais.receita)}</td>
                  <td className={cn(tabela.tfootCell, 'tabular-nums')}>
                    {totais.custo > 0 ? formatCurrency(totais.custo) : '—'}
                  </td>
                  <td className={cn(tabela.tfootCell, 'tabular-nums')}>
                    {totais.receita > 0 && totais.custo > 0
                      ? `${(((totais.receita - totais.custo) / totais.receita) * 100).toFixed(0)}%`
                      : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Receita, custo e margem saem só das vendas fechadas. Cotação é uso da calculadora
            pelo balcão e entra como coluna própria — misturar o custo das cotações com a
            receita das vendas já produziu margem de -1851% nesta tela.
          </p>
        </div>
      )}
    </SecaoAnalise>
  )
}
