/**
 * O motor vive em dois lugares: src/lib/simulador.ts (dash) e
 * supabase/functions/simular/calc.ts (edge function dos agentes). O espelho
 * é sincronizado à mão — e já divergiu em silêncio duas vezes, além de uma
 * aspa órfã que derrubou o deploy da edge.
 *
 * Este teste compara os dois arquivos ignorando SÓ o cabeçalho de imports
 * (o dash importa tipos; o espelho usa aliases `any` pro Deno). Qualquer
 * outra diferença = alguém mexeu num lado e esqueceu o outro.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = join(__dirname, '..', '..', '..')

/** corpo do arquivo sem o bloco de imports/aliases do topo */
function corpo(caminho: string): string {
  const texto = readFileSync(join(raiz, caminho), 'utf-8')
  const inicio = texto.indexOf('export type ModeloSim')
  if (inicio < 0) throw new Error(`${caminho}: não achei o início do corpo`)
  return texto.slice(inicio).replace(/\r\n/g, '\n')
}

describe('espelho da edge function', () => {
  it('calc.ts é idêntico ao simulador.ts fora do cabeçalho', () => {
    expect(corpo('supabase/functions/simular/calc.ts'))
      .toBe(corpo('src/lib/simulador.ts'))
  })

  it('o cabeçalho do espelho não tem aspas órfãs (já derrubou deploy)', () => {
    const texto = readFileSync(join(raiz, 'supabase/functions/simular/calc.ts'), 'utf-8')
    const cabecalho = texto.slice(0, texto.indexOf('export type ModeloSim'))
    expect(cabecalho).not.toMatch(/= any'/)
  })
})
