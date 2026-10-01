/**
 * Edge Function: resumir-conversas
 *
 * Conversa com etiqueta `humano`, parada há 3 horas, ganha um resumo de como está no
 * `resumo_conversa` do lead (mais temperatura, próxima ação e o que falta). Lê a conversa
 * inteira de `mensagens_sombrear`. Substitui o ramo RESUMO do workflow n8n
 * "Amanda | Desfecho do atendimento".
 *
 * Quem chama: cron `resumir-conversas` (0024), a cada 15 minutos, com o segredo do Vault
 * no corpo. Na mão: { segredo, todas: true } refaz o resumo de toda conversa com humano,
 * mesmo já resumida; { segredo, leads: [uuid] } só desses.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { preflight, resposta } from '../_shared/resposta.ts'
import { segredoConfere } from '../_shared/automacao.ts'
import { pedirTexto } from '../_shared/muse.ts'
import { lerResposta, montarPedido, transcrever, type MensagemResumo } from './prompt.ts'

const HORAS_PARADA = 3
const POR_RODADA = 25   // cabe no tempo de uma chamada; o resto sai na rodada seguinte
const EM_PARALELO = 5

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

type Alvo = { lead_id: string; conversa_id: number }

async function resumir(alvo: Alvo): Promise<{ lead: string; ok: boolean; erro?: string }> {
  const { data: lead, error: e1 } = await db.from('crm_sombrear_ia')
    .select('nome, modelo_interesse, ambiente, ultimo_valor_cotado')
    .eq('id', alvo.lead_id).single()
  if (e1 || !lead) return { lead: alvo.lead_id, ok: false, erro: e1?.message ?? 'lead sumiu' }

  const { data: msgs, error: e2 } = await db.from('mensagens_sombrear')
    .select('autor, autor_nome, canal_envio, conteudo, anexos, excluida, enviada_em')
    .eq('conversa_id', alvo.conversa_id).eq('privada', false)
    .order('enviada_em', { ascending: true })
  if (e2) return { lead: alvo.lead_id, ok: false, erro: e2.message }

  const conversa = transcrever((msgs ?? []) as MensagemResumo[])
  if (!conversa) return { lead: alvo.lead_id, ok: false, erro: 'conversa vazia' }

  const r = await pedirTexto(montarPedido(lead, conversa), { maxTokens: 800, timeoutMs: 60_000 })
  if (!r.ok) return { lead: alvo.lead_id, ok: false, erro: r.erro }
  const campos = lerResposta(r.texto)
  if (!campos) return { lead: alvo.lead_id, ok: false, erro: 'resposta sem JSON válido' }

  // temperatura/próxima ação/motivo/medição só sobrescrevem quando vieram; o resumo sempre
  const { error: e3 } = await db.from('crm_sombrear_ia').update({
    resumo_conversa: campos.resumo_conversa,
    ...(campos.lead_temperatura ? { lead_temperatura: campos.lead_temperatura } : {}),
    ...(campos.lead_proxima_acao ? { lead_proxima_acao: campos.lead_proxima_acao } : {}),
    ...(campos.status_motivo ? { status_motivo: campos.status_motivo } : {}),
    ...(campos.medicao_equipe ? { medicao_equipe: campos.medicao_equipe } : {}),
    resumo_em: new Date().toISOString(),
  }).eq('id', alvo.lead_id)
  if (e3) return { lead: alvo.lead_id, ok: false, erro: e3.message }
  return { lead: alvo.lead_id, ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!segredoConfere(body)) return resposta(401, { error: 'Não autorizado' })

  const { data, error } = await db.rpc('conversas_para_resumir', { horas: HORAS_PARADA, todas: body?.todas === true })
  if (error) return resposta(500, { ok: false, erro: error.message })

  let alvos = (data ?? []) as Alvo[]
  if (Array.isArray(body?.leads)) {
    const pedidos = new Set((body!.leads as unknown[]).map(String))
    alvos = alvos.filter(a => pedidos.has(a.lead_id))
  }
  const pendentes = alvos.length
  alvos = alvos.slice(0, POR_RODADA)

  const resultados: Awaited<ReturnType<typeof resumir>>[] = []
  for (let i = 0; i < alvos.length; i += EM_PARALELO) {
    resultados.push(...await Promise.all(alvos.slice(i, i + EM_PARALELO).map(resumir)))
  }
  const falhas = resultados.filter(r => !r.ok)
  if (falhas.length) console.error('[resumir-conversas] falhas:', JSON.stringify(falhas))
  return resposta(200, {
    ok: true, pendentes, resumidas: resultados.length - falhas.length, falhas,
    faltam: Math.max(0, pendentes - alvos.length),
  })
})
