import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OBJECAO_IDS } from '../insights/taxonomia'
import { PRODUTO_IDS } from '../produtos'

/**
 * A taxonomia vive DUAS vezes: aqui em src/ e dentro da Edge Function
 * `classificar-conversas` (runtime Deno, que não importa de src/).
 *
 * Essa duplicação tem um modo de falha silencioso e caro: se a função gravar um slug que
 * o dash não conhece, `acharObjecao` devolve SEM_OBJECAO e a conversa simplesmente
 * DESAPARECE da contagem — sem erro, sem log, sem nada na tela. O número fica errado e
 * ninguém descobre. O inverso (slug no dash que a função nunca produz) é mais benigno,
 * mas indica lista desatualizada do mesmo jeito.
 *
 * Este teste lê o arquivo da função e compara as duas listas. Se você mudar uma, ele
 * quebra até você mudar a outra — que é exatamente o comportamento desejado.
 */
const ARQUIVO_FUNCAO = resolve(__dirname, '../../../supabase/functions/classificar-conversas/index.ts')

function slugsDaEdgeFunction(): { objecoes: string[]; produtos: string[] } {
  const fonte = readFileSync(ARQUIVO_FUNCAO, 'utf8').replace(/\r\n/g, '\n')

  const blocoObj = fonte.match(/const OBJECOES: Array<\{ id: string; criterio: string \}> = \[([\s\S]*?)\n\]/)
  if (!blocoObj) throw new Error('não achei o array OBJECOES na Edge Function — o formato mudou?')
  const objecoes = [...blocoObj[1].matchAll(/\{\s*id:\s*'([^']+)'/g)].map(m => m[1])

  const blocoProd = fonte.match(/const PRODUTOS = new Set\(\[([\s\S]*?)\]\)/)
  if (!blocoProd) throw new Error('não achei o Set PRODUTOS na Edge Function — o formato mudou?')
  const produtos = [...blocoProd[1].matchAll(/'([^']+)'/g)].map(m => m[1])

  return { objecoes, produtos }
}

describe('taxonomia espelhada na Edge Function', () => {
  const daFuncao = slugsDaEdgeFunction()

  it('a lista de objeções é idêntica dos dois lados', () => {
    expect([...daFuncao.objecoes].sort()).toEqual([...OBJECAO_IDS].sort())
  })

  it('a lista de produtos é idêntica dos dois lados', () => {
    expect([...daFuncao.produtos].sort()).toEqual([...PRODUTO_IDS].sort())
  })

  it('a Edge Function não perdeu a validação por slug', () => {
    // sem esses dois filtros, valor inventado pelo modelo entraria direto no banco
    const fonte = readFileSync(ARQUIVO_FUNCAO, 'utf8')
    expect(fonte).toContain('OBJECAO_IDS.has(t)')
    expect(fonte).toContain('PRODUTOS.has(String(item.produto))')
  })
})
