import { describe, it, expect } from 'vitest'
import { valorNumerico } from '../utils'

/**
 * O "último valor cotado" é texto livre que o agente grava ("a partir de R$ 429,90").
 * Ordenar por ele como string colocaria "R$ 1.100,00" antes de "R$ 900,00" — erro que
 * ninguém nota olhando a tela, porque a lista continua parecendo ordenada.
 */
describe('valorNumerico', () => {
  const casos: Array<[string | null | undefined, number]> = [
    ['a partir de R$ 429,90', 429.9],
    ['R$ 11.650,80', 11650.8],
    ['R$ 900,00', 900],
    ['R$ 1.100,00', 1100],
    ['1.062,50', 1062.5],
    ['R$ 554', 554],
  ]

  it.each(casos)('%s → %s', (entrada, esperado) => {
    expect(valorNumerico(entrada)).toBeCloseTo(esperado, 2)
  })

  it('devolve NaN para vazio, nulo ou texto sem número', () => {
    // NaN é sinal de "sem valor", e a ordenação joga esses pro fim nas duas direções —
    // linha vazia no topo não é informação, é ruído
    expect(valorNumerico(null)).toBeNaN()
    expect(valorNumerico(undefined)).toBeNaN()
    expect(valorNumerico('')).toBeNaN()
    expect(valorNumerico('sob consulta')).toBeNaN()
  })

  it('mil separado por ponto não vira número quebrado', () => {
    // a armadilha do formato BR: "R$ 1.100,00" tem que virar 1100, não 1.1
    expect(valorNumerico('R$ 1.100,00')).toBeGreaterThan(valorNumerico('R$ 900,00'))
  })
})

/**
 * Ordenação de nome usa localeCompare pt-BR com sensitivity 'base'. Antes era comparação
 * lexicográfica crua, então "Ângela" caía depois de "Zeca" (o Â tem code point maior que
 * qualquer letra ASCII) e maiúscula vinha antes de minúscula.
 */
describe('ordenação de nome com acento', () => {
  const ordenar = (nomes: string[]) =>
    [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

  it('acento não joga o nome para o fim da lista', () => {
    expect(ordenar(['Zeca', 'Ângela', 'Bruno'])).toEqual(['Ângela', 'Bruno', 'Zeca'])
  })

  it('caixa não separa nomes iguais', () => {
    expect(ordenar(['bruno', 'Ana', 'ana'])[0].toLowerCase()).toBe('ana')
  })
})
