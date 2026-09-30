/**
 * A resposta do copilot em blocos: parágrafo, lista e tabela, com `**negrito**` dentro.
 *
 * Veio do "Converse com a IA" do Garimpo (`crm/src/lib/converseIA.ts`), sem o bloco de
 * gráfico. Existe em vez do `react-markdown` porque o projeto não tem o `remark-gfm`, e sem
 * ele a tabela que o Gemini manda sai como texto cru cheio de `|`. Nunca vira HTML: cada
 * pedaço é texto puro que o React escapa.
 */

export type Bloco =
  | { tipo: 'paragrafo'; texto: string }
  | { tipo: 'lista'; itens: string[]; numerada: boolean }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] }

const celulas = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
const ITEM = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/

export function blocosDaResposta(texto: string): Bloco[] {
  const blocos: Bloco[] = []
  const linhas = texto.replace(/\r/g, '').split('\n')
  let i = 0
  let paragrafo: string[] = []
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: 'paragrafo', texto: paragrafo.join('\n').trim() })
    paragrafo = []
  }
  while (i < linhas.length) {
    const l = linhas[i]
    // cerca de código: o conteúdo entra como parágrafo, sem as crases
    if (/^```/.test(l.trim())) {
      fecharParagrafo()
      const corpo: string[] = []
      i++
      while (i < linhas.length && !/^```/.test(linhas[i].trim())) corpo.push(linhas[i++])
      i++
      if (corpo.join('').trim()) blocos.push({ tipo: 'paragrafo', texto: corpo.join('\n') })
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < linhas.length && /^\s*\|?\s*:?-{2,}/.test(linhas[i + 1])) {
      fecharParagrafo()
      const cabecalho = celulas(l)
      i += 2
      const corpo: string[][] = []
      while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) corpo.push(celulas(linhas[i++]))
      blocos.push({ tipo: 'tabela', cabecalho, linhas: corpo })
      continue
    }
    const item = l.match(ITEM)
    if (item) {
      fecharParagrafo()
      const numerada = !!item[1]
      const itens: string[] = []
      while (i < linhas.length) {
        const m = linhas[i].match(ITEM)
        if (!m || !!m[1] !== numerada) break
        itens.push(m[2]); i++
      }
      blocos.push({ tipo: 'lista', itens, numerada })
      continue
    }
    if (!l.trim()) { fecharParagrafo(); i++; continue }
    // título markdown (# …) vira negrito: o painel tem 360px, não cabe hierarquia de h1/h2
    paragrafo.push(/^#{1,6}\s+/.test(l) ? `**${l.replace(/^#{1,6}\s+/, '')}**` : l)
    i++
  }
  fecharParagrafo()
  return blocos
}

/** `**negrito**` → partes; o resto é texto puro */
export function partesDoTexto(texto: string): { texto: string; negrito: boolean }[] {
  return texto.split(/(\*\*[^*\n]+\*\*)/g).filter(Boolean).map(p =>
    /^\*\*[^*\n]+\*\*$/.test(p) ? { texto: p.slice(2, -2), negrito: true } : { texto: p, negrito: false })
}
