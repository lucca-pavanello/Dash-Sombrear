/**
 * "Custo item a item" — a quebra que mostra COMO a conta foi feita: cada parte
 * (tecido, ferragem, motor, bandô) com o preço de tabela, o fator da parceira e
 * o custo real. É o que a loja abre no lápis do Semanário para conferir o
 * número antes de fechar o mês.
 *
 * Vive aqui, e não dentro do Semanário, porque duas telas precisam dele: a
 * venda solta e o pedido agrupado (que mostra uma quebra por item). Sai como
 * duas peças de propósito — a tabela crua e a tabela dentro do card — para que
 * cada lugar componha o próprio cabeçalho em vez de ligar/desligar por flag.
 *
 * Sem estado próprio: quem sabe recarregar a lista é o Semanário, então a
 * reconstrução chega por callback.
 */
import { Wand2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/primitives'
import type { Orcamento } from '@/lib/supabase'

type Props = {
  orcamento: Orcamento
  reconstruindo: boolean
  erro?: string
  onReconstruir: () => void
  /** muda só a palavra do aviso: uma venda solta x um item dentro de um pedido */
  contexto?: 'venda' | 'item'
}

/** "Rolo Motorizado · BK NAPOLES — 1,50×3,20m ×2" — identifica o item na pilha do pedido */
export function descricaoItem(o: Orcamento): string {
  const medida = o.largura && o.altura
    ? `${String(o.largura).replace('.', ',')}×${String(o.altura).replace('.', ',')}m`
    : ''
  const qtd = Number(o.quantidade) > 1 ? ` ×${o.quantidade}` : ''
  return [o.modelo, o.tecido].filter(Boolean).join(' · ')
    + (medida ? ` — ${medida}` : '') + qtd
}

/** Só a tabela (ou o aviso de que não há quebra) — sem card e sem título. */
export function TabelaCustoItem({ orcamento: o, reconstruindo, erro, onReconstruir, contexto = 'venda' }: Props) {
  if (o.custos_detalhe?.length) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-1 text-center font-bold">Parte</th>
              <th className="pb-1 text-center font-bold">Tabela</th>
              <th className="pb-1 text-center font-bold">Fator</th>
              <th className="pb-1 text-center font-bold">Custo real</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {o.custos_detalhe.map((p, i) => (
              <tr key={i}>
                <td className="py-1.5 text-foreground">{p.parte}</td>
                <td className="py-1.5 text-center tabular-nums text-muted-foreground">{formatCurrency(p.tabela)}</td>
                <td className="py-1.5 text-center tabular-nums text-muted-foreground">{p.fator}</td>
                <td className="py-1.5 text-center font-semibold tabular-nums text-foreground">{formatCurrency(p.real)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {contexto === 'item' ? 'Este item entrou' : 'Essa venda entrou'} sem a quebra por item. O que temos: produto{' '}
        {formatCurrency(Number(o.custo_tecido ?? 0))}
        {Number(o.custo_acabamento) > 0 && <> e acabamento {formatCurrency(Number(o.custo_acabamento))}</>}.
      </p>
      <Button variant="outline" size="sm" loading={reconstruindo} onClick={onReconstruir}>
        {!reconstruindo && <Wand2 className="h-3 w-3" aria-hidden="true" />}
        Reconstruir pelos dados da venda
      </Button>
      {erro && (
        <p className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">{erro}</p>
      )}
    </div>
  )
}

/** A tabela dentro do card com título — o bloco inteiro, como na venda solta. */
export function CartaoCustoItem(props: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-foreground/45">
        Custo item a item
      </p>
      <TabelaCustoItem {...props} />
    </div>
  )
}
