/**
 * O motor de orçamento tem UM dono: src/lib/simulador.ts.
 *
 * Até 26/09 ele tinha dois. A Edge Function `simular` carregava
 * supabase/functions/simular/calc.ts, uma cópia colada à mão com os tipos
 * trocados por `any`. Essa cópia divergiu em silêncio duas vezes e uma aspa
 * órfã nela derrubou um deploy. Hoje a function importa o arquivo de verdade
 * (`../../../src/lib/simulador.ts`) e o bundler do Supabase sobe ele junto —
 * verificado com uma função-sonda antes da troca.
 *
 * Esse arranjo depende de duas regras que o TypeScript do dash NÃO cobra,
 * porque para ele está tudo certo — quem reclama é o Deno, em deploy, longe
 * daqui. Por isso elas viram teste:
 *
 *   1. O motor não pode usar o alias `@/` (o Deno não conhece o alias).
 *   2. Import relativo dele precisa de extensão `.ts` (o Deno exige).
 *   3. O arquivo de tipos não pode importar nada (qualquer import arrasta
 *      React Query ou o alias para dentro da function).
 *
 * Quebrar qualquer uma dá deploy vermelho, não teste vermelho — a menos que
 * este arquivo exista.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = join(__dirname, '..', '..', '..')
const ler = (caminho: string) => readFileSync(join(raiz, caminho), 'utf-8').replace(/\r\n/g, '\n')

/** só as linhas de import, sem comentário nem código */
function imports(texto: string): string[] {
  return texto.split('\n').filter((l) => /^\s*(import|export)\s.*\sfrom\s/.test(l))
}

describe('o motor tem um dono só', () => {
  it('a cópia manual do motor não existe mais', () => {
    expect(existsSync(join(raiz, 'supabase/functions/simular/calc.ts'))).toBe(false)
  })

  it('a edge function importa o motor de verdade', () => {
    expect(ler('supabase/functions/simular/index.ts'))
      .toContain("from '../../../src/lib/simulador.ts'")
  })

  it('o motor não usa o alias @/ (o Deno não resolve)', () => {
    for (const linha of imports(ler('src/lib/simulador.ts'))) {
      expect(linha).not.toMatch(/from\s+['"]@\//)
    }
  })

  it('todo import relativo do motor traz a extensão .ts (o Deno exige)', () => {
    for (const linha of imports(ler('src/lib/simulador.ts'))) {
      const alvo = linha.match(/from\s+['"](\.[^'"]+)['"]/)?.[1]
      if (alvo) expect(alvo).toMatch(/\.ts$/)
    }
  })

  it('o arquivo de tipos não importa nada', () => {
    expect(imports(ler('src/lib/precos/tipos.ts'))).toEqual([])
  })
})
