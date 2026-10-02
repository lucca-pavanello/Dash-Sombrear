/**
 * Edge Function: classificar-fases
 *
 * Parte cada conversa na passagem para a equipe e lê os dois trechos à parte: o da IA
 * (objeções, motivo, preço) e o da equipe (assunto, objeções, falhas de atendimento,
 * motivo, preço). Alimenta os Insights separados da aba Agente IA (0029). A classificação
 * da conversa inteira (classificar-conversas) não muda.
 *
 * Quem chama: cron `classificar-fases` (0029), a cada 20 minutos, com o segredo do Vault
 * no corpo. Na mão: { segredo, todas: true } relê tudo; { segredo, leads: [uuid] } só
 * desses; { segredo, leads: [...], simular: true } devolve a leitura sem gravar (pra
 * conferir o pedido antes de soltar na base inteira).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { preflight, resposta } from '../_shared/resposta.ts'
import { segredoConfere } from '../_shared/automacao.ts'
import { pedirTexto } from '../_shared/muse.ts'
import { dividirNaPassagem, lerResposta, montarPedido, type MensagemFase } from './prompt.ts'

const POR_RODADA = 20   // cabe no tempo de uma chamada; o resto sai na rodada seguinte
const EM_PARALELO = 5

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

type Resultado = { lead: string; ok: boolean; erro?: string; leitura?: unknown }

async function classificar(leadId: string, simular: boolean): Promise<Resultado> {
  const { data: lead, error: e1 } = await db.from('crm_sombrear_ia')
    .select('nome, modelo_interesse').eq('id', leadId).single()
  if (e1 || !lead) return { lead: leadId, ok: false, erro: e1?.message ?? 'lead sumiu' }

  const { data: msgs, error: e2 } = await db.from('mensagens_sombrear')
    .select('autor, autor_nome, canal_envio, conteudo, anexos, excluida, enviada_em')
    .eq('lead_id', leadId).eq('privada', false)
    .order('enviada_em', { ascending: true })
  if (e2) return { lead: leadId, ok: false, erro: e2.message }

  const agora = new Date()
  const trechos = dividirNaPassagem((msgs ?? []) as MensagemFase[])
  // sem trecho nenhum (só o cliente falou): marca como lida pra sair da fila
  let campos: ReturnType<typeof lerResposta> = { ia: null, equipe: null }
  if (trechos.ia || trechos.equipe) {
    const r = await pedirTexto(montarPedido(lead, trechos, agora), { maxTokens: 1200, timeoutMs: 60_000 })
    if (!r.ok) return { lead: leadId, ok: false, erro: r.erro }
    campos = lerResposta(r.texto, trechos)
    if (!campos) return { lead: leadId, ok: false, erro: 'resposta sem JSON válido' }
  }
  if (simular) return { lead: leadId, ok: true, leitura: { passagem: trechos.passagem, ...campos } }

  // trecho que não existe grava null em tudo dele: a tela lê null como "não houve"
  const vazioIa = { ia_objecao_tags: null, ia_objecao_outro: null, ia_motivo: null, ia_sensibilidade_preco: null }
  const vazioEquipe = {
    equipe_assunto: null, equipe_objecao_tags: null, equipe_objecao_outro: null, equipe_falhas: null,
    equipe_falha_outro: null, equipe_motivo: null, equipe_sensibilidade_preco: null,
  }
  const { error: e3 } = await db.from('crm_sombrear_ia').update({
    ...(campos.ia ?? vazioIa),
    ...(campos.equipe ?? vazioEquipe),
    fases_em: agora.toISOString(),
  }).eq('id', leadId)
  if (e3) return { lead: leadId, ok: false, erro: e3.message }
  return { lead: leadId, ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!segredoConfere(body)) return resposta(401, { error: 'Não autorizado' })

  const simular = body?.simular === true
  const pedidos = Array.isArray(body?.leads) ? (body!.leads as unknown[]).map(String) : null
  let alvos: string[]
  if (simular && pedidos) {
    // simulação de leads escolhidos não passa pela fila: dá pra conferir o pedido antes da 0029
    alvos = pedidos
  } else {
    const { data, error } = await db.rpc('conversas_para_fases', { todas: body?.todas === true || simular })
    if (error) return resposta(500, { ok: false, erro: error.message })
    alvos = ((data ?? []) as { lead_id: string }[]).map(a => a.lead_id)
    if (pedidos) alvos = alvos.filter(id => pedidos.includes(id))
  }
  const pendentes = alvos.length
  alvos = alvos.slice(0, POR_RODADA)

  const resultados: Resultado[] = []
  for (let i = 0; i < alvos.length; i += EM_PARALELO) {
    resultados.push(...await Promise.all(alvos.slice(i, i + EM_PARALELO).map(id => classificar(id, simular))))
  }
  const falhas = resultados.filter(r => !r.ok)
  if (falhas.length) console.error('[classificar-fases] falhas:', JSON.stringify(falhas))
  return resposta(200, {
    ok: true, pendentes, lidas: resultados.length - falhas.length, falhas,
    faltam: Math.max(0, pendentes - alvos.length),
    ...(simular ? { leituras: resultados.filter(r => r.ok).map(r => ({ lead: r.lead, ...(r.leitura as object) })) } : {}),
  })
})
