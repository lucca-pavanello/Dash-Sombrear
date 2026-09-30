/**
 * A abertura — o bloco de destaque mais quatro números de apoio.
 *
 * A receita não está entre os quatro: ela virou a manchete em `Destaque`, porque quatro
 * cards de peso igual respondem "aqui estão quatro números", não "deu resultado". Repetir
 * o mesmo valor logo abaixo tiraria força dos dois.
 *
 * Sobre a taxa escolhida: a única conversão limpa que este banco sustenta é
 * conversa → orçamento, porque os dois lados vivem no CRM. Conversa → venda dependeria do
 * telefone da venda casar com a conversa, o que hoje fecha para uma fração dos pedidos;
 * essa parte aparece no funil e na seção de canal, com o denominador à vista.
 *
 * Composição: a receita `kpi` do projeto, centrada — chip do ícone em cima, rótulo em
 * caixa alta, número em `font-display`, todos neutros.
 */
import { ShoppingBag, Receipt, Percent, MessageCircle } from 'lucide-react'
import { kpi } from '@/components/shared/estilos'
import { formatCurrency, cn } from '@/lib/utils'
import type { Funil, ResumoDinheiro, Observacao, LinhaCanal } from '@/lib/analises'
import { NumeroAnimado, Delta } from './base'
import Destaque from './Destaque'

function Tile({
  icone: Icone, rotulo, valor, formatar, sub, delta,
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  valor: number
  formatar?: (v: number) => string
  sub?: string
  delta?: React.ReactNode
}) {
  return (
    <div className={cn(kpi.cartao, kpi.acento.neutro, 'flex flex-col items-center gap-0.5 text-center')}>
      <span className={cn(kpi.chip, kpi.chipCor.neutro)}>
        <Icone className="h-4 w-4" />
      </span>
      <p className={cn(kpi.rotulo, 'w-full')}>{rotulo}</p>
      <p className={cn(kpi.valor, kpi.valorCor.neutro)}>
        <NumeroAnimado valor={valor} formatar={formatar} />
      </p>
      <div className="min-h-[16px] w-full truncate">
        {delta ?? <span className={kpi.sub}>{sub}</span>}
      </div>
    </div>
  )
}

export default function Abertura({
  manchete, observacoes, funil, dinheiro, rotuloComparacao, rotuloPeriodo,
  deltas, destaqueCanal, semCanal,
}: {
  manchete: string
  observacoes: Observacao[]
  funil: Funil
  dinheiro: ResumoDinheiro
  rotuloComparacao: string
  rotuloPeriodo: string
  destaqueCanal: { linha: LinhaCanal; vezes: number } | null
  semCanal: LinhaCanal
  deltas: {
    receita: number | null
    pedidos: number | null
    ticket: number | null
    taxaOrcamento: number | null
  }
}) {
  const conversas = funil.etapas[0]?.valor ?? 0
  const orcadas = funil.etapas[1]?.valor ?? 0
  const taxaOrcamento = conversas > 0 ? (orcadas / conversas) * 100 : 0

  return (
    <div className="space-y-4">
      <Destaque
        receita={dinheiro.receita}
        deltaReceita={deltas.receita}
        rotuloComparacao={rotuloComparacao}
        rotuloPeriodo={rotuloPeriodo}
        destaqueCanal={destaqueCanal}
        semCanal={semCanal}
        taxaOrcamento={taxaOrcamento}
        orcadas={orcadas}
        conversas={conversas}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icone={ShoppingBag} rotulo="Pedidos fechados" valor={dinheiro.pedidos}
          delta={<Delta pct={deltas.pedidos} rotulo={rotuloComparacao} />}
        />
        <Tile
          icone={Receipt} rotulo="Ticket por pedido" valor={dinheiro.ticketPorPedido ?? 0}
          formatar={formatCurrency}
          delta={<Delta pct={deltas.ticket} rotulo={rotuloComparacao} />}
        />
        <Tile
          icone={MessageCircle} rotulo="Conversas atendidas" valor={conversas}
          sub="pela Amanda, no WhatsApp"
        />
        <Tile
          icone={Percent} rotulo="Conversa → orçamento" valor={taxaOrcamento}
          formatar={(v) => `${v.toFixed(0)}%`}
          sub={`${orcadas} de ${conversas} conversas`}
          delta={deltas.taxaOrcamento !== null
            ? <Delta pct={deltas.taxaOrcamento} rotulo={rotuloComparacao} />
            : undefined}
        />
      </div>

      <p className="mx-auto max-w-3xl text-center text-sm text-foreground/60">{manchete}</p>

      {observacoes.length > 0 && (
        <ul className="mx-auto max-w-3xl space-y-1.5">
          {observacoes.map((o) => (
            <li key={o.texto} className="flex items-start gap-2 text-sm text-foreground/75">
              {/* o tom vira peso do ponto, não cor: três cores aqui competiriam com o
                  único acento da tela, que é a receita */}
              <span
                aria-hidden="true"
                className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full',
                  o.tom === 'atencao' ? 'bg-foreground/45' : 'bg-muted-foreground/35')}
              />
              {o.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
