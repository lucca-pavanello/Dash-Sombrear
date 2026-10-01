/**
 * Edge Function: classificar-orcamentos
 *
 * Lê as mensagens da loja (IA e equipe) que têm valor em R$ e ainda não foram lidas,
 * pergunta ao Muse se cada uma é um orçamento para o cliente e grava o veredito em
 * `orcamentos_chat` (0026). É o que separa "quem mandou o orçamento" no dash.
 *
 * Quem chama: cron `classificar-orcamentos`, a cada 15 minutos, com o segredo do Vault.
 * Na mão: { segredo, limite } para acelerar a carga inicial.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { preflight, resposta } from '../_shared/resposta.ts'
import { segredoConfere } from '../_shared/automacao.ts'
import { pedirTexto } from '../_shared/muse.ts'
import { lerVereditos, montarPedido, type MensagemComPreco } from './prompt.ts'

const POR_CHAMADA = 10
const EM_PARALELO = 4

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

type Pendente = MensagemComPreco & {
  conversa_id: number; lead_id: string | null; canal_envio: string | null; enviada_em: string
}

async function lerLote(lote: Pendente[]): Promise<{ gravadas: number; erro?: string }> {
  const r = await pedirTexto(montarPedido(lote), { maxTokens: 2000, timeoutMs: 90_000 })
  if (!r.ok) return { gravadas: 0, erro: r.erro }
  const vereditos = lerVereditos(r.texto, lote.map(m => m.id))
  if (!vereditos.length) return { gravadas: 0, erro: 'resposta sem vereditos válidos' }
  const porId = new Map(lote.map(m => [m.id, m]))
  const linhas = vereditos.map(v => {
    const m = porId.get(v.id)!
    return {
      mensagem_id: v.id, conversa_id: m.conversa_id, lead_id: m.lead_id, autor: m.autor,
      canal_envio: m.canal_envio, enviado_em: m.enviada_em, eh_orcamento: v.eh_orcamento,
      valor: v.valor, opcoes: v.opcoes, produto: v.produto,
    }
  })
  const { error } = await db.from('orcamentos_chat').upsert(linhas, { onConflict: 'mensagem_id' })
  return error ? { gravadas: 0, erro: error.message } : { gravadas: linhas.length }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!segredoConfere(body)) return resposta(401, { error: 'Não autorizado' })

  const limite = Math.min(Number(body?.limite) || 40, 120)
  const { data, error } = await db.rpc('mensagens_com_preco_pendentes', { limite })
  if (error) return resposta(500, { ok: false, erro: error.message })
  const pendentes = (data ?? []) as Pendente[]

  const lotes: Pendente[][] = []
  for (let i = 0; i < pendentes.length; i += POR_CHAMADA) lotes.push(pendentes.slice(i, i + POR_CHAMADA))
  const resultados: Awaited<ReturnType<typeof lerLote>>[] = []
  for (let i = 0; i < lotes.length; i += EM_PARALELO) {
    resultados.push(...await Promise.all(lotes.slice(i, i + EM_PARALELO).map(lerLote)))
  }
  const erros = resultados.filter(r => r.erro).map(r => r.erro)
  if (erros.length) console.error('[classificar-orcamentos]', JSON.stringify(erros))
  return resposta(200, {
    ok: true, lidas: pendentes.length,
    gravadas: resultados.reduce((s, r) => s + r.gravadas, 0), erros,
  })
})
