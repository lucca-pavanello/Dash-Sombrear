/**
 * Edge Function: novo-cadastro
 *
 * Avisa o admin quando alguém se cadastra no dash. Substitui o workflow n8n
 * `Dash | Novo cadastro` (MWK2JKqYbo3xpQD3).
 *
 * Quem chama: trigger `notify_novo_cadastro` em `profiles`, via pg_net, com o
 * segredo compartilhado no corpo. Não há JWT — é o banco falando.
 *
 * O QUE MUDOU EM RELAÇÃO AO n8n
 * O workflow mandava e-mail (Gmail) E WhatsApp. Edge Function não tem provedor
 * de e-mail, e montar um (Resend + domínio verificado) é infraestrutura nova
 * para duplicar um aviso que o WhatsApp já entrega na hora, para a mesma
 * pessoa. Então: só WhatsApp. Se o e-mail fizer falta, ele volta como um
 * provedor de verdade, não como um segundo caminho meio configurado.
 *
 * O workflow também NÃO filtrava o admin — todo INSERT em `profiles` gerava
 * aviso, inclusive o do próprio dono. Mantido igual: paridade é com o que
 * roda, não com o que o arquivo do repo dizia.
 */
import { preflight, resposta } from '../_shared/resposta.ts'
import { segredoConfere } from '../_shared/automacao.ts'
import { enviarTexto } from '../_shared/uazapi.ts'

/** mesmo destino que estava no node do n8n */
const ADMIN_WHATSAPP = '55 17 99618-5177'
const PAINEL = 'https://dash-sombrear.vercel.app/admin'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()

  const body = await req.json().catch(() => null)
  if (!segredoConfere(body)) return resposta(401, { error: 'Não autorizado' })

  const dados = body as { nome?: unknown; email?: unknown }
  const nome = String(dados.nome ?? '').trim() || 'Sem nome'
  const email = String(dados.email ?? '').trim()
  if (!email) return resposta(400, { error: 'email é obrigatório' })

  const texto = [
    '🔔 *Novo cadastro na Sombrear*',
    '',
    `👤 ${nome}`,
    `📧 ${email}`,
    '',
    'Aguardando sua aprovação em *Admin › Usuários*:',
    PAINEL,
  ].join('\n')

  const envio = await enviarTexto(ADMIN_WHATSAPP, texto, 'edge-novocad')
  if (!envio.ok) {
    // fail-loud no log, mas 200 para o pg_net: o cadastro já aconteceu e não há
    // o que reprocessar — retornar erro só encheria net._http_response de ruído
    console.error('[novo-cadastro] falha ao avisar:', envio.erro, '| email:', email)
    return resposta(200, { ok: false, avisado: false, erro: envio.erro })
  }

  return resposta(200, { ok: true, avisado: true })
})
