/**
 * Revisão diária da Amanda: o que dá pra melhorar nas conversas de um dia.
 *
 * Tudo aqui é conta de código sobre as mensagens gravadas — a IA só escreve a leitura
 * e cita trecho literal. Mesma divisão da revisão do Garimpo, de onde este desenho veio
 * (clientes/garimpo-studio, `analise-conversas`): número é do código, frase é do modelo.
 *
 * Sem import de propósito: roda dentro da Edge Function (Deno, onde o alias `@/` não
 * existe) e nos testes do vitest, com a mesma definição nos dois lados.
 *
 * O QUE ESTA REVISÃO OLHA
 * Só a Amanda, por decisão do Lucca em 02/10. Vale dizer o que isso significa aqui: na
 * Sombrear quem fala é gente. Em 01/10 foram 181 mensagens de cliente, 218 da equipe e
 * 15 da Amanda. Então a revisão lê as conversas em que a IA FALOU no dia e ignora o
 * resto — e é esperado que algumas noites tenham pouca coisa, ou nada.
 */

export type MensagemRevisao = {
  id: number
  conversa_id: number
  lead_id: string | null
  autor: 'cliente' | 'ia' | 'equipe'
  autor_nome: string | null
  canal_envio: 'chatwoot' | 'celular' | null
  conteudo: string | null
  anexos: { tipo: string | null }[] | null
  excluida: boolean
  privada: boolean
  enviada_em: string
}

export type LeadRevisao = { id: string; nome: string | null }

export type ConversaDoDia = {
  /** o nome que a IA usa pra citar ("Conversa 3") — ela nunca vê id nem telefone */
  rotulo: string
  conversa_id: number
  lead_id: string | null
  nome: string | null
  msgs: MensagemRevisao[]
}

/** o cliente escreveu enquanto a conversa era da IA e ela não respondeu */
export type SemResposta = {
  conversa: string
  hora: string
  texto: string
  respondeu: 'equipe' | null
  espera_min: number | null
}

export type Gravidade = 'alta' | 'media' | 'baixa'

export type Melhoria = {
  conversa: string
  o_que_aconteceu: string
  como_fica_melhor: string
  trecho: string
  gravidade: Gravidade
}

export type Revisao = { resumo: string; melhorias: Melhoria[] }

export type BaseRevisao = {
  dia: string
  conversas: ConversaDoDia[]
  semResposta: SemResposta[]
  pedido: string
}

const MAX_CONVERSAS = 30
const MAX_MENSAGENS = 40
const MAX_FALA = 400
/** o cliente que escreveu nos últimos minutos ainda pode ser respondido: não é silêncio */
const MINUTOS_DE_TOLERANCIA = 10

const ANEXO: Record<string, string> = {
  audio: 'áudio', image: 'foto', video: 'vídeo', file: 'arquivo', location: 'localização',
}

/**
 * A Amanda avisando que a conversa passou para gente. Daqui para a frente o silêncio
 * dela é o combinado, mesmo que a equipe só escreva minutos depois.
 *
 * As frases são fixas: moram no Code node `code_handoff | pedido_ou_pessoa` do workflow
 * da Amanda, não no prompt — mudou lá, mudar aqui. Sem isto, a primeira revisão de
 * verdade (02/10) apontou como "sem resposta" duas mensagens que a cliente mandou DEPOIS
 * de a Amanda dizer "Já passei pra equipe de cortinas, eles seguem com você daqui", e
 * que a equipe respondeu em 1 minuto. Era o handoff funcionando, não falha.
 */
const RE_HANDOFF = /(j[áa] )?pass(ei|o|ando|ar)\s+(voc[êe]\s+)?(pra|para)\s+(a\s+)?(equipe|stella|atendente|respons[áa]vel)|vou\s+(te\s+)?passar|chamei\s+a\s+equipe|a\s+equipe\s+(segue|assume|continua|vai)|eles\s+seguem\s+com\s+voc[êe]|algu[ée]m\s+da\s+equipe\s+(te\s+)?(chama|responde|retorna)/i

/** "ok", "obrigado", "👍": não esperam resposta, e cobrar silêncio aí é ruído */
const RE_CORTESIA = /^(ok|okay|blz|beleza|t[aá] bom|tabom|certo|perfeito|show|valeu|vlw|obrigad[oa]|obg|brigad[oa]|de nada|imagina|bom dia|boa tarde|boa noite|sim|n[aã]o|👍|🙏|❤️|😊|👏)[\s!.…]*$/i

const p2 = (n: number) => String(n).padStart(2, '0')

/** Rio Preto é UTC-3 o ano todo (não há horário de verão desde 2019) */
function naCasa(iso: string): Date {
  return new Date(new Date(iso).getTime() - 3 * 3600_000)
}

/** o dia da casa de um instante, em 'AAAA-MM-DD' */
export function diaNaCasa(iso: string): string {
  const d = naCasa(iso)
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`
}

export function horaNaCasa(iso: string): string {
  const d = naCasa(iso)
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`
}

/** 'AAAA-MM-DD' → '02/10', que é como a tela e o pedido falam de data */
export function rotuloDoDia(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
}

function texto(m: MensagemRevisao): string {
  const anexos = (m.anexos ?? []).map(a => `[${ANEXO[a.tipo ?? ''] ?? 'anexo'}]`).join(' ')
  return [String(m.conteudo ?? '').replace(/\s+/g, ' ').trim(), anexos].filter(Boolean).join(' ')
}

function cortar(t: string, max: number): string {
  return t.length <= max ? t : t.slice(0, max) + '…'
}

function quem(m: MensagemRevisao): string {
  if (m.autor === 'cliente') return 'CLIENTE'
  if (m.autor === 'ia') return 'AMANDA'
  return m.canal_envio === 'celular' ? 'EQUIPE (celular)' : `EQUIPE (${m.autor_nome || 'loja'})`
}

/** mensagem que conta: não é privada, não foi apagada e tem o que ler */
function vale(m: MensagemRevisao): boolean {
  return !m.privada && !m.excluida && texto(m).length > 0
}

/**
 * As conversas que entram na revisão: as que a IA respondeu NO DIA e em que o cliente
 * falou. Conversa que só a equipe tocou não ensina nada sobre a Amanda, e conversa em
 * que só a IA falou (disparo, lembrete) não tem o outro lado pra julgar.
 *
 * As maiores primeiro: é onde há mais o que aprender, e o corte em 30 é o que cabe num
 * pedido sem a transcrição começar a ser truncada.
 */
export function conversasDoDia(e: {
  dia: string
  mensagens: MensagemRevisao[]
  leads?: LeadRevisao[]
}): ConversaDoDia[] {
  const nomes = new Map((e.leads ?? []).map(l => [l.id, l.nome]))
  const porConversa = new Map<number, MensagemRevisao[]>()
  for (const m of e.mensagens) {
    if (!vale(m) || diaNaCasa(m.enviada_em) !== e.dia) continue
    const lista = porConversa.get(m.conversa_id)
    if (lista) lista.push(m)
    else porConversa.set(m.conversa_id, [m])
  }
  return [...porConversa.entries()]
    .map(([conversa_id, msgs]) => ({
      conversa_id,
      msgs: msgs.sort((a, b) => a.enviada_em.localeCompare(b.enviada_em) || a.id - b.id),
    }))
    .filter(({ msgs }) => msgs.some(m => m.autor === 'ia') && msgs.some(m => m.autor === 'cliente'))
    .sort((a, b) => b.msgs.length - a.msgs.length || a.conversa_id - b.conversa_id)
    .slice(0, MAX_CONVERSAS)
    .map(({ conversa_id, msgs }, i) => {
      const lead_id = msgs.find(m => m.lead_id)?.lead_id ?? null
      return {
        rotulo: `Conversa ${i + 1}`,
        conversa_id,
        lead_id,
        nome: lead_id ? nomes.get(lead_id) ?? null : null,
        msgs,
      }
    })
}

/**
 * Cliente que escreveu e a Amanda ficou calada.
 *
 * Só conta enquanto a conversa ainda era da IA: até a equipe falar, ou até a própria
 * Amanda anunciar o handoff — o que vier primeiro. Depois disso o silêncio dela é o
 * combinado, não uma falha. Sem essa regra a seção encheria de linhas de conversa em
 * atendimento humano, que é a maioria aqui.
 *
 * `ateMs` é o fim da janela (fim do dia, ou agora quando a revisão roda no próprio dia):
 * quem escreveu nos últimos minutos ainda pode ser respondido.
 */
export function semRespostaDaIA(conversas: ConversaDoDia[], ateMs: number): SemResposta[] {
  const limite = ateMs - MINUTOS_DE_TOLERANCIA * 60_000
  const fora: SemResposta[] = []
  for (const c of conversas) {
    // a conversa deixa de ser da IA no que vier primeiro: a equipe falar, ou a própria
    // Amanda avisar que passou adiante
    const entrega = c.msgs.find(m =>
      m.autor === 'equipe' || (m.autor === 'ia' && RE_HANDOFF.test(texto(m))))
    const corte = entrega ? Date.parse(entrega.enviada_em) : Infinity
    for (let i = 0; i < c.msgs.length; i++) {
      const m = c.msgs[i]
      if (m.autor !== 'cliente') continue
      const quando = Date.parse(m.enviada_em)
      if (quando >= corte || quando > limite) continue
      const t = texto(m)
      if (RE_CORTESIA.test(t)) continue
      const resposta = c.msgs.slice(i + 1).find(x => x.autor !== 'cliente')
      if (resposta?.autor === 'ia') continue
      fora.push({
        conversa: c.rotulo,
        hora: horaNaCasa(m.enviada_em),
        texto: cortar(t, 300),
        respondeu: resposta ? 'equipe' : null,
        espera_min: resposta
          ? Math.round((Date.parse(resposta.enviada_em) - quando) / 60_000)
          : null,
      })
    }
  }
  return fora
}

/** a conversa como o dono leria: uma linha por mensagem, com a hora e quem falou */
export function transcrever(c: ConversaDoDia, semResposta: SemResposta[]): string {
  const linhas = c.msgs.slice(0, MAX_MENSAGENS)
    .map(m => `${quem(m)} (${horaNaCasa(m.enviada_em)}): ${cortar(texto(m), MAX_FALA)}`)
  const silencios = semResposta.filter(s => s.conversa === c.rotulo)
  return [
    `### ${c.rotulo}`,
    ...linhas,
    ...silencios.map(s =>
      `SEM RESPOSTA DA AMANDA (${s.hora}): «${s.texto}» ${
        s.respondeu ? `(a equipe respondeu ${s.espera_min} min depois)` : '(ninguém respondeu)'}`),
  ].join('\n')
}

/**
 * As regras da casa que servem de régua.
 *
 * O prompt de verdade da Amanda mora no nó `Secretaria` do workflow n8n
 * `X4m4xyhiekL36m8h`, que esta função não alcança. Isto aqui é um resumo do que a loja
 * já decidiu e cobrou, lido do histórico do projeto — mudou o prompt lá, atualize aqui,
 * senão a revisão vai cobrar uma regra que não existe mais (ou deixar passar uma nova).
 */
export const REGRAS_DA_CASA = [
  'A Amanda atende pela Sombrear, loja de persianas e cortinas em São José do Rio Preto. Assina como "Atendente Amanda".',
  'Ela orça persiana pelas calculadoras da loja. CORTINA SOB MEDIDA ela NÃO cota: encaminha para a equipe.',
  'Preço só sai da calculadora. Ela nunca estima, nunca arredonda de cabeça e nunca promete desconto.',
  'Quando falta medida, modelo ou tecido para calcular, ela pergunta — não inventa o que falta.',
  'Instalação e frete são cobrados à parte, e ela diz isso quando passa o valor.',
  'Quando o assunto sai do que ela resolve (reclamação, pós-venda, negociação, pedido já fechado), ela passa para a equipe e avisa o cliente disso.',
  'Tom: direto, cordial e sem gíria. Sem emoji em excesso e sem tratar o cliente por apelido.',
] as const

export function montarPedido(b: Omit<BaseRevisao, 'pedido'>): string {
  const transcricoes = b.conversas.map(c => transcrever(c, b.semResposta)).join('\n\n')
  return `Você revisa, a pedido do dono da loja, as conversas de WhatsApp que a Amanda (a IA da Sombrear) teve em ${rotuloDoDia(b.dia)}. Ele lê isso à noite para ver o que dá pra melhorar na IA e pedir o ajuste, sem abrir conversa por conversa.

COMO A AMANDA DEVE TRABALHAR:
${REGRAS_DA_CASA.map(r => `- ${r}`).join('\n')}

CONVERSAS DO DIA (${b.conversas.length}; a hora entre parênteses é a de cada mensagem):
${transcricoes || '(a Amanda não respondeu nenhuma conversa neste dia)'}

Como ler: "AMANDA" é a IA. "EQUIPE" é gente da loja respondendo pelo Chatwoot ou pelo celular — nada que a EQUIPE disse vira melhoria da IA, e horário, preço ou prazo que a EQUIPE deu não foi a Amanda que inventou. Na Sombrear a maior parte do atendimento é humana: é normal a IA aparecer pouco numa conversa, e isso sozinho não é ponto de melhoria.

O que conta como PONTO DE MELHORIA:
- resposta que não faz sentido naquela altura da conversa, ou que ignora o que o cliente acabou de dizer;
- pergunta que o cliente já tinha respondido (ex.: ele já disse a medida e a Amanda pergunta de novo);
- regra acima que ela não seguiu: cotar cortina sob medida, estimar preço de cabeça, prometer o que não pode;
- informação errada ou inventada: medida, valor, prazo, material;
- conversa que ficou pendurada sem a Amanda passar para a equipe quando devia.

NÃO é ponto de melhoria: a IA seguir uma regra da casa; o cliente sumir; a equipe assumir a conversa; a Amanda ficar quieta depois que uma pessoa entrou na conversa; qualquer fala da EQUIPE.
As linhas "SEM RESPOSTA DA AMANDA" já aparecem para o dono em uma seção própria: não repita como melhoria, só cite no resumo se pesarem no dia.
Antes de sugerir "como fica melhor", confira que a frase sugerida também segue as regras acima.

Responda SOMENTE com um JSON válido, sem texto fora dele:
{
 "resumo": "1 ou 2 frases: quantas conversas, como foi o dia e a melhoria que mais importa",
 "melhorias": [{"conversa": "Conversa N", "o_que_aconteceu": "o que a Amanda fez, em uma frase", "como_fica_melhor": "como fica melhor, com a frase exata entre aspas", "trecho": "a fala da Amanda, citada literalmente", "gravidade": "alta|media|baixa"}]
}
Regras da resposta: no máximo 8 melhorias, da que mais ajuda a vender para a menos; conversa sem o que melhorar não entra; se não houve nenhuma, "melhorias": [] e o resumo diz que o dia foi bem; tom de melhoria, nunca de erro ou culpa (nada de "erro", "errou", "falhou", "problema", "devia": diga o que ela fez e como fica melhor); nunca invente, toda citação sai literalmente das conversas acima e o "trecho" é sempre uma fala da AMANDA, nunca da EQUIPE nem do cliente; português do Brasil com acento, sem travessão e sem emoji; sem jargão (fluxo, gatilho, loop, follow).`
}

/** o pedido pronto, com as conversas e os silêncios já calculados */
export function montarRevisao(e: {
  dia: string
  mensagens: MensagemRevisao[]
  leads?: LeadRevisao[]
  ateMs?: number
}): BaseRevisao {
  const conversas = conversasDoDia(e)
  const ate = e.ateMs ?? Date.parse(`${e.dia}T23:59:59-03:00`)
  const semResposta = semRespostaDaIA(conversas, ate)
  return { dia: e.dia, conversas, semResposta, pedido: montarPedido({ dia: e.dia, conversas, semResposta }) }
}

const GRAVIDADES: Gravidade[] = ['alta', 'media', 'baixa']

function limpar(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/**
 * Lê o JSON do modelo. `rotulos` é o conjunto de conversas que existem de verdade:
 * melhoria que cita conversa inexistente é descartada, porque a tela liga o rótulo à
 * conversa do Chatwoot e um rótulo inventado viraria um link para lugar nenhum.
 *
 * null = a resposta não serve. A revisão vira "erro" e ninguém vê número inventado.
 */
export function lerRevisao(texto: string, rotulos: Iterable<string>): Revisao | null {
  const a = texto.indexOf('{')
  const b = texto.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  let d: Record<string, unknown>
  try { d = JSON.parse(texto.slice(a, b + 1)) } catch { return null }

  const resumo = limpar(d.resumo, 600)
  if (!resumo) return null

  const validos = new Set(rotulos)
  const brutas = Array.isArray(d.melhorias) ? d.melhorias : []
  const melhorias: Melhoria[] = []
  for (const x of brutas) {
    if (melhorias.length >= 8) break
    if (!x || typeof x !== 'object') continue
    const m = x as Record<string, unknown>
    const conversa = limpar(m.conversa, 40)
    const oQue = limpar(m.o_que_aconteceu, 400)
    if (!validos.has(conversa) || !oQue) continue
    const g = limpar(m.gravidade, 10).toLowerCase() as Gravidade
    melhorias.push({
      conversa,
      o_que_aconteceu: oQue,
      como_fica_melhor: limpar(m.como_fica_melhor, 500),
      trecho: limpar(m.trecho, 300),
      gravidade: GRAVIDADES.includes(g) ? g : 'media',
    })
  }
  return { resumo, melhorias }
}
