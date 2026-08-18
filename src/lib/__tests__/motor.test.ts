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
import { calcularAmbientesCortina, calcularCortina, type DadosCortina, type EntradaCortina } from '../cortina'
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

  /* pedido da loja (16/08): 6 rolôs numa parede não são 6 motores + 6
     controles — peças unidas por junção dividem motor, e o controle é do
     pedido (1 de 6 canais). O padrão continua 1 motor/peça + 1 controle
     de 1 canal, então o golden acima não muda. */
  it('6 peças, 3 motores, 1 controle de 6 canais, 3 junções: peças da motorização por quantidade própria', () => {
    const r = okOuFalha(simular(rolo({ modelo: 'Rolo Motorizado', quantidade: 6,
      motorQtd: 3, controleQtd: 1, controleCanais: 6, juncaoQtd: 3 }), dPersiana))
    const acha = (re: RegExp) => r.detalhe.find(d => re.test(d.parte))
    expect(acha(/^Estrutura/)?.parte).toMatch(/× 6$/)
    expect(acha(/^Motor/)?.parte).toMatch(/× 3$/)
    expect(acha(/^Controle 6 canais/)?.parte).toBe('Controle 6 canais')   // 1 só, sem "× n"
    expect(acha(/^Junção/)?.parte).toMatch(/× 3$/)
    expect(r.observacoes.join(' ')).toMatch(/6 peças com 3 motores/)
  })

  it('padrão de 6 peças sem escolha = 6 motores e 6 controles de 1 canal (comportamento antigo)', () => {
    const r = okOuFalha(simular(rolo({ modelo: 'Rolo Motorizado', quantidade: 6 }), dPersiana))
    const acha = (re: RegExp) => r.detalhe.find(d => re.test(d.parte))
    expect(acha(/^Motor/)?.parte).toMatch(/× 6$/)
    // controle passou a ser do PEDIDO: padrão 1 controle, não 6
    expect(acha(/^Controle 1 canal/)?.parte).toBe('Controle 1 canal')
  })

  it('a conta bate: 3 motores em vez de 6 baixa o custo da motorização', () => {
    const seis = okOuFalha(simular(rolo({ modelo: 'Rolo Motorizado', quantidade: 6 }), dPersiana))
    const tres = okOuFalha(simular(rolo({ modelo: 'Rolo Motorizado', quantidade: 6, motorQtd: 3 }), dPersiana))
    expect(tres.custoTabela).toBeLessThan(seis.custoTabela)
    expect(tres.total4x).toBeLessThan(seis.total4x)
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

  it('varão duplo sem preço cadastrado é recusado, não chutado', () => {
    const r = calcularCortina(cortina({ suporte: 'varao_duplo' }), dCortina)
    expect('erro' in r).toBe(true)
  })
})

describe('cortina — os 2 orçamentos reais da resposta da loja (14/08/2026)', () => {
  const okC = (r: ReturnType<typeof calcularCortina>) => {
    if ('erro' in r) throw new Error(`cortina recusou: ${r.erro}`)
    return r
  }

  it('Opção 01 — Wave 2,00×2,30 + BK70 costurado junto, varão, colocada: 879,17 · 931,92', () => {
    // a MO conta os dois panos: (5,00 + 5,00) ÷ 1,50 × 40 = 266,67
    const r = okC(calcularCortina({
      largura: 2, altura: 2.3, tecido: 'Tecido padrão', forro: 'Blackout 70%',
      suporte: 'varao_simples', incluirColocacao: true,
    }, dCortina))
    expect(r.consumo).toBeCloseTo(5, 2)
    const mo = r.itens.find(i => i.item === 'Mão de obra')
    expect(mo?.valor).toBeCloseTo(266.67, 2)
    expect(r.subtotal).toBeCloseTo(879.17, 2)
    expect(r.parcelado).toBeCloseTo(931.92, 2)
  })

  it('Opção 02 — Wave 2,00×2,30 + franzido BK70 atrás, trilho duplo, colocada: 790,83 · 838,28', () => {
    // frente sem forro (MO só dela: 133,33); franzido 3,00m sem fita, MO 80;
    // trilho duplo = 2× a largura no preço do trilho (4,00m × 24 = 96).
    // HISTÓRICO: cobrado com fator 1,5 — no mesmo dia a loja fixou 1,8 como
    // regra (a fixture congela o 1,5 daquele orçamento; ver teste seguinte)
    const r = okC(calcularCortina({
      largura: 2, altura: 2.3, tecido: 'Tecido padrão',
      franzido: true, franzidoTecido: 'Blackout 70%',
      suporte: 'trilho_duplo', incluirColocacao: true,
    }, dCortina))
    expect(r.itens.find(i => i.item === 'Mão de obra')?.valor).toBeCloseTo(133.33, 2)
    expect(r.itens.find(i => i.item.startsWith('Franzido'))?.valor).toBeCloseTo(124.5, 2)
    expect(r.itens.find(i => i.item === 'Mão de obra do franzido')?.valor).toBeCloseTo(80, 2)
    expect(r.itens.some(i => i.item === 'Fita do franzido')).toBe(false)
    expect(r.itens.find(i => i.item === 'Trilho duplo')?.valor).toBeCloseTo(96, 2)
    expect(r.subtotal).toBeCloseTo(790.83, 2)
    expect(r.parcelado).toBeCloseTo(838.28, 2)
  })
})

describe('cortina — regras da rodada 2 (respostas da loja, 14/08 à tarde)', () => {
  const okC = (r: ReturnType<typeof calcularCortina>) => {
    if ('erro' in r) throw new Error(`cortina recusou: ${r.erro}`)
    return r
  }
  /** fixture do dia + as decisões da tarde: fator 1,8 no forro, franzidor 2,50 */
  const dRodada2: DadosCortina = {
    tecidos: dCortina.tecidos.map(t =>
      t.nome === 'Blackout 70%' ? { ...t, fator_franzido: 1.8 }
      : t.nome === 'Blackout 100%' ? { ...t, fator_franzido: 1.5 }
      : t),
    valores: [
      ...dCortina.valores.map(v => v.chave === 'fator_franzido' ? { ...v, valor: 1.8 } : v),
      { chave: 'preco_franzidor', valor: 2.5 },
      { chave: 'fator_prega_franzida', valor: 3 },
      { chave: 'acrescimo_entretela_franzido', valor: 0.1 },
      { chave: 'preco_trilho_duplo', valor: 48 },
    ],
  }

  it('franzido BK70 atrás agora usa 1,8 (decisão da loja): 3,60m, subtotal 831,73', () => {
    const r = okC(calcularCortina({
      largura: 2, altura: 2.3, tecido: 'Tecido padrão',
      franzido: true, franzidoTecido: 'Blackout 70%',
      suporte: 'trilho_duplo', incluirColocacao: true,
    }, dRodada2))
    // frente 150 + 133,33 + 157; franzido 3,6×41,5=149,40 + MO 96; trilho 96; coloc 50
    expect(r.itens.find(i => i.item.startsWith('Franzido'))?.valor).toBeCloseTo(149.4, 2)
    expect(r.itens.find(i => i.item === 'Mão de obra do franzido')?.valor).toBeCloseTo(96, 2)
    expect(r.subtotal).toBeCloseTo(831.73, 2)
  })

  it('franzido BK100 atrás fica em 1,5 (fator no cadastro do tecido)', () => {
    const r = okC(calcularCortina({
      largura: 2, altura: 2.3, tecido: 'Tecido padrão',
      franzido: true, franzidoTecido: 'Blackout 100%',
      suporte: 'trilho_duplo',
    }, dRodada2))
    // 2,00 × 1,5 = 3,00m × 69,90
    expect(r.itens.find(i => i.item.startsWith('Franzido'))?.valor).toBeCloseTo(209.7, 2)
  })

  it('Pregas 2,00×2,30: fator 3 em qualquer altura e franzidor de 2,50 no lugar da fita', () => {
    const r = okC(calcularCortina({
      modelo: 'pregas', largura: 2, altura: 2.3, tecido: 'Tecido padrão',
      suporte: 'trilho_simples',
    }, dRodada2))
    expect(r.consumo).toBeCloseTo(6, 2)                       // 2,00 × 3
    const franzidor = r.itens.find(i => i.item === 'Franzidor')
    expect(franzidor?.valor).toBeCloseTo(15, 2)               // 6,00 × 2,50
    expect(r.itens.some(i => i.item === 'Fita/entretela')).toBe(false)
    // 180 (tecido) + 160 (MO) + 15 (franzidor) + 48 (trilho) = 403
    expect(r.subtotal).toBeCloseTo(403, 2)
  })

  it('Franzida alta (2,00×3,50): corte usa entretela de 10cm, não 12', () => {
    const r = okC(calcularCortina({
      modelo: 'franzida', largura: 2, altura: 3.5, tecido: 'Tecido padrão',
      suporte: 'trilho_simples',
    }, dRodada2))
    expect(r.corte).toBeCloseTo(3.78, 2)                      // 3,50 + 0,10 + 0,18
  })

  it('Wave segue decidindo a fita pela altura (confirmado pela loja)', () => {
    const alto = okC(calcularCortina({
      largura: 2, altura: 3.5, tecido: 'Tecido padrão', suporte: 'trilho_simples',
    }, dRodada2))
    expect(alto.fator).toBe(3)
    expect(alto.corte).toBeCloseTo(3.8, 2)                    // wave mantém 0,12
  })
})

describe('cortina — orçamento de vários ambientes (o desenho do Calcular)', () => {
  const cortinaBase = {
    id: 1, modelo: 'wave' as const, tecido: 'Tecido padrão', forro: null,
    suporte: 'trilho_simples' as const, franzido: false, franzidoTecido: null,
    incluirColocacao: false,
  }

  it('soma os ambientes e aplica o acréscimo UMA vez, sobre a soma crua', () => {
    const r = calcularAmbientesCortina([
      { id: 1, nome: 'Sala', cortinas: [{ ...cortinaBase, medidas: [{ largura: '2,50', altura: '2,55', quantidade: '1' }] }] },
      { id: 2, nome: 'Suíte', cortinas: [{ ...cortinaBase, id: 2, medidas: [{ largura: '1,60', altura: '2,55', quantidade: '1' }] }] },
    ], dCortina)
    expect(r.ok).toHaveLength(2)
    // 610,42 + 390,67 nos goldens individuais
    expect(r.subtotal).toBeCloseTo(1001.08, 2)
    // 6% sobre a soma SEM arredondar antes — não sobre os subtotais arredondados
    expect(r.parcelado).toBeCloseTo(1061.15, 2)
  })

  it('medida vazia não vira item; erro de um item não derruba os outros', () => {
    const r = calcularAmbientesCortina([
      { id: 1, nome: '', cortinas: [{ ...cortinaBase, medidas: [
        { largura: '2,50', altura: '2,55', quantidade: '1' },
        { largura: '', altura: '', quantidade: '1' },          // em branco: ignora
      ] }] },
      { id: 2, nome: 'Varanda', cortinas: [{ ...cortinaBase, id: 3, suporte: 'varao_duplo',
        medidas: [{ largura: '2,00', altura: '2,30', quantidade: '1' }] }] },   // sem preço: erro
    ], dCortina)
    expect(r.ok).toHaveLength(1)
    expect(r.erros).toHaveLength(1)
    expect(r.subtotal).toBeCloseTo(610.42, 2)
  })

  it('quantidade 2 na medida dobra o item', () => {
    const r = calcularAmbientesCortina([
      { id: 1, nome: 'Sala', cortinas: [{ ...cortinaBase, medidas: [{ largura: '2,50', altura: '2,55', quantidade: '2' }] }] },
    ], dCortina)
    expect(r.subtotal).toBeCloseTo(1220.83, 2)   // 2 × 610,4166…, arredondado no fim
  })
})
