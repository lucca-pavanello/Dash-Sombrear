/**
 * Casos golden do motor de preços — números que viram dinheiro pago.
 *
 * Cada valor esperado aqui foi conferido contra uma fonte externa REAL:
 * vendas fechadas pela loja, o baseline do harness de QA do n8n, ou contas
 * feitas à mão pela dona. As fixtures congelam os preços de 13/08/2026 —
 * o teste protege as REGRAS; mudança de preço se faz no banco, não aqui.
 *
 * Se um destes quebrar, algum orçamento vai sair diferente do que a loja
 * cobra. Não "ajuste o teste": entenda o que mudou.
 */
import { describe, expect, it } from 'vitest'
import { simular, type DadosSim, type EntradaSim } from '../simulador'
import { calcularCortina, type DadosCortina, type EntradaCortina } from '../cortina'
import persianaFix from './fixtures/precos-persiana.json'
import cortinaFix from './fixtures/precos-cortina.json'

const dPersiana = persianaFix as unknown as DadosSim
const dCortina = cortinaFix as unknown as DadosCortina

const rolo = (extra: Partial<EntradaSim>): EntradaSim => ({
  modelo: 'Rolo', tecido: 'BK BRANCO', corFerragem: 'BRANCA',
  largura: 1.2, altura: 1.4, quantidade: 1, acabamento: 'nenhum',
  incluirInstalacao: false, ...extra,
})

const okOuFalha = (r: ReturnType<typeof simular>) => {
  if ('erro' in r) throw new Error(`motor recusou: ${r.erro}`)
  return r
}

describe('persiana — casos conferidos com vendas reais', () => {
  it('Romana BK BRANCO 1,70×1,20 com bandô — a venda do Fernando (R$ 873,30)', () => {
    const r = okOuFalha(simular(rolo({
      modelo: 'Romana', largura: 1.7, altura: 1.2, acabamento: 'bando_branco',
    }), dPersiana))
    expect(r.total4x).toBeCloseTo(873.30, 2)
    expect(r.valorParceiro).toBeCloseTo(396.45, 2)   // o que foi pago à parceira
  })

  it('Romana BK NAPOLES CREME NOVO 1,70×1,50 — a venda da Cintia (parceira R$ 343,95)', () => {
    const r = okOuFalha(simular(rolo({
      modelo: 'Romana', tecido: 'BK NAPOLES CREME NOVO', largura: 1.7, altura: 1.5,
    }), dPersiana))
    expect(r.valorParceiro).toBeCloseTo(343.95, 2)
  })
})

describe('bandô de peça única — porta dividida (áudio da loja)', () => {
  const base = rolo({ tecido: 'SCREEN 3% CINZA', largura: 1.95, altura: 2.5, quantidade: 3, acabamento: 'bando_branco' })

  it('3 bandôs de 1,95m (padrão): R$ 2.593,30', () => {
    expect(okOuFalha(simular(base, dPersiana)).total4x).toBeCloseTo(2593.30, 2)
  })

  it('1 bandô de 5,20m (peça única): R$ 2.526,20 — R$ 67,10 a menos', () => {
    const r = okOuFalha(simular({ ...base, bandoLargura: 5.2, bandoQuantidade: 1 }, dPersiana))
    expect(r.total4x).toBeCloseTo(2526.20, 2)
  })
})

describe('Rolo Motorizado — baseline golden do harness de QA (2026-08-03)', () => {
  it('BK BRANCO 1,20×1,40: custo tabela 642,05 · venda 1.512,30', () => {
    const r = okOuFalha(simular(rolo({ modelo: 'Rolo Motorizado' }), dPersiana))
    expect(r.custoTabela).toBeCloseTo(642.05, 2)
    expect(r.total4x).toBeCloseTo(1512.30, 2)
  })

  it('recusa medidas acima de 6,00m em vez de chutar', () => {
    // largura estoura o rolo de tecido antes do motor — o limite se testa pela ALTURA
    const r = simular(rolo({ modelo: 'Rolo Motorizado', altura: 6.2 }), dPersiana)
    expect('erro' in r && /6,00/.test(r.erro)).toBe(true)
  })
})

describe('ferragem preta — regra da loja', () => {
  it('tubo 32 preto vira 38 (a loja não trabalha o 32 preto)', () => {
    const r = okOuFalha(simular(rolo({ corFerragem: 'PRETA' }), dPersiana))
    expect(r.observacoes.join(' ')).toMatch(/38mm/)
  })
})

describe('cortina Wave — os 4 orçamentos fechados à mão pela loja', () => {
  const cortina = (extra: Partial<EntradaCortina>): EntradaCortina => ({
    largura: 2.5, altura: 2.55, tecido: 'Tecido padrão', suporte: 'trilho_simples', ...extra,
  })
  const okC = (r: ReturnType<typeof calcularCortina>) => {
    if ('erro' in r) throw new Error(`cortina recusou: ${r.erro}`)
    return r
  }

  it('2,50×2,55 trilho: subtotal 610,42 · parcelado 647,04 (o centavo do arredondar-no-fim)', () => {
    const r = okC(calcularCortina(cortina({}), dCortina))
    expect(r.consumo).toBeCloseTo(6.25, 2)
    expect(r.subtotal).toBeCloseTo(610.42, 2)
    expect(r.parcelado).toBeCloseTo(647.04, 2)   // 6% sobre o subtotal SEM arredondar antes
  })

  it('1,60×2,55 trilho: subtotal 390,67 · parcelado 414,11', () => {
    const r = okC(calcularCortina(cortina({ largura: 1.6 }), dCortina))
    expect(r.subtotal).toBeCloseTo(390.67, 2)
    expect(r.parcelado).toBeCloseTo(414.11, 2)
  })

  it('2,20×5,00: 2,20 alturas viram 2,5 — consumo 13,25m (o caso que o GPT errava)', () => {
    const r = okC(calcularCortina(cortina({ largura: 2.2, altura: 5 }), dCortina))
    expect(r.alturas).toBe(2.5)
    expect(r.consumo).toBeCloseTo(13.25, 2)
  })

  it('6,00×5,00: 6 alturas exatas — consumo 31,80m', () => {
    const r = okC(calcularCortina(cortina({ largura: 6, altura: 5 }), dCortina))
    expect(r.consumo).toBeCloseTo(31.80, 2)
  })

  it('varão sem preço cadastrado é recusado, não chutado', () => {
    const r = calcularCortina(cortina({ suporte: 'varao_simples' }), dCortina)
    expect('erro' in r).toBe(true)
  })
})
