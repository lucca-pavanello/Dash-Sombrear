/**
 * Mensagens da loja com preço → pedido de leitura → veredito por mensagem. Sem import:
 * roda na edge function e nos testes.
 *
 * Várias mensagens por chamada (uma resposta JSON com um item por id): o custo é de uma
 * leitura curta a cada 10 mensagens, não de uma por mensagem.
 */

export type MensagemComPreco = {
  id: number
  autor: 'ia' | 'equipe'
  conteudo: string | null
  contexto: string | null
}

export type Veredito = {
  id: number
  eh_orcamento: boolean
  valor: number | null
  opcoes: number | null
  produto: string | null
}

export function montarPedido(msgs: MensagemComPreco[]): string {
  const blocos = msgs.map(m => [
    `### id ${m.id} (${m.autor === 'ia' ? 'IA da loja' : 'equipe da loja'})`,
    m.contexto ? `Antes dela:\n${m.contexto}` : 'Antes dela: (inicio da conversa)',
    `MENSAGEM:\n${String(m.conteudo ?? '').slice(0, 2500)}`,
  ].join('\n'))
  return [
    'Voce le mensagens de WhatsApp enviadas pela SOMBREAR (loja de persianas e cortinas em Rio Preto).',
    'Cada mensagem abaixo tem um valor em R$. Diga, para cada uma, se ela e um ORCAMENTO enviado ao cliente.',
    '',
    'E orcamento: a loja passa preco de produto ou servico para o cliente comprar',
    '(persiana, cortina, rolo, limpeza, conserto, instalacao), inclusive "a partir de R$" e valor com desconto.',
    'NAO e orcamento: conversa com costureira, fornecedor ou parceiro sobre custo de material;',
    'cobranca de pedido ja fechado (link de pagamento, sinal, parcela); preco de frete sozinho; o cliente',
    'citando um valor que a loja apenas repete.',
    '',
    'Para cada mensagem:',
    '- eh_orcamento: true ou false.',
    '- valor: o TOTAL da opcao principal em reais, como numero (ex: 1362.40). Com varias opcoes, a primeira.',
    '  Se o total nao estiver escrito, some os itens da primeira opcao. null se nao for orcamento.',
    '- opcoes: quantas opcoes de preco diferentes a mensagem oferece (1 se so uma). null se nao for orcamento.',
    '- produto: o que foi orcado em ate 6 palavras (ex: "rolo blackout quarto"). null se nao for orcamento.',
    '',
    'Responda SOMENTE com JSON valido, um item por id, na mesma ordem:',
    '[{"id":123,"eh_orcamento":true,"valor":1362.40,"opcoes":2,"produto":"rolo tela solar escritorio"}]',
    '',
    blocos.join('\n\n'),
  ].join('\n')
}

/** só os vereditos que vieram certinhos e de ids pedidos; o resto fica para a próxima rodada */
export function lerVereditos(texto: string, idsPedidos: number[]): Veredito[] {
  const a = texto.indexOf('[')
  const b = texto.lastIndexOf(']')
  if (a < 0 || b <= a) return []
  let lista: unknown
  try { lista = JSON.parse(texto.slice(a, b + 1)) } catch { return [] }
  if (!Array.isArray(lista)) return []
  const pedidos = new Set(idsPedidos)
  const vistos = new Set<number>()
  const saida: Veredito[] = []
  for (const item of lista as Record<string, unknown>[]) {
    const id = Number(item?.id)
    if (!pedidos.has(id) || vistos.has(id) || typeof item.eh_orcamento !== 'boolean') continue
    vistos.add(id)
    const eh = item.eh_orcamento
    const valor = Number(item.valor)
    const opcoes = Number(item.opcoes)
    const produto = String(item.produto ?? '').trim().slice(0, 120)
    saida.push({
      id,
      eh_orcamento: eh,
      valor: eh && Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null,
      opcoes: eh && Number.isInteger(opcoes) && opcoes > 0 ? opcoes : null,
      produto: eh && produto && produto !== 'null' ? produto : null,
    })
  }
  return saida
}
