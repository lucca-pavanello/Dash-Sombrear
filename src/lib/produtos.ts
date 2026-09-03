/**
 * Família de produto — o vocabulário único pra agrupar "que produto essa conversa é".
 *
 * Por que existe: o repo tem QUATRO listas de modelo que não batem entre si —
 * `MODELOS` (src/lib/constants.ts, o formulário), `MODELOS_PERSIANA`
 * (src/hooks/usePrecos.ts, o motor de preço), as chaves de `MODELO_RULES` e as listas
 * locais de TabSimulador/CalculadoraCortina. Nenhuma delas serve pra ler texto solto de
 * WhatsApp: "PH Alumínio", "rolô blackout" e "romeu e julieta" chegam como o cliente
 * escreveu.
 *
 * Escopo: agrupar conversa por produto nos Insights. NÃO é pra substituir as listas
 * acima nem pra alimentar cálculo de preço — o motor continua com o vocabulário dele.
 *
 * Regra de ouro: nunca chutar produto. O pré-preenchimento do formulário
 * (TabAgenteIA.leadToOrcamentoInitial) cai em 'Rolo' quando não reconhece — lá faz
 * sentido, é um campo que a pessoa confere antes de salvar, e o texto original vai
 * junto nas observações. Aqui não: numa contagem, chutar produto inventa estatística.
 * Sem reconhecer = `sem_produto`.
 */

export type ProdutoId =
  | 'rolo'
  | 'rolo_motorizado'
  | 'double'
  | 'romana'
  | 'horizontal'
  | 'vertical'
  | 'painel'
  | 'cortina'

export type Produto = {
  id: ProdutoId
  rotulo: string
  cor: string
}

export const PRODUTOS: readonly Produto[] = [
  { id: 'rolo',            rotulo: 'Rolô',              cor: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  { id: 'rolo_motorizado', rotulo: 'Rolô motorizado',   cor: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  { id: 'double',          rotulo: 'Double Vision',     cor: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  { id: 'romana',          rotulo: 'Romana',            cor: 'border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300' },
  { id: 'horizontal',      rotulo: 'Horizontal (PH)',   cor: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' },
  { id: 'vertical',        rotulo: 'Vertical (PV)',     cor: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  { id: 'painel',          rotulo: 'Painel',            cor: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  { id: 'cortina',         rotulo: 'Cortina',           cor: 'border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300' },
] as const

export const SEM_PRODUTO = {
  id: 'sem_produto' as const,
  rotulo: 'Não identificado',
  cor: 'border-border bg-muted/60 text-muted-foreground',
}

export const PRODUTO_IDS: readonly string[] = PRODUTOS.map(p => p.id)

/** Tira acento e baixa a caixa: "Rolô Blackout" e "rolo blackout" viram a mesma coisa. */
function achatar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Padrões em ORDEM DE PRECISÃO — o primeiro que casar vence. Motorizado tem que vir
 * antes de rolô (senão "rolô motorizado" vira só rolô) e as siglas curtas (pv, ph 50)
 * exigem fronteira de palavra, pra "pv" não casar dentro de outra palavra.
 */
const PADROES: ReadonlyArray<{ id: ProdutoId; re: RegExp }> = [
  { id: 'rolo_motorizado', re: /motoriz|\bmotor\b|automatiz/ },
  { id: 'double',          re: /double|romeu|julieta/ },
  { id: 'romana',          re: /romana/ },
  { id: 'horizontal',      re: /horizontal|\bph[\s_-]?50\b|\bph[\s_-]?alum|aluminio/ },
  { id: 'vertical',        re: /vertical|\bpv\b/ },
  { id: 'painel',          re: /painel/ },
  { id: 'cortina',         re: /cortina|\bwave\b|varao/ },
  { id: 'rolo',            re: /rolo|\brole\b|tela solar|screen/ },
]

/**
 * Reconhece a família de produto num texto livre ("persiana rolô tela solar 3%",
 * "PH Alumínio", "PV blackout") ou num id já canônico vindo do banco.
 * Não reconheceu → `SEM_PRODUTO`, nunca um palpite.
 */
export function acharProduto(valor: string | null | undefined): Produto | typeof SEM_PRODUTO {
  const texto = achatar(valor ?? '')
  if (!texto) return SEM_PRODUTO
  // id canônico volta direto (o banco guarda o slug; a tela reenvia pra cá ao agrupar)
  const exato = PRODUTOS.find(p => p.id === texto)
  if (exato) return exato
  const achado = PADROES.find(p => p.re.test(texto))
  return achado ? PRODUTOS.find(p => p.id === achado.id)! : SEM_PRODUTO
}
