/**
 * Taxonomia de objeções — o vocabulário fixo com que a IA etiqueta cada conversa.
 *
 * Por que existe: até 09/2026 o card de Insights mandava 40 conversas pro Gemini e
 * recebia um TEXTO. Texto não se conta, não se agrupa por produto, não se filtra por
 * período e não tem identidade estável — a cada clique a redação muda, então "essa
 * melhoria eu já resolvi" não tinha em que se apoiar. Aqui a IA só escolhe slugs desta
 * lista; quem conta é o código. Mesma doutrina do filtro de lead: o agente extrai, o
 * código julga.
 *
 * A lista foi fechada lendo conversa real do CRM (amostra de 32, 03/09/2026), não por
 * intuição. O que apareceu de fato está marcado abaixo. Objeção que não couber em
 * nenhum slug entra como `outro` + texto livre em `crm_sombrear_ia.objecao_outro` —
 * essa é a fila de descoberta: se um mesmo tema reaparecer ali, vira slug novo.
 *
 * ⚠️ Esta lista é espelhada na Edge Function `supabase/functions/classificar-conversas`
 * (runtime Deno, não importa de src/). Mudou aqui, muda lá — senão a função grava slug
 * que o dash não sabe exibir, e ele some da contagem sem ninguém perceber.
 *
 * Cor: o laranja da marca fica de fora de propósito — laranja é ação e seleção, não
 * categoria (mesma regra de ORIGENS em SeloOrigem.tsx e do DESIGN.md).
 */

export type ObjecaoId =
  | 'foto_tecido'
  | 'preco_alto'
  | 'desconto_avista'
  | 'custo_instalacao'
  | 'orcamento_apertado'
  | 'prazo_entrega'
  | 'manutencao_limpeza'
  | 'decisao_terceiro'
  | 'duvida_medida'
  | 'comprou_outro'
  | 'adiou'
  | 'outro'

export type Objecao = {
  id: ObjecaoId
  rotulo: string
  /** o que a IA deve procurar na conversa — vira instrução no prompt do classificador */
  criterio: string
  /** o que a loja pode fazer a respeito — alimenta a sugestão de ação do card */
  dica: string
  cor: string
}

export const OBJECOES: readonly Objecao[] = [
  {
    id: 'foto_tecido',
    rotulo: 'Dúvida visual do tecido',
    // visto em conversa real: "após esclarecer dúvidas sobre a visibilidade e proteção
    // da tela de 1% versus 3%, optou pela Tela Solar 3%"
    criterio: 'não consegue imaginar como o tecido fica: transparência, se dá pra ver de fora, quanto escurece, diferença entre Tela Solar 1% e 3%, quer ver foto real',
    dica: 'Mandar foto real comparando as opções junto do orçamento, antes de perguntarem.',
    cor: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  {
    id: 'preco_alto',
    rotulo: 'Achou caro',
    criterio: 'reagiu ao valor como alto, comparou com o que esperava gastar, disse que está fora do orçamento',
    dica: 'Mostrar a opção mais econômica da mesma função antes de perder o lead.',
    cor: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  {
    id: 'desconto_avista',
    rotulo: 'Pede desconto / à vista',
    criterio: 'pede desconto, condição especial, ou pergunta o valor à vista / parcelado',
    dica: 'Já apresentar a condição à vista na proposta inicial, sem esperar pedirem.',
    cor: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    id: 'custo_instalacao',
    rotulo: 'Instalação/frete à parte',
    criterio: 'estranhou que instalação ou frete são cobrados à parte, ou pediu pacote com instalação inclusa',
    dica: 'Detalhar o custo de instalação junto do produto, não como surpresa no fim.',
    cor: 'border-orange-900/25 bg-orange-900/10 text-orange-900 dark:text-orange-200',
  },
  {
    id: 'orcamento_apertado',
    rotulo: 'Precisa caber no orçamento',
    criterio: 'quer reduzir metragem, quantidade de peças ou trocar por modelo mais barato para o total caber num teto',
    dica: 'Oferecer fazer por etapas (ambientes prioritários primeiro) em vez de cortar qualidade.',
    cor: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  {
    id: 'prazo_entrega',
    rotulo: 'Prazo de entrega',
    // visto em conversa real: "temos alguma previsão para a instalação?" e
    // "cobrando uma posição pois a diretoria está exigindo retorno"
    criterio: 'achou o prazo longo, tem data limite, ou está cobrando previsão de entrega/instalação',
    dica: 'Dar prazo com data ao fechar e avisar proativamente quando mudar.',
    cor: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  {
    id: 'manutencao_limpeza',
    rotulo: 'Manutenção / limpeza',
    // visto em conversa real: "a cortina da sala precisa de manutenção, o trilho está
    // soltando, podemos agendar pro técnico vir?" e "troca de kit comando"
    criterio: 'quer conserto, troca de peça, manutenção ou limpeza de persiana já instalada — sua ou de terceiros',
    dica: 'A loja FAZ alguns desses serviços: pedir foto e confirmar com a equipe, nunca negar de saída.',
    cor: 'border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  {
    id: 'decisao_terceiro',
    rotulo: 'Depende de outra pessoa',
    // visto em conversa real: "disse que vai falar com o marido"
    criterio: 'precisa consultar cônjuge, sócio, diretoria, arquiteto ou síndico antes de decidir',
    dica: 'Mandar a proposta num formato que a pessoa consiga repassar sozinha.',
    cor: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  },
  {
    id: 'duvida_medida',
    rotulo: 'Insegurança na medida',
    criterio: 'não sabe medir, confundiu medida do vão com a final, ou tem medo de errar e receber peça errada',
    dica: 'Explicar vão x final em uma frase e oferecer a medição técnica.',
    cor: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  {
    id: 'comprou_outro',
    rotulo: 'Foi pro concorrente',
    criterio: 'disse que comprou ou fechou em outro lugar, ou que achou mais barato em outra loja',
    dica: 'Registrar o valor do concorrente quando ele contar — é o dado que falta pra decidir preço.',
    cor: 'border-rose-900/25 bg-rose-900/10 text-rose-900 dark:text-rose-200',
  },
  {
    id: 'adiou',
    rotulo: 'Adiou a compra',
    criterio: 'deixou pra depois: obra não pronta, mudança futura, "ano que vem", sem urgência',
    dica: 'Combinar quando voltar a falar em vez de deixar a conversa morrer.',
    cor: 'border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
  {
    id: 'outro',
    rotulo: 'Outra objeção',
    criterio: 'travou por um motivo real que não cabe em nenhum item acima — descreva em objecao_outro',
    dica: 'Ler o texto livre: se o mesmo tema repetir, vira categoria própria.',
    cor: 'border-border bg-muted/60 text-muted-foreground',
  },
] as const

export const SEM_OBJECAO = {
  id: 'sem_objecao' as const,
  rotulo: 'Sem objeção',
  criterio: '',
  dica: '',
  cor: 'border-border bg-muted/60 text-muted-foreground',
}

/** Só os ids — usado pra validar o que a IA devolveu antes de contar. */
export const OBJECAO_IDS: readonly string[] = OBJECOES.map(o => o.id)

/**
 * Normaliza o que veio do banco. Diferente de `acharOrigem`, aqui NÃO inventamos
 * categoria nova pra valor desconhecido: slug fora da lista é dado sujo (a Edge
 * Function já descarta na gravação), e exibir isso como se fosse categoria válida
 * mascararia o defeito. Volta como `SEM_OBJECAO`.
 */
export function acharObjecao(valor: string | null | undefined): Objecao | typeof SEM_OBJECAO {
  const chave = (valor ?? '').toLowerCase().trim()
  if (!chave) return SEM_OBJECAO
  return OBJECOES.find(o => o.id === chave) ?? SEM_OBJECAO
}

export const SENSIBILIDADES = ['baixa', 'media', 'alta'] as const
export type Sensibilidade = (typeof SENSIBILIDADES)[number]
