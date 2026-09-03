import { describe, it, expect } from 'vitest'
import { acharProduto, PRODUTOS, PRODUTO_IDS } from '../produtos'
import { OBJECOES, OBJECAO_IDS, acharObjecao, SEM_OBJECAO } from '../insights/taxonomia'

/**
 * O normalizador lê texto que o cliente digitou no WhatsApp. Se ele errar, a contagem
 * por produto do card de Insights mente — e mente em silêncio, que é o pior jeito.
 * Os casos abaixo saíram de conversa real do CRM (03/09/2026), não de imaginação.
 */
describe('acharProduto', () => {
  const casos: Array<[string | null | undefined, string]> = [
    // texto real de conversa
    ['persiana rolô tela solar 3%', 'rolo'],
    ['Rolô Blackout', 'rolo'],
    ['Tela Solar Screen 1% Cinza', 'rolo'],
    ['01 Rolo em Tecido 100% Blackout', 'rolo'],
    ['PH Alumínio', 'horizontal'],
    ['persiana horizontal de aluminio', 'horizontal'],
    ['escolheu o modelo de alumínio', 'horizontal'],
    ['PH 50', 'horizontal'],
    ['PV blackout', 'vertical'],
    ['persiana vertical', 'vertical'],
    ['Romeu e Julieta', 'double'],
    ['double vision', 'double'],
    ['cortina wave', 'cortina'],
    ['romana', 'romana'],
    ['painel', 'painel'],

    // motorizado tem que ganhar de rolô, senão some numa categoria só
    ['rolo motorizado', 'rolo_motorizado'],
    ['persiana rolô motorizada', 'rolo_motorizado'],

    // id canônico volta pra si mesmo (a tela reenvia o slug ao agrupar)
    ...PRODUTO_IDS.map(id => [id, id] as [string, string]),

    // nunca chutar: sem sinal = sem produto
    ['', 'sem_produto'],
    [null, 'sem_produto'],
    [undefined, 'sem_produto'],
    ['bom dia, tudo bem?', 'sem_produto'],
    ['quero um orçamento', 'sem_produto'],
  ]

  it.each(casos)('%s → %s', (entrada, esperado) => {
    expect(acharProduto(entrada).id).toBe(esperado)
  })

  it('não tem id duplicado', () => {
    expect(new Set(PRODUTO_IDS).size).toBe(PRODUTOS.length)
  })
})

describe('taxonomia de objeções', () => {
  it('não tem id duplicado', () => {
    expect(new Set(OBJECAO_IDS).size).toBe(OBJECOES.length)
  })

  it('todo slug tem rótulo, critério e dica preenchidos', () => {
    // o critério vira instrução no prompt do classificador e a dica vira sugestão de
    // ação no card — slug sem esses campos entra mudo nos dois lugares
    for (const o of OBJECOES) {
      expect(o.rotulo.trim(), o.id).not.toBe('')
      expect(o.criterio.trim(), o.id).not.toBe('')
      expect(o.dica.trim(), o.id).not.toBe('')
    }
  })

  it('reconhece slug válido e recusa slug desconhecido', () => {
    expect(acharObjecao('foto_tecido').id).toBe('foto_tecido')
    expect(acharObjecao('FOTO_TECIDO ').id).toBe('foto_tecido')
    // dado sujo não pode virar categoria nova: isso mascararia defeito do classificador
    expect(acharObjecao('preco_altissimo')).toBe(SEM_OBJECAO)
    expect(acharObjecao('')).toBe(SEM_OBJECAO)
    expect(acharObjecao(null)).toBe(SEM_OBJECAO)
  })
})
