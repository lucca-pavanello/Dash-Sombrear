/**
 * Edge Function: revisao-diaria
 *
 * A revisão das conversas da Amanda num dia: o que dá pra melhorar, com a fala citada
 * e como ficaria melhor. O dono lê à noite e pede o ajuste, sem abrir conversa por
 * conversa. Desenho copiado da revisão diária do Garimpo (`analise-conversas`), com a
 * diferença de que aqui as mensagens já estão no banco (`mensagens_sombrear`, 0023) e
 * não precisam ser buscadas no Chatwoot na hora.
 *
 * Duas portas:
 *  - pg_cron, todo dia às 21h de Rio Preto (migração 0030), com o segredo do Vault;
 *  - admin logado no dash, que pode pedir a revisão de um dia: { dia: 'AAAA-MM-DD' }.
 *
 * Responde na hora com o id e faz o trabalho em segundo plano (EdgeRuntime.waitUntil):
 * a leitura do modelo leva minutos e o navegador não pode ficar pendurado. A tela
 * acompanha a linha em `revisoes_ia` até sair de 'rodando'.
 *
 * Os NÚMEROS saem de código (src/lib/revisao/dia.ts, testado); o modelo só escreve a
 * leitura e cita trecho literal. Se algo falha no meio, a linha vira 'erro' com uma
 * frase — nunca fica 'rodando' para sempre.
 *
 * Deploy: npx supabase functions deploy revisao-diaria --no-verify-jwt
 *   O `--no-verify-jwt` é obrigatório e não afasta ninguém: o pg_cron chama sem JWT, e
 *   a plataforma rejeitaria a chamada com 401 ANTES de chegar aqui (foi o que aconteceu
 *   no primeiro disparo). Quem confere a identidade é esta função: segredo do Vault para
 *   o cron, getUser + profiles.is_admin para o dash. Todas as outras chamadas por cron
 *   do projeto estão assim.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { preflight, resposta } from '../_shared/resposta.ts'
import { segredoConfere } from '../_shared/automacao.ts'
import { pedirTexto } from '../_shared/muse.ts'
import {
  casarFotos, diaNaCasa, lerRevisao, montarRevisao,
  type LeadRevisao, type MensagemRevisao,
} from '../../../src/lib/revisao/dia.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const EH_DIA = /^\d{4}-\d{2}-\d{2}$/
/** uma revisão que começou há mais que isto travou no meio; outra pode tomar o lugar */
const MINUTOS_ATE_DESISTIR = 15

async function mensagensDoDia(dia: string): Promise<MensagemRevisao[]> {
  const { data, error } = await db.from('mensagens_sombrear')
    .select('id, conversa_id, lead_id, autor, autor_nome, canal_envio, conteudo, anexos, excluida, privada, enviada_em')
    .gte('enviada_em', `${dia}T00:00:00-03:00`)
    .lte('enviada_em', `${dia}T23:59:59-03:00`)
    .order('enviada_em')
    .limit(5000)
  if (error) throw new Error(`mensagens: ${error.message}`)
  return (data ?? []) as MensagemRevisao[]
}

async function leadsDe(ids: string[]): Promise<LeadRevisao[]> {
  if (!ids.length) return []
  const { data, error } = await db.from('crm_sombrear_ia').select('id, nome').in('id', ids)
  if (error) throw new Error(`leads: ${error.message}`)
  return (data ?? []) as LeadRevisao[]
}

/** o trabalho de verdade: roda depois da resposta, e sempre fecha a linha */
async function revisar(id: string, dia: string, hoje: boolean): Promise<void> {
  try {
    const mensagens = await mensagensDoDia(dia)
    const leads = await leadsDe([...new Set(mensagens.map(m => m.lead_id).filter(Boolean) as string[])])
    // revisão do próprio dia corta em "agora": quem escreveu há pouco ainda pode ser
    // respondido, e apontar isso como silêncio seria cobrar o que ainda vai acontecer
    const base = montarRevisao({ dia, mensagens, leads, ateMs: hoje ? Date.now() : undefined })

    const gerado_em = new Date().toISOString()
    const amostra = base.conversas.map(c => ({
      conversa: c.rotulo, lead_id: c.lead_id, conversa_id: c.conversa_id, nome: c.nome,
    }))

    // dia sem conversa da Amanda não vai para o modelo: não há o que ler, e pedir uma
    // leitura de nada só produziria frase inventada
    if (base.conversas.length === 0) {
      await fechar(id, {
        status: 'pronta',
        resultado: {
          dia, conversas: 0, amostra, sem_resposta: [], fotos_faltando: [], gerado_em,
          analise: {
            resumo: 'A Amanda não respondeu nenhuma conversa neste dia.',
            melhorias: [], fotos: [],
          },
        },
      })
      return
    }

    const llm = await pedirTexto(base.pedido, { maxTokens: 6000, timeoutMs: 300_000 })
    if (!llm.ok) throw new Error(`modelo: ${llm.erro}`)

    const lida = lerRevisao(llm.texto, base.conversas.map(c => c.rotulo))
    if (!lida) throw new Error('o modelo não devolveu a revisão em formato legível')

    await fechar(id, {
      status: 'pronta',
      resultado: {
        dia, conversas: base.conversas.length, amostra,
        sem_resposta: base.semResposta,
        // o código manda na lista; o modelo só dá nome ao que fotografar
        fotos_faltando: casarFotos(base.fotosQueFaltam, lida.fotos),
        analise: lida, gerado_em,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erro inesperado'
    console.error('[revisao-diaria]', dia, message)
    await fechar(id, { status: 'erro', erro: 'Não consegui terminar a revisão. Tente de novo.' })
  }
}

async function fechar(id: string, campos: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('revisoes_ia')
    .update({ ...campos, concluido_em: new Date().toISOString() }).eq('id', id)
  if (error) console.error('[revisao-diaria] não consegui gravar o fim:', error.message)
}

/** admin logado no dash; o cron entra pela outra porta, com o segredo do Vault */
async function adminQueChama(req: Request): Promise<{ ok: true; id: string } | { ok: false; status: number; erro: string }> {
  const auth = req.headers.get('Authorization')
  if (!auth) return { ok: false, status: 401, erro: 'Não autorizado' }
  const caller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: auth } } },
  )
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return { ok: false, status: 401, erro: 'Token inválido' }
  const { data: perfil } = await db.from('profiles').select('approved, is_admin').eq('id', user.id).maybeSingle()
  if (!perfil?.approved || !perfil?.is_admin) {
    return { ok: false, status: 403, erro: 'Só admin pode pedir a revisão.' }
  }
  return { ok: true, id: user.id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()

  try {
    const corpo = await req.json().catch(() => ({})) as { segredo?: string; dia?: string }
    const doCron = segredoConfere(corpo)

    let criado_por: string | null = null
    if (!doCron) {
      const quem = await adminQueChama(req)
      if (!quem.ok) return resposta(quem.status, { error: quem.erro })
      criado_por = quem.id
    }

    const hojeCasa = diaNaCasa(new Date().toISOString())
    const dia = corpo.dia && EH_DIA.test(corpo.dia) ? corpo.dia : hojeCasa
    if (dia > hojeCasa) return resposta(400, { error: 'Esse dia ainda não aconteceu.' })

    // uma revisão por vez para o mesmo dia: o cron e o botão podem cair juntos
    const { data: emCurso } = await db.from('revisoes_ia')
      .select('id, criado_em').eq('dia', dia).eq('status', 'rodando')
      .gte('criado_em', new Date(Date.now() - MINUTOS_ATE_DESISTIR * 60_000).toISOString())
      .limit(1)
    if (emCurso && emCurso.length > 0) {
      return resposta(200, { ok: true, id: emCurso[0].id, ja_estava_rodando: true })
    }

    // o cron não refaz o que já saiu: se o dia já tem revisão pronta, ele passa
    if (doCron) {
      const { data: pronta } = await db.from('revisoes_ia')
        .select('id').eq('dia', dia).eq('status', 'pronta').limit(1)
      if (pronta && pronta.length > 0) {
        return resposta(200, { ok: true, gerou: false, motivo: 'o dia já tem revisão' })
      }
    }

    const { data: nova, error } = await db.from('revisoes_ia')
      .insert({ dia, origem: doCron ? 'diaria' : 'manual', criado_por, status: 'rodando' })
      .select('id').single()
    if (error || !nova?.id) return resposta(500, { error: `não consegui iniciar: ${error?.message}` })

    EdgeRuntime.waitUntil(revisar(nova.id, dia, dia === hojeCasa))
    return resposta(200, { ok: true, id: nova.id, dia })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('[revisao-diaria]', message)
    return resposta(500, { error: message })
  }
})
