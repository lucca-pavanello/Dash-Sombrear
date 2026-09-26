/**
 * O que conta como venda e quanto ela vale — a definição única.
 *
 * Mora aqui, separada de `base.ts`, pelo mesmo motivo que os tipos de preço
 * moram em `src/lib/precos/tipos.ts`: este arquivo é carregado também dentro
 * de Edge Function, onde o alias `@/` não existe. `base.ts` reexporta, então
 * quem já importava de lá não muda nada.
 *
 * Nenhum import aqui, de propósito. O tipo é estrutural — só os campos que a
 * conta usa, não o `Orcamento` inteiro.
 */

export type VendaMinima = {
  id?: string
  cliente?: string | null
  valor_cobrado?: number | null
  valor_venda?: number | null
  instalacao?: number | null
  fechado?: boolean | null
  data_pedido?: string | null
  created_at?: string
  pedido_id?: string | null
}

/**
 * `valor_cobrado` é o que o cliente REALMENTE pagou, com desconto ou acréscimo
 * dado na mão; quando não existe, vale o calculado mais a instalação. Esta é a
 * mesma definição da aba "Por canal" — as duas divergiam e mostravam
 * faturamento diferente para o mesmo mês até serem unificadas.
 */
export function receita(o: VendaMinima): number {
  if (o.valor_cobrado != null) return Number(o.valor_cobrado)
  return (o.valor_venda ?? 0) + (o.instalacao ?? 0)
}

/** `fechado` é o que conta dinheiro; `status` é rótulo de fluxo e não serve. */
export function ehVenda(o: VendaMinima): boolean {
  return o.fechado === true
}

/** a data que vale é a do pedido informada no Semanário; sem ela, a de criação */
export function dataVenda(o: VendaMinima): string {
  return o.data_pedido ?? o.created_at ?? ''
}

/**
 * O harness de QA do n8n cria 8 orçamentos falsos todo dia às 7h e apaga
 * depois. Se a leitura pegar a janela aberta, eles entram na conta.
 */
export function ehTeste(o: VendaMinima): boolean {
  return o.cliente === 'QA_HARNESS'
}

/** itens do mesmo pedido são uma venda só */
export function chavePedido(o: VendaMinima): string {
  return o.pedido_id ?? o.id ?? ''
}
