import { describe, it, expect } from 'vitest'
import { acharRegraPreco, precoDoAnuncio, type RegraPrecoMl } from '../precoMl'

const base = { ativo: true }
const regra = (p: Partial<RegraPrecoMl>): RegraPrecoMl => ({
  ...base, familia: 'Tela Solar', abertura: null, cor: null, preco_m2: 100, preco_minimo: 0, ...p,
} as RegraPrecoMl)

/**
 * A precedência existe pra deixar definir "todo Blackout custa X" e abrir exceção só onde
 * a cor muda o valor, em vez de preencher 30 linhas quase iguais. Se ela inverter, a peça
 * sai anunciada pelo preço errado e ninguém percebe olhando a tela.
 */
describe('acharRegraPreco — a regra mais específica ganha', () => {
  const tecido = { familia: 'Tela Solar', abertura: '3%', cor: 'Bege' }

  it('regra com cor bate regra sem cor', () => {
    const precos = [
      regra({ preco_m2: 100 }),                        // geral da família
      regra({ cor: 'Bege', preco_m2: 150 }),           // específica da cor
    ]
    expect(acharRegraPreco(precos, tecido)?.preco_m2).toBe(150)
  })

  it('regra com abertura bate regra sem abertura', () => {
    const precos = [
      regra({ preco_m2: 100 }),
      regra({ abertura: '3%', preco_m2: 130 }),
    ]
    expect(acharRegraPreco(precos, tecido)?.preco_m2).toBe(130)
  })

  it('cor + abertura ganha de cor sozinha', () => {
    const precos = [
      regra({ cor: 'Bege', preco_m2: 150 }),
      regra({ abertura: '3%', cor: 'Bege', preco_m2: 190 }),
    ]
    expect(acharRegraPreco(precos, tecido)?.preco_m2).toBe(190)
  })

  it('não pega regra de outra família, nem de outra cor', () => {
    const precos = [
      regra({ familia: 'Blackout', preco_m2: 999 }),
      regra({ cor: 'Preto', preco_m2: 888 }),
      regra({ abertura: '1%', preco_m2: 777 }),
    ]
    expect(acharRegraPreco(precos, tecido)).toBeNull()
  })

  it('regra inativa não vale', () => {
    expect(acharRegraPreco([regra({ ativo: false })], tecido)).toBeNull()
  })

  it('sem regra nenhuma devolve null — quem chama decide, não inventa preço', () => {
    expect(acharRegraPreco([], tecido)).toBeNull()
  })
})

describe('precoDoAnuncio — o piso protege a peça pequena', () => {
  it('usa área × preço quando passa do mínimo', () => {
    expect(precoDoAnuncio(2.76, regra({ preco_m2: 100, preco_minimo: 150 }))).toBe(276)
  })

  it('usa o mínimo quando a área é pequena demais', () => {
    // 0,80 m² × R$100 = R$80, que não paga comissão do ML nem o trabalho de embalar
    expect(precoDoAnuncio(0.8, regra({ preco_m2: 100, preco_minimo: 150 }))).toBe(150)
  })

  it('sem mínimo definido, vale a conta pura', () => {
    expect(precoDoAnuncio(0.8, regra({ preco_m2: 100, preco_minimo: 0 }))).toBe(80)
  })

  it('arredonda para centavo, não deixa fração de centavo passar', () => {
    expect(precoDoAnuncio(1.333, regra({ preco_m2: 99.99 }))).toBe(133.29)
  })
})
