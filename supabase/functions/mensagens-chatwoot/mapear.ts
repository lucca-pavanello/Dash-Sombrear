/**
 * Mensagem do Chatwoot → linha de `mensagens_sombrear`. Sem import de propósito: roda
 * na edge function e nos testes do vitest.
 *
 * O Chatwoot entrega a mesma mensagem em dois formatos: pela API (message_type número,
 * created_at em segundos) e pelo webhook (message_type texto, created_at ISO). As duas
 * entradas passam por aqui.
 *
 * QUEM FALOU (medido em 01/10/2026 nas 15.631 mensagens da conta 1):
 * - cliente: message_type 0 / 'incoming'.
 * - IA: o n8n da Amanda marca content_attributes.autor = 'stella_ia'. Algumas saem pelo
 *   usuário "Atendente Amanda" sem a marca (quase todas apagadas ou vazias): também IA.
 * - equipe pelo Chatwoot: usuário da loja (Stella), sem source_id.
 * - equipe pelo celular: a loja responde pelo WhatsApp, o WhatsApp devolve uma cópia e o
 *   Chatwoot grava no usuário dono do token da integração (hoje "Lucca"), COM source_id.
 *   O nome desse usuário não é de quem escreveu, então autor_nome fica null.
 * - message_type 2 (evento do sistema: atribuição, etiqueta) não é mensagem e não entra.
 */

export type Autor = 'cliente' | 'ia' | 'equipe'

export type LinhaMensagem = {
  id: number
  conversa_id: number
  inbox_id: number | null
  telefone: string | null
  autor: Autor
  autor_nome: string | null
  canal_envio: 'chatwoot' | 'celular' | null
  privada: boolean
  conteudo: string | null
  tipo_conteudo: string | null
  anexos: { tipo: string | null; url: string | null; nome: string | null }[]
  excluida: boolean
  responde_a: number | null
  enviada_em: string
}

type Remetente = { type?: string | null; name?: string | null; phone_number?: string | null } | null

export type MensagemChatwoot = {
  id: number
  content?: string | null
  content_type?: string | null
  message_type?: number | string | null
  private?: boolean | null
  created_at?: number | string | null
  source_id?: string | null
  content_attributes?: Record<string, unknown> | null
  sender?: Remetente
  attachments?: { file_type?: string | null; data_url?: string | null; file_name?: string | null }[] | null
  conversation_id?: number | null
  inbox_id?: number | null
  conversation?: { id?: number; inbox_id?: number; meta?: { sender?: Remetente } } | null
}

const NOME_IA = 'atendente amanda'
const USUARIO_ESPELHO_CELULAR = 'lucca'

function tipoDaMensagem(m: MensagemChatwoot): 'entrada' | 'saida' | 'evento' | 'modelo' {
  const t = m.message_type
  if (t === 0 || t === 'incoming') return 'entrada'
  if (t === 1 || t === 'outgoing') return 'saida'
  if (t === 3 || t === 'template') return 'modelo'
  return 'evento'
}

function dataIso(v: number | string | null | undefined): string | null {
  if (v == null || v === '') return null
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** null quando não é mensagem (evento do sistema) ou falta o essencial */
export function mapearMensagem(m: MensagemChatwoot, telefoneConversa?: string | null): LinhaMensagem | null {
  const tipo = tipoDaMensagem(m)
  if (tipo === 'evento') return null
  const conversa = m.conversation_id ?? m.conversation?.id ?? null
  const enviada = dataIso(m.created_at)
  if (!m.id || !conversa || !enviada) return null

  const attrs = (m.content_attributes ?? {}) as Record<string, unknown>
  const remetente = m.sender ?? null
  const nome = (remetente?.name ?? '').trim()

  let autor: Autor
  let canal: LinhaMensagem['canal_envio'] = null
  let autorNome: string | null = nome || null
  if (tipo === 'entrada') {
    autor = 'cliente'
    autorNome = null
  } else if (attrs.autor === 'stella_ia' || nome.toLowerCase() === NOME_IA || remetente?.type === 'agent_bot') {
    autor = 'ia'
    autorNome = 'Amanda'
  } else {
    autor = 'equipe'
    const veioDoCelular = !!m.source_id && nome.toLowerCase() === USUARIO_ESPELHO_CELULAR
    canal = veioDoCelular ? 'celular' : 'chatwoot'
    if (veioDoCelular) autorNome = null
  }

  const resposta = attrs.in_reply_to
  return {
    id: Number(m.id),
    conversa_id: Number(conversa),
    inbox_id: m.inbox_id ?? m.conversation?.inbox_id ?? null,
    telefone: telefoneConversa ?? m.conversation?.meta?.sender?.phone_number
      ?? (tipo === 'entrada' ? remetente?.phone_number ?? null : null),
    autor,
    autor_nome: autorNome,
    canal_envio: canal,
    privada: !!m.private,
    conteudo: m.content ?? null,
    tipo_conteudo: m.content_type ?? null,
    anexos: (m.attachments ?? []).map(a => ({ tipo: a.file_type ?? null, url: a.data_url ?? null, nome: a.file_name ?? null })),
    excluida: attrs.deleted === true,
    responde_a: typeof resposta === 'number' ? resposta : null,
    enviada_em: enviada,
  }
}
