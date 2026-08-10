/**
 * Cálculo de cortina Wave — as regras da Sombrear em código.
 *
 * O ponto da existência deste arquivo: a conta é aritmética pura, com uma única
 * bifurcação (altura acima ou abaixo do limite). Feita à mão ou por um modelo de
 * linguagem, ela erra em silêncio — foi o que aconteceu no orçamento 2,20 × 5,00,
 * arredondado para 3 alturas quando o certo era 2,5.
 *
 * Duas decisões que parecem detalhe e não são:
 *  1. o número de alturas sobe de meio em meio, nunca direto para o inteiro;
 *  2. o arredondamento para centavos só acontece NO FIM. Aplicar os 6% sobre um
 *     subtotal já arredondado dá R$ 647,05 onde a loja cobra R$ 647,04.
 *
 * Onde a regra ainda não existe (varão, trilho duplo, franzido), o cálculo
 * PARA e diz o que falta. Preço inventado aqui vira prejuízo lá na frente.
 */

export interface PrecoCortinaTecido {
  nome: string
  tipo: string            // 'tecido' | 'forro'
  preco: number
  largura_rolo: number
}
export interface PrecoCortinaValor {
  chave: string
  valor: number | null
  descricao?: string | null
}
export interface DadosCortina {
  tecidos: PrecoCortinaTecido[]
  valores: PrecoCortinaValor[]
}

export type SuporteCortina = 'trilho_simples' | 'trilho_duplo' | 'varao_simples' | 'varao_duplo'

export interface EntradaCortina {
  largura: number
  altura: number
  tecido: string
  forro?: string | null
  suporte: SuporteCortina
  franzido?: boolean
  quantidade?: number
  incluirColocacao?: boolean
}

export interface ItemCortina {
  item: string
  conta: string           // como o número saiu, pra conferência
  valor: number
}

export interface ResultadoCortina {
  wave: 'regular' | 'irregular'
  fator: number
  consumo: number         // metros de tecido de UMA cortina
  alturas: number | null  // só existe no Wave irregular
  corte: number | null
  memorial: string[]      // passo a passo do consumo
  itens: ItemCortina[]
  quantidade: number
  subtotal: number        // base, sem acréscimo nem desconto
  parcelado: number       // até 4x
  avista: number
  observacoes: string[]
}

const r2 = (v: number) => Math.round((v + 1e-9) * 100) / 100
const fmtM = (v: number) => `${v.toFixed(2).replace('.', ',')}m`
const fmtR$ = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

/** 2,20 alturas viram 2,5 — sobe até o próximo passo, nunca direto pro inteiro */
const subirAoPasso = (v: number, passo: number) => Math.ceil(v / passo - 1e-9) * passo

const ROTULO_SUPORTE: Record<SuporteCortina, string> = {
  trilho_simples: 'Trilho simples', trilho_duplo: 'Trilho duplo',
  varao_simples: 'Varão simples', varao_duplo: 'Varão duplo',
}
const CHAVE_SUPORTE: Record<SuporteCortina, string> = {
  trilho_simples: 'preco_trilho_simples', trilho_duplo: 'preco_trilho_duplo',
  varao_simples: 'preco_varao_simples', varao_duplo: 'preco_varao_duplo',
}
const ehVarao = (s: SuporteCortina) => s === 'varao_simples' || s === 'varao_duplo'

export function calcularCortina(
  e: EntradaCortina, d: DadosCortina,
): ResultadoCortina | { erro: string } {
  const param = (chave: string, padrao: number) => {
    const p = d.valores.find(v => v.chave === chave)
    const n = Number(p?.valor)
    return p?.valor != null && Number.isFinite(n) ? n : padrao
  }
  /** null = a loja ainda não informou; quem chama precisa tratar */
  const paramOpcional = (chave: string): number | null => {
    const p = d.valores.find(v => v.chave === chave)
    const n = Number(p?.valor)
    return p?.valor != null && Number.isFinite(n) && n > 0 ? n : null
  }

  const L = Number(e.largura)
  const A = Number(e.altura)
  const qtd = Math.max(1, Math.round(Number(e.quantidade) || 1))
  if (!(L > 0) || !(A > 0)) return { erro: 'Informe largura e altura da cortina.' }

  if (e.franzido) {
    return {
      erro: 'Wave + franzido ainda não entra: falta a loja dizer se o franzido leva '
        + 'fita/entretela e como é a mão de obra dele. O consumo (largura × 1,5) já sabemos.',
    }
  }

  const tecido = d.tecidos.find(t => t.nome === e.tecido && t.tipo === 'tecido')
  if (!tecido) return { erro: 'Escolha o tecido da cortina.' }
  const forro = e.forro ? d.tecidos.find(t => t.nome === e.forro && t.tipo === 'forro') : null
  if (e.forro && !forro) return { erro: `Forro "${e.forro}" não está na tabela.` }

  const observacoes: string[] = []
  const memorial: string[] = []

  /* ── consumo de tecido ─────────────────────────────────────── */
  const limite = param('altura_limite_wave', 2.8)
  const larguraRolo = Number(tecido.largura_rolo) || param('largura_rolo_padrao', 3)
  const irregular = A > limite
  const fator = irregular ? param('fator_wave_irregular', 3) : param('fator_wave_regular', 2.5)

  memorial.push(`Altura ${fmtM(A)} ${irregular ? 'passa de' : 'não passa de'} ${fmtM(limite)} → Wave ${irregular ? 'irregular' : 'regular'}, fator ${String(fator).replace('.', ',')}`)
  const bruto = L * fator
  memorial.push(`${fmtM(L)} × ${String(fator).replace('.', ',')} = ${fmtM(bruto)}`)

  let consumo: number
  let alturas: number | null = null
  let corte: number | null = null

  if (!irregular) {
    // tecido corrido: a largura do rolo cobre a altura, sem virar o pano
    consumo = bruto
    memorial.push(`Tecido corrido — a altura cabe na largura de ${fmtM(larguraRolo)} do rolo, então o consumo é ${fmtM(consumo)}`)
    observacoes.push('Tecido corrido: não entra acréscimo de entretela nem de barra.')
  } else {
    // tecido invertido: conta por alturas, cada uma com sobra de entretela e barra
    const passo = param('passo_alturas', 0.5)
    const brutas = bruto / larguraRolo
    alturas = subirAoPasso(brutas, passo)
    corte = A + param('acrescimo_entretela', 0.12) + param('acrescimo_barra', 0.18)
    consumo = alturas * corte
    memorial.push(`${fmtM(bruto)} ÷ ${fmtM(larguraRolo)} = ${brutas.toFixed(2).replace('.', ',')} alturas → ${String(alturas).replace('.', ',')} alturas`)
    memorial.push(`Corte por altura: ${fmtM(A)} + 0,12 (entretela) + 0,18 (barra) = ${fmtM(corte)}`)
    memorial.push(`${String(alturas).replace('.', ',')} × ${fmtM(corte)} = ${fmtM(consumo)} de consumo`)
    if (alturas > brutas + 1e-9) {
      observacoes.push(`Aproveitamento: ${brutas.toFixed(2).replace('.', ',')} alturas subiram para ${String(alturas).replace('.', ',')}, não para ${Math.ceil(brutas)}.`)
    }
  }

  /* ── itens do orçamento (sem arredondar: só no fim) ────────── */
  const itens: ItemCortina[] = []
  const add = (item: string, conta: string, valor: number) => itens.push({ item, conta, valor })

  add(`Tecido ${tecido.nome}`, `${fmtM(consumo)} × ${fmtR$(Number(tecido.preco))}/m`, consumo * Number(tecido.preco))
  if (forro) {
    add(forro.nome, `${fmtM(consumo)} × ${fmtR$(Number(forro.preco))}/m`, consumo * Number(forro.preco))
  }

  const moFaixa = param('mo_metragem', 1.5)
  const moValor = param('mo_valor', 40)
  add('Mão de obra', `${fmtM(consumo)} ÷ ${fmtM(moFaixa)} × ${fmtR$(moValor)}`, consumo / moFaixa * moValor)

  const fita = param('preco_fita_wave', 31.4)
  add('Fita/entretela', `${fmtM(consumo)} × ${fmtR$(fita)}/m`, consumo * fita)

  /* ── suporte: trilho ou varão ──────────────────────────────── */
  const precoSuporte = paramOpcional(CHAVE_SUPORTE[e.suporte])
  if (precoSuporte == null) {
    return {
      erro: `${ROTULO_SUPORTE[e.suporte]} ainda não tem preço cadastrado. `
        + 'Peça o valor por metro à loja e cadastre em Tabela de Preços → Cortinas.',
    }
  }
  let larguraSuporte = L
  if (ehVarao(e.suporte)) {
    // varão é vendido em barra fechada: sobe para o próximo múltiplo comercial
    const passoVarao = param('passo_varao', 0.5)
    larguraSuporte = subirAoPasso(L, passoVarao)
    if (larguraSuporte > L + 1e-9) {
      observacoes.push(`Varão: ${fmtM(L)} vira ${fmtM(larguraSuporte)} (vendido de ${fmtM(passoVarao)} em ${fmtM(passoVarao)}).`)
    }
  }
  add(ROTULO_SUPORTE[e.suporte], `${fmtM(larguraSuporte)} × ${fmtR$(precoSuporte)}/m`, larguraSuporte * precoSuporte)

  if (e.incluirColocacao) {
    const colocacao = param('preco_colocacao', 25)
    add('Colocação', `${fmtM(L)} × ${fmtR$(colocacao)}/m`, colocacao * L)
  }

  /* ── fechamento: arredonda só agora ────────────────────────── */
  const subtotalCru = itens.reduce((s, i) => s + i.valor, 0) * qtd
  const subtotal = r2(subtotalCru)
  const parcelado = r2(subtotalCru * (1 + param('acrescimo_parcelado_pct', 6) / 100))
  const avista = r2(subtotalCru * (1 - param('desconto_avista_pct', 5) / 100))
  if (qtd > 1) observacoes.push(`Valor de ${qtd} cortinas iguais.`)

  return {
    wave: irregular ? 'irregular' : 'regular',
    fator, consumo: r2(consumo), alturas, corte: corte != null ? r2(corte) : null,
    memorial,
    itens: itens.map(i => ({ ...i, valor: r2(i.valor * qtd) })),
    quantidade: qtd, subtotal, parcelado, avista, observacoes,
  }
}
