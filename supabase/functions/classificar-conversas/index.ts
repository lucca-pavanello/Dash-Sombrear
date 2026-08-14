/**
 * Edge Function: classificar-conversas
 * A IA lê cada conversa do CRM (resumo + dados coletados) e grava um VEREDITO
 * por conversa: resultado (venda/negociação/perdida/sem interesse), motivo em
 * uma frase e temperatura. É o "por que ganhamos/perdemos" do atendimento.
 *
 * Só processa o que ainda não foi classificado ou o que mudou desde a última
 * classificação — clicar de novo não re-queima tokens à toa.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOTE = 25
const RESULTADOS = new Set(['venda', 'negociacao', 'perdida', 'pos_venda', 'sem_interesse', 'indefinido'])
const TEMPERATURAS = new Set(['quente', 'morno', 'frio'])

function resposta(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function chamarGemini(apiKey: string, prompt: string): Promise<string> {
  let ultimoErro = 'sem resposta'
  for (const modelo of ['gemini-3.7-flash', 'gemini-flash-latest']) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      },
    )
    const data = await res.json()
    if (res.ok) {
      const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (texto) return texto
      ultimoErro = 'resposta vazia'
      continue
    }
    ultimoErro = JSON.stringify(data?.error ?? data).slice(0, 200)
    if (res.status !== 404) break
  }
  throw new Error(`Gemini: ${ultimoErro}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return resposta(401, { error: 'Não autorizado' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return resposta(401, { error: 'Token inválido' })

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: perfil } = await db.from('profiles').select('approved').eq('id', caller.id).single()
    if (perfil?.approved !== true) return resposta(403, { error: 'Acesso pendente de aprovação' })

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) return resposta(500, { error: 'GEMINI_API_KEY não configurada' })

    // ── Conversas que precisam de veredito ──────────────────
    const { data: leads, error: leadErro } = await db
      .from('crm_sombrear_ia')
      .select('id, nome, status_lead, resumo_conversa, ultimo_valor_cotado, modelo_interesse, ' +
              'tecido_cor, medidas_coletadas, orcamento_aceito, timestamp_ultima_msg, ' +
              'objecoes, gatilhos, classificacao_ia, classificacao_em')
      .not('resumo_conversa', 'is', null)
      .order('timestamp_ultima_msg', { ascending: false })
      .limit(200)
    if (leadErro) return resposta(500, { error: leadErro.message })

    const pendentes = (leads ?? []).filter(l => {
      if ((l.resumo_conversa ?? '').trim().length < 20) return false
      if (!l.classificacao_ia || !l.classificacao_em) return true
      // conversa continuou depois da última análise → reclassifica
      return l.timestamp_ultima_msg != null &&
        new Date(l.timestamp_ultima_msg).getTime() > new Date(l.classificacao_em).getTime()
    }).slice(0, LOTE)

    if (pendentes.length === 0) {
      return resposta(200, { classificadas: 0, mensagem: 'Tudo já está classificado e atualizado.' })
    }

    const amostra = pendentes.map(l => ({
      id: l.id,
      nome: l.nome ?? 'sem nome',
      modelo: l.modelo_interesse ?? null,
      tecido: l.tecido_cor ?? null,
      valor_cotado: l.ultimo_valor_cotado ?? null,
      tem_medidas: !!l.medidas_coletadas,
      orcamento_aceito: l.orcamento_aceito ?? null,
      // extraídos na importação do histórico: sinal forte de perda (objeção) e de ganho (gatilho)
      objecoes: l.objecoes ?? null,
      o_que_destravou: l.gatilhos ?? null,
      conversa: (l.resumo_conversa ?? '').slice(0, 900),
    }))

    const prompt = `Você é analista comercial da Sombrear (cortinas e persianas sob medida).
Para CADA conversa abaixo, dê um veredito comercial. Responda APENAS um array JSON, um objeto por conversa:
[{"id":"<id exato>","resultado":"venda|negociacao|perdida|pos_venda|sem_interesse|indefinido","motivo":"uma frase curta e concreta em português BR","temperatura":"quente|morno|frio"}]

Critérios:
- "venda": o cliente aceitou/fechou, confirmou compra ou agendou medição/instalação para comprar.
  Se comprou E segue orçando outra coisa, ainda é "venda".
- "negociacao": segue conversando, pediu orçamento, comparando opções, sem recusa clara —
  E a conversa NÃO indica que o cliente parou de responder.
- "perdida": recusou, achou caro, escolheu concorrente, OU o texto diz que o cliente
  não respondeu mais / sumiu depois do preço. Silêncio depois do orçamento é perda, não negociação.
- "pos_venda": já é cliente e o assunto é garantia, reparo, ajuste, reclamação ou suporte
  de algo comprado — não é venda nova nem perda. NUNCA classifique isso como "sem_interesse".
- "sem_interesse": não era cliente (curioso, engano, fornecedor, assunto fora de persianas).
- "indefinido": conversa curta demais para julgar.
- motivo: diga o PORQUÊ concreto ("achou o valor alto para 3 janelas", "queria instalação no mesmo dia"), nunca genérico.
  Quando vier "objecoes" preenchido, use a objeção real do cliente como motivo — ela vale mais que a tua leitura do resumo.
  Quando vier "o_que_destravou", cite no motivo o que fechou a venda.
- temperatura: chance de fechar agora (quente = perto de fechar; pos_venda costuma ser morno).

CONVERSAS:
${JSON.stringify(amostra)}`

    const bruto = await chamarGemini(apiKey, prompt)
    let itens: Array<{ id?: string; resultado?: string; motivo?: string; temperatura?: string }>
    try {
      const parsed = JSON.parse(bruto)
      itens = Array.isArray(parsed) ? parsed : (parsed.conversas ?? parsed.itens ?? [])
    } catch {
      return resposta(502, { error: 'A IA devolveu um formato inesperado. Tente de novo.' })
    }

    const validos = new Set(pendentes.map(p => p.id))
    const agora = new Date().toISOString()
    let gravadas = 0
    for (const item of itens) {
      if (!item?.id || !validos.has(item.id)) continue
      const resultado = RESULTADOS.has(String(item.resultado)) ? String(item.resultado) : 'indefinido'
      const temperatura = TEMPERATURAS.has(String(item.temperatura)) ? String(item.temperatura) : 'frio'
      const { error } = await db.from('crm_sombrear_ia').update({
        classificacao_ia: resultado,
        classificacao_motivo: String(item.motivo ?? '').slice(0, 300) || null,
        classificacao_temperatura: temperatura,
        classificacao_em: agora,
      }).eq('id', item.id)
      if (!error) gravadas++
    }

    const restantes = (leads ?? []).filter(l =>
      (l.resumo_conversa ?? '').trim().length >= 20 && !l.classificacao_ia).length - gravadas

    return resposta(200, { classificadas: gravadas, restantes: Math.max(0, restantes) })
  } catch (err) {
    return resposta(500, { error: err instanceof Error ? err.message : 'Erro interno' })
  }
})
