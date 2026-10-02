/**
 * Conversa do banco → os dois trechos (IA e equipe) → pedido de leitura → campos do CRM.
 * Sem Deno.*: roda na edge function e nos testes.
 *
 * A PASSAGEM é a primeira mensagem da equipe. Tudo antes dela é o trecho da IA (cliente +
 * Amanda); dela em diante é o trecho da equipe (o que a IA ainda falar ali fica junto, é
 * contexto). O trecho da IA só existe se a Amanda falou antes da passagem; o da equipe,
 * se a equipe entrou.
 */
import { transcrever, type MensagemResumo } from '../resumir-conversas/prompt.ts'
import { FALHAS, OBJECOES } from '../_shared/taxonomia.ts'

export type MensagemFase = MensagemResumo

export type Trechos = { ia: MensagemFase[] | null; equipe: MensagemFase[] | null; passagem: string | null }

export function dividirNaPassagem(msgs: MensagemFase[]): Trechos {
  const ordenadas = [...msgs].sort((a, b) => a.enviada_em.localeCompare(b.enviada_em))
  const i = ordenadas.findIndex(m => m.autor === 'equipe')
  const antes = i < 0 ? ordenadas : ordenadas.slice(0, i)
  return {
    ia: antes.some(m => m.autor === 'ia') ? antes : null,
    equipe: i < 0 ? null : ordenadas.slice(i),
    passagem: i < 0 ? null : ordenadas[i].enviada_em,
  }
}

/** Cada trecho cabe em ~8 mil caracteres: os mais recentes ficam (transcrever corta do começo). */
const MAX_TRECHO = 8_000
function limitar(t: string): string {
  if (t.length <= MAX_TRECHO) return t
  const corte = t.indexOf('\n', t.length - MAX_TRECHO)
  return '[…]\n' + t.slice(corte < 0 ? t.length - MAX_TRECHO : corte + 1)
}

export type LeadFases = { nome: string | null; modelo_interesse: string | null }

function hojeEmRioPreto(agora: Date): string {
  const sp = new Date(agora.getTime() - 3 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(sp.getUTCDate())}/${p(sp.getUTCMonth() + 1)} ${p(sp.getUTCHours())}:${p(sp.getUTCMinutes())}`
}

export function montarPedido(lead: LeadFases, trechos: Trechos, agora: Date): string {
  const ia = trechos.ia ? limitar(transcrever(trechos.ia)) : ''
  const equipe = trechos.equipe ? limitar(transcrever(trechos.equipe)) : ''
  return [
    'Voce le conversas de WhatsApp da SOMBREAR (cortinas e persianas sob medida em Rio Preto).',
    'Cada conversa vem partida em dois trechos: o da IA (a Amanda, que faz a recepcao) e o da',
    'EQUIPE da loja (as pessoas, que assumem depois). Leia cada trecho SEPARADO: o que o cliente',
    'disse no trecho da IA nao vale para o trecho da equipe, e vice-versa.',
    '',
    'Cliente: ' + (lead.nome || 'sem nome') + ' · Produto citado: ' + (lead.modelo_interesse || 'nao identificado'),
    'Agora: ' + hojeEmRioPreto(agora) + ' (horario de Rio Preto).',
    '',
    'Regras gerais:',
    '- Marque SO o que esta escrito. O que voce deduziu nao conta.',
    '- [áudio], [foto], [vídeo] e [arquivo] sao anexos: voce NAO sabe o que tem neles. Nunca',
    '  marque falha de "nao respondeu" se a loja mandou audio logo depois da pergunta.',
    '- Nada que esta pendente ha menos de 1 dia util conta como falha: a conversa ainda esta andando.',
    '',
    'OBJECOES do cliente (use so estes slugs, quantos couberem, pode ser nenhum):',
    ...OBJECOES.map(o => `- "${o.id}": ${o.criterio}`),
    '',
    'FALHAS da equipe (so no trecho da equipe; use so estes slugs, pode ser nenhum):',
    ...FALHAS.map(f => `- "${f.id}": ${f.criterio}`),
    '',
    'Para o trecho da IA, devolva:',
    '- objecoes: slugs; objecao_outro: texto curto so se usou "outro".',
    '- motivo: 1 frase concreta do que aconteceu com o cliente na mao da Amanda e onde parou.',
    '- sensibilidade_preco: "alta" (preco foi o assunto, pediu desconto, recuou pelo valor),',
    '  "media" (comentou o valor e seguiu) ou "baixa" (preco nao pesou).',
    'Para o trecho da equipe, devolva:',
    '- assunto: "venda" (venda nova ou orcamento), "pos_venda" (instalacao, entrega, conserto,',
    '  limpeza do que ja comprou) ou "nao_cliente" (fornecedor, parceiro, assunto interno).',
    '  Com "nao_cliente", devolva objecoes e falhas vazias.',
    '- objecoes, objecao_outro, sensibilidade_preco: como acima, so com o que o cliente disse a equipe.',
    '- falhas: slugs; falha_outro: texto curto so se usou "outro".',
    '- motivo: 1 frase concreta de como a equipe conduziu e onde parou, sem nome de atendente.',
    '',
    'Trecho que nao existe vem como "(nao existe)": devolva null para ele.',
    'Responda SOMENTE com JSON valido:',
    '{"ia":{"objecoes":[],"objecao_outro":"","motivo":"","sensibilidade_preco":"baixa"} ou null,',
    ' "equipe":{"assunto":"venda","objecoes":[],"objecao_outro":"","falhas":[],"falha_outro":"","motivo":"","sensibilidade_preco":"baixa"} ou null}',
    '',
    '=== TRECHO DA IA ===',
    ia || '(nao existe)',
    '',
    '=== TRECHO DA EQUIPE ===',
    equipe || '(nao existe)',
  ].join('\n')
}

export type CamposIa = {
  ia_objecao_tags: string[]
  ia_objecao_outro: string | null
  ia_motivo: string | null
  ia_sensibilidade_preco: string | null
}

export type CamposEquipe = {
  equipe_assunto: 'venda' | 'pos_venda' | 'nao_cliente'
  equipe_objecao_tags: string[]
  equipe_objecao_outro: string | null
  equipe_falhas: string[]
  equipe_falha_outro: string | null
  equipe_motivo: string | null
  equipe_sensibilidade_preco: string | null
}

const OBJ = new Set(OBJECOES.map(o => o.id))
const FAL = new Set(FALHAS.map(f => f.id))
const SENS = new Set(['baixa', 'media', 'alta'])
const ASSUNTOS = new Set(['venda', 'pos_venda', 'nao_cliente'])

const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null
/** slug fora da lista é descartado: gravado, sumiria da contagem do dash sem aviso */
const slugs = (v: unknown, validos: Set<string>) =>
  Array.isArray(v) ? [...new Set(v.map(String).filter(s => validos.has(s)))] : []

/**
 * Só devolve campo de trecho que existe. `undefined` = a resposta não serve (tenta de novo
 * na próxima rodada, sem gravar nada).
 */
export function lerResposta(bruto: string, trechos: Trechos):
  { ia: CamposIa | null; equipe: CamposEquipe | null } | undefined {
  const a = bruto.indexOf('{')
  const b = bruto.lastIndexOf('}')
  if (a < 0 || b <= a) return undefined
  let d: Record<string, unknown>
  try { d = JSON.parse(bruto.slice(a, b + 1)) } catch { return undefined }

  let ia: CamposIa | null = null
  if (trechos.ia) {
    const r = d.ia as Record<string, unknown> | null | undefined
    if (!r || typeof r !== 'object') return undefined
    const tags = slugs(r.objecoes, OBJ)
    ia = {
      ia_objecao_tags: tags,
      ia_objecao_outro: tags.includes('outro') ? texto(r.objecao_outro, 200) : null,
      ia_motivo: texto(r.motivo, 300),
      ia_sensibilidade_preco: SENS.has(String(r.sensibilidade_preco)) ? String(r.sensibilidade_preco) : null,
    }
  }

  let equipe: CamposEquipe | null = null
  if (trechos.equipe) {
    const r = d.equipe as Record<string, unknown> | null | undefined
    if (!r || typeof r !== 'object') return undefined
    const assunto = ASSUNTOS.has(String(r.assunto)) ? String(r.assunto) as CamposEquipe['equipe_assunto'] : 'venda'
    const naoCliente = assunto === 'nao_cliente'
    const tags = naoCliente ? [] : slugs(r.objecoes, OBJ)
    const falhas = naoCliente ? [] : slugs(r.falhas, FAL)
    equipe = {
      equipe_assunto: assunto,
      equipe_objecao_tags: tags,
      equipe_objecao_outro: tags.includes('outro') ? texto(r.objecao_outro, 200) : null,
      equipe_falhas: falhas,
      equipe_falha_outro: falhas.includes('outro') ? texto(r.falha_outro, 200) : null,
      equipe_motivo: texto(r.motivo, 300),
      equipe_sensibilidade_preco: SENS.has(String(r.sensibilidade_preco)) ? String(r.sensibilidade_preco) : null,
    }
  }
  return { ia, equipe }
}
