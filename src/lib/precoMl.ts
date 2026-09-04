/**
 * Regra de preço das sobras no Mercado Livre — lógica pura, sem React nem Supabase.
 *
 * Mora em `lib/` e não no hook porque é conta de dinheiro: precisa ser testável sem subir
 * client de banco, do mesmo jeito que `simulador.ts` é o motor e os hooks só o embrulham.
 */

export type RegraPrecoMl = {
  familia: string
  abertura: string | null
  /** null = vale para todas as cores dessa família/abertura */
  cor: string | null
  preco_m2: number
  preco_minimo: number
  ativo: boolean
}

/**
 * Acha a regra que vale para um tecido — **a mais específica ganha**.
 *
 * Existe para deixar definir "todo Blackout custa X" e abrir exceção só onde a cor
 * realmente muda o valor, em vez de preencher 30 linhas quase iguais. Se a precedência
 * invertesse, a peça sairia anunciada pelo preço errado sem nada na tela denunciar.
 */
export function acharRegraPreco<T extends RegraPrecoMl>(
  regras: T[],
  tecido: { familia: string; abertura: string | null; cor: string },
): T | null {
  const candidatos = regras.filter(p =>
    p.ativo &&
    p.familia === tecido.familia &&
    (p.abertura == null || p.abertura === tecido.abertura) &&
    (p.cor == null || p.cor === tecido.cor)
  )
  if (!candidatos.length) return null
  const peso = (p: RegraPrecoMl) => (p.cor != null ? 2 : 0) + (p.abertura != null ? 1 : 0)
  return [...candidatos].sort((a, b) => peso(b) - peso(a))[0]
}

/**
 * O valor que vai pro anúncio: área × preço/m², com piso.
 *
 * O piso existe porque peça pequena não pode sair por um valor que não paga a comissão do
 * Mercado Livre nem o trabalho de embalar e despachar.
 */
export function precoDoAnuncio(area_m2: number, regra: Pick<RegraPrecoMl, 'preco_m2' | 'preco_minimo'>): number {
  return Math.round(Math.max(area_m2 * regra.preco_m2, regra.preco_minimo) * 100) / 100
}
