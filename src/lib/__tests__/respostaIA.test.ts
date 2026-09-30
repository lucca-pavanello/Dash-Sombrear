import { describe, expect, it } from 'vitest'
import { blocosDaResposta, partesDoTexto } from '@/lib/respostaIA'

describe('blocosDaResposta', () => {
  it('separa parágrafo, lista e tabela', () => {
    const b = blocosDaResposta('Fechou **12 vendas**.\n\n- Conversão de 18%\n- Ticket de R$ 3.200\n\n| Vendedor | Vendas |\n|---|---|\n| Rogério | 5 |\n| Thais | 4 |')
    expect(b.map(x => x.tipo)).toEqual(['paragrafo', 'lista', 'tabela'])
    expect(b[1]).toEqual({ tipo: 'lista', itens: ['Conversão de 18%', 'Ticket de R$ 3.200'], numerada: false })
    expect(b[2]).toEqual({ tipo: 'tabela', cabecalho: ['Vendedor', 'Vendas'], linhas: [['Rogério', '5'], ['Thais', '4']] })
  })

  it('lista numerada não se mistura com a de marcador', () => {
    const b = blocosDaResposta('1. Ligar\n2. Mandar foto\n- solto')
    expect(b).toEqual([
      { tipo: 'lista', itens: ['Ligar', 'Mandar foto'], numerada: true },
      { tipo: 'lista', itens: ['solto'], numerada: false },
    ])
  })

  it('título vira negrito e quebra simples fica no mesmo parágrafo', () => {
    expect(blocosDaResposta('## Resumo\nlinha dois')).toEqual([{ tipo: 'paragrafo', texto: '**Resumo**\nlinha dois' }])
  })

  it('linha com barra que não é tabela continua texto', () => {
    expect(blocosDaResposta('A | B sem separador')).toEqual([{ tipo: 'paragrafo', texto: 'A | B sem separador' }])
  })
})

describe('partesDoTexto', () => {
  it('marca só o que está entre dois asteriscos duplos', () => {
    expect(partesDoTexto('Receita de **R$ 38,4 mil** no mês, 2*3')).toEqual([
      { texto: 'Receita de ', negrito: false },
      { texto: 'R$ 38,4 mil', negrito: true },
      { texto: ' no mês, 2*3', negrito: false },
    ])
  })
})
