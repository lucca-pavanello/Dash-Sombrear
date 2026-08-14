/**
 * Cálculo de cortina — as regras da Sombrear em código (Wave, Pregas e
 * Franzida, os três modelos que a loja vende).
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
 * Onde a loja ainda não respondeu (hoje: só o varão duplo), o cálculo PARA e
 * diz o que falta — preço inventado aqui vira prejuízo lá na frente. Nenhuma
 * dessas pendências exige mexer neste arquivo de novo: todas são valores em
 * precos_cortina_valores, preenchidos pela tela de preços.
 *
 * Validado ao centavo (14/08/2026) contra dois orçamentos reais da loja:
 * Wave+BK70 costurado junto em varão (R$ 879,17) e Wave + franzido atrás em
 * trilho duplo (R$ 790,83) — ver src/lib/__tests__/cortina.test.ts.
 */

export interface PrecoCortinaTecido {
  nome: string
  tipo: string            // 'tecido' | 'forro'
  preco: number
  largura_rolo: number
  /** custo de compra por metro — informativo (venda = custo × margem) */
  custo?: number | null
  /** fator de franzimento quando este forro vai FRANZIDO atrás (BK100 = 1,5; BK70/Classic = 1,8) */
  fator_franzido?: number | null
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
export type ModeloCortina = 'wave' | 'pregas' | 'franzida'

export interface EntradaCortina {
  /** wave (padrão), pregas ou franzida — resposta da loja de 14/08 */
  modelo?: ModeloCortina
  largura: number
  altura: number
  tecido: string
  forro?: string | null
  suporte: SuporteCortina
  /** painel de trás franzido (Wave na frente + franzido atrás) */
  franzido?: boolean
  franzidoTecido?: string | null
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
  /** igual ao de cima, mas 0 é resposta legítima ("não leva fita") */
  const paramOpcionalZero = (chave: string): number | null => {
    const p = d.valores.find(v => v.chave === chave)
    const n = Number(p?.valor)
    return p?.valor != null && Number.isFinite(n) ? n : null
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

  const tecido = d.tecidos.find(t => t.nome === e.tecido && t.tipo === 'tecido')
  if (!tecido) return { erro: 'Escolha o tecido da cortina.' }
  const forro = e.forro ? d.tecidos.find(t => t.nome === e.forro && t.tipo === 'forro') : null
  if (e.forro && !forro) return { erro: `Forro "${e.forro}" não está na tabela.` }

  const observacoes: string[] = []
  const memorial: string[] = []

  /* ── consumo de tecido ─────────────────────────────────────── */
  const modelo: ModeloCortina = e.modelo ?? 'wave'
  const limite = param('altura_limite_wave', 2.8)
  const larguraRolo = Number(tecido.largura_rolo) || param('largura_rolo_padrao', 3)
  const irregular = A > limite
  // Wave: a altura decide a fita — regular ×2,5, irregular ×3 (loja, 14/08).
  // Pregas e Franzida: sempre ×3, não importa a altura.
  const fator = modelo === 'wave'
    ? (irregular ? param('fator_wave_irregular', 3) : param('fator_wave_regular', 2.5))
    : param('fator_prega_franzida', 3)

  if (modelo === 'wave') {
    memorial.push(`Altura ${fmtM(A)} ${irregular ? 'passa de' : 'não passa de'} ${fmtM(limite)} → Wave ${irregular ? 'irregular' : 'regular'}, fator ${String(fator).replace('.', ',')}`)
  } else {
    memorial.push(`Modelo ${modelo === 'pregas' ? 'Pregas' : 'Franzida'}: fator ${String(fator).replace('.', ',')} em qualquer altura`)
  }
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
    // barra 18cm sempre; entretela 12cm no Wave/Pregas, 10cm na Franzida
    const entretelaCorte = modelo === 'franzida'
      ? param('acrescimo_entretela_franzido', 0.10)
      : param('acrescimo_entretela', 0.12)
    corte = A + entretelaCorte + param('acrescimo_barra', 0.18)
    consumo = alturas * corte
    memorial.push(`${fmtM(bruto)} ÷ ${fmtM(larguraRolo)} = ${brutas.toFixed(2).replace('.', ',')} alturas → ${String(alturas).replace('.', ',')} alturas`)
    memorial.push(`Corte por altura: ${fmtM(A)} + ${entretelaCorte.toFixed(2).replace('.', ',')} (entretela) + 0,18 (barra) = ${fmtM(corte)}`)
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

  // Forro costurado junto passa na máquina junto: a mão de obra conta a
  // metragem dos DOIS panos. Provado no orçamento real de 14/08:
  // (5,00 + 5,00) ÷ 1,50 × R$ 40 = R$ 266,67 — não 133,33 só da frente.
  const metragemMo = consumo * (forro ? 2 : 1)
  const moFaixa = param('mo_metragem', 1.5)
  const moValor = param('mo_valor', 40)
  add('Mão de obra',
    forro
      ? `(${fmtM(consumo)} + ${fmtM(consumo)}) ÷ ${fmtM(moFaixa)} × ${fmtR$(moValor)}`
      : `${fmtM(consumo)} ÷ ${fmtM(moFaixa)} × ${fmtR$(moValor)}`,
    metragemMo / moFaixa * moValor)

  // Wave leva a fita/entretela; Pregas e Franzida levam franzidor (loja, 14/08)
  const fita = modelo === 'wave' ? param('preco_fita_wave', 31.4) : param('preco_franzidor', 2.5)
  add(modelo === 'wave' ? 'Fita/entretela' : 'Franzidor',
    `${fmtM(consumo)} × ${fmtR$(fita)}/m`, consumo * fita)

  /* ── painel franzido atrás (regras vêm do banco, não daqui) ── */
  if (e.franzido) {
    const levaFita = paramOpcionalZero('franzido_leva_fita')
    const moIgual = paramOpcionalZero('franzido_mo_igual')
    if (levaFita == null || moIgual == null) {
      return {
        erro: 'O franzido ainda depende de duas respostas da loja: se ele leva fita/entretela e '
          + 'se a mão de obra usa a mesma conta do Wave. Preencha em Tabela de Preços → Cortinas '
          + '(franzido leva fita / franzido mo igual) e o cálculo passa a sair sozinho.',
      }
    }
    const tecidoFr = d.tecidos.find(x => x.nome === e.franzidoTecido)
      ?? d.tecidos.find(x => x.nome === (forro?.nome ?? ''))
      ?? tecido
    // o fator mora no tecido do forro (BK100 = 1,5; BK70/Classic = 1,8);
    // sem fator no cadastro, vale o padrão da loja (1,8 — decisão de 14/08,
    // por mais que o orçamento histórico daquela data tenha usado 1,5)
    const fatorFr = Number(tecidoFr.fator_franzido) > 0
      ? Number(tecidoFr.fator_franzido)
      : param('fator_franzido', 1.8)
    const consumoFr = L * fatorFr
    memorial.push(`Franzido atrás: ${fmtM(L)} × ${String(fatorFr).replace('.', ',')} = ${fmtM(consumoFr)}`)
    add(`Franzido — ${tecidoFr.nome}`, `${fmtM(consumoFr)} × ${fmtR$(Number(tecidoFr.preco))}/m`,
      consumoFr * Number(tecidoFr.preco))
    if (moIgual === 1) {
      add('Mão de obra do franzido', `${fmtM(consumoFr)} ÷ ${fmtM(moFaixa)} × ${fmtR$(moValor)}`,
        consumoFr / moFaixa * moValor)
    }
    if (levaFita === 1) {
      const franzidor = param('preco_franzidor', 2.5)
      add('Franzidor do franzido', `${fmtM(consumoFr)} × ${fmtR$(franzidor)}/m`, consumoFr * franzidor)
    }
    observacoes.push('Franzido: a loja arredonda o consumo para menos quando o corte permite — confira antes de fechar.')
  }

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
  if (modelo !== 'wave') {
    observacoes.push('Pregas/Franzida seguem as regras passadas pela loja em 14/08, mas ainda não foram conferidas contra um orçamento real — confira antes de fechar.')
  }

  return {
    wave: irregular ? 'irregular' : 'regular',
    fator, consumo: r2(consumo), alturas, corte: corte != null ? r2(corte) : null,
    memorial,
    itens: itens.map(i => ({ ...i, valor: r2(i.valor * qtd) })),
    quantidade: qtd, subtotal, parcelado, avista, observacoes,
  }
}
