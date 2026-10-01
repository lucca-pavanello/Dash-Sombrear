/**
 * Conversa do banco → pedido de resumo → campos do CRM. Sem import: roda na edge function
 * e nos testes.
 *
 * O pedido é o mesmo que o ramo RESUMO do n8n "Desfecho do atendimento" usava, com duas
 * diferenças: lê a conversa inteira (o n8n via só as 20 últimas mensagens) e diz quem da
 * equipe falou e por onde.
 */

export type MensagemResumo = {
  autor: 'cliente' | 'ia' | 'equipe'
  autor_nome: string | null
  canal_envio: 'chatwoot' | 'celular' | null
  conteudo: string | null
  anexos: { tipo: string | null }[] | null
  excluida: boolean
  enviada_em: string
}

export type LeadResumo = {
  nome: string | null
  modelo_interesse: string | null
  ambiente: string | null
  ultimo_valor_cotado: string | null
}

const MAX_MENSAGENS = 150
const MAX_CARACTERES = 12_000

const ANEXO: Record<string, string> = { audio: 'áudio', image: 'foto', video: 'vídeo', file: 'arquivo', location: 'localização' }

function hora(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  // horário de Rio Preto (UTC-3, sem horário de verão)
  const sp = new Date(d.getTime() - 3 * 3600_000)
  return `${p(sp.getUTCDate())}/${p(sp.getUTCMonth() + 1)} ${p(sp.getUTCHours())}:${p(sp.getUTCMinutes())}`
}

function quem(m: MensagemResumo): string {
  if (m.autor === 'cliente') return 'CLIENTE'
  if (m.autor === 'ia') return 'IA'
  return m.canal_envio === 'celular' ? 'LOJA (celular)' : `LOJA (${m.autor_nome || 'equipe'})`
}

/** uma linha por mensagem, das mais recentes que cabem */
export function transcrever(msgs: MensagemResumo[]): string {
  const linhas = msgs
    .filter(m => !m.excluida)
    .map(m => {
      const anexos = (m.anexos ?? []).map(a => `[${ANEXO[a.tipo ?? ''] ?? 'anexo'}]`).join(' ')
      const texto = [String(m.conteudo ?? '').replace(/\s+/g, ' ').trim(), anexos].filter(Boolean).join(' ')
      return texto ? `[${hora(m.enviada_em)}] ${quem(m)}: ${texto}` : ''
    })
    .filter(Boolean)
    .slice(-MAX_MENSAGENS)
  let saida = linhas.join('\n')
  while (saida.length > MAX_CARACTERES && linhas.length > 1) {
    linhas.shift()
    saida = linhas.join('\n')
  }
  return saida
}

export function montarPedido(lead: LeadResumo, conversa: string): string {
  return [
    'Voce le conversas de WhatsApp da SOMBREAR (loja de persianas e cortinas em Rio Preto)',
    'e mantem o CRM em dia. Esta conversa esta sendo tocada pela EQUIPE da loja (a IA nao responde nela).',
    '',
    'O que o CRM ja sabe:',
    '- Cliente: ' + (lead.nome || 'sem nome'),
    '- Produto: ' + ([lead.modelo_interesse, lead.ambiente].filter(Boolean).join(' / ') || 'nao identificado'),
    '- Valor cotado pela IA: ' + (lead.ultimo_valor_cotado || 'nao cotado'),
    '',
    'Regras:',
    '- Descreva SO o que esta escrito. Nao invente medida, valor nem intencao.',
    '- Audio, foto e arquivo aparecem entre colchetes: voce nao sabe o que tem neles, nao deduza.',
    '- resumo: como esta a conversa agora, em 1 a 3 frases curtas: o que o cliente quer,',
    '  o que a loja ja fez (orcamento, valor, visita) e onde parou. Sem data e sem nome de atendente.',
    '- temperatura: QUENTE (quer resolver agora / falou em fechar), MORNO (interessado, sem decisao),',
    '  FRIO (so perguntou, sumiu ou nao demonstrou interesse), CLIENTE (ja comprou / pos-venda).',
    '- proxima_acao: o proximo passo concreto da LOJA, em ate 10 palavras.',
    '- interesse: modelo/produto citado (ex: "rolo blackout sala"), vazio se nao houver.',
    '- pendencia: o que falta pra avancar (medida, cor, aprovacao, pagamento...), vazio se nada.',
    '',
    'Responda SOMENTE com JSON valido:',
    '{"resumo":"<1 a 3 frases>","temperatura":"QUENTE|MORNO|FRIO|CLIENTE","proxima_acao":"<ate 10 palavras>","interesse":"<ou vazio>","pendencia":"<ou vazio>"}',
    '',
    '=== CONVERSA ===',
    conversa,
  ].join('\n')
}

export type CamposCrm = {
  resumo_conversa: string
  lead_temperatura: string | null
  lead_proxima_acao: string | null
  status_motivo: string | null
}

const TEMPERATURAS = ['QUENTE', 'MORNO', 'FRIO', 'CLIENTE']

/** null quando a resposta não serve: não inventa nada, tenta de novo na próxima rodada */
export function lerResposta(texto: string): CamposCrm | null {
  const a = texto.indexOf('{')
  const b = texto.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  let d: Record<string, unknown>
  try { d = JSON.parse(texto.slice(a, b + 1)) } catch { return null }
  const s = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  const resumo = s(d.resumo, 600)
  if (!resumo) return null
  const temp = s(d.temperatura, 20).toUpperCase()
  const interesse = s(d.interesse, 120)
  const pendencia = s(d.pendencia, 200)
  const motivo = [interesse && `Interesse: ${interesse}`, pendencia && `Falta: ${pendencia}`].filter(Boolean).join(' | ')
  return {
    resumo_conversa: resumo,
    lead_temperatura: TEMPERATURAS.includes(temp) ? temp : null,
    lead_proxima_acao: s(d.proxima_acao, 200) || null,
    status_motivo: motivo || null,
  }
}
