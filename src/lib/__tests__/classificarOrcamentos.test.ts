import { describe, expect, it } from 'vitest'
import { lerVereditos, montarPedido } from '../../../supabase/functions/classificar-orcamentos/prompt'

describe('lerVereditos', () => {
  it('lê a lista mesmo com texto em volta e arredonda o valor', () => {
    const v = lerVereditos('aqui: [{"id":1,"eh_orcamento":true,"valor":1362.404,"opcoes":2,"produto":"rolo blackout"},{"id":2,"eh_orcamento":false,"valor":42}]', [1, 2])
    expect(v).toEqual([
      { id: 1, eh_orcamento: true, valor: 1362.4, opcoes: 2, produto: 'rolo blackout' },
      { id: 2, eh_orcamento: false, valor: null, opcoes: null, produto: null },
    ])
  })

  it('ignora id que não foi pedido, repetido ou sem veredito', () => {
    const v = lerVereditos('[{"id":9,"eh_orcamento":true},{"id":1,"eh_orcamento":"sim"},{"id":2,"eh_orcamento":true,"valor":"x"},{"id":2,"eh_orcamento":false}]', [1, 2])
    expect(v).toEqual([{ id: 2, eh_orcamento: true, valor: null, opcoes: null, produto: null }])
  })

  it('resposta sem JSON não grava nada', () => {
    expect(lerVereditos('não consegui', [1])).toEqual([])
  })
})

describe('montarPedido', () => {
  it('leva id, quem mandou e o contexto de cada mensagem', () => {
    const p = montarPedido([{ id: 7, autor: 'equipe', conteudo: 'Valor final R$ 2.960,00', contexto: 'CLIENTE: e o valor?' }])
    expect(p).toContain('### id 7 (equipe da loja)')
    expect(p).toContain('CLIENTE: e o valor?')
    expect(p).toContain('Valor final R$ 2.960,00')
  })
})
