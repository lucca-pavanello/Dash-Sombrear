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

/**
 * Taxonomia de objeções — ESPELHO de src/lib/insights/taxonomia.ts.
 * Deno não importa de src/, então a lista vive duas vezes. Mudou lá, muda aqui: slug
 * que só existe de um lado é gravado e some da contagem sem ninguém perceber.
 * A lista foi fechada lendo conversa real do CRM, não por intuição.
 */
const OBJECOES: Array<{ id: string; criterio: string }> = [
  { id: 'foto_tecido',        criterio: 'não consegue imaginar como o tecido fica: transparência, se dá pra ver de fora, quanto escurece, diferença entre Tela Solar 1% e 3%, quer ver foto real' },
  { id: 'preco_alto',         criterio: 'reagiu ao valor como alto, comparou com o que esperava gastar, disse que está fora do orçamento' },
  { id: 'desconto_avista',    criterio: 'pede desconto, condição especial, ou pergunta o valor à vista / parcelado' },
  { id: 'custo_instalacao',   criterio: 'estranhou que instalação ou frete são cobrados à parte, ou pediu pacote com instalação inclusa' },
  { id: 'orcamento_apertado', criterio: 'quer reduzir metragem, quantidade de peças ou trocar por modelo mais barato para o total caber num teto' },
  { id: 'prazo_entrega',      criterio: 'achou o prazo longo, tem data limite, ou está cobrando previsão de entrega/instalação' },
  { id: 'manutencao_limpeza', criterio: 'quer conserto, troca de peça, manutenção ou limpeza de persiana já instalada' },
  { id: 'decisao_terceiro',   criterio: 'precisa consultar cônjuge, sócio, diretoria, arquiteto ou síndico antes de decidir' },
  { id: 'duvida_medida',      criterio: 'não sabe medir, confundiu medida do vão com a final, ou tem medo de errar e receber peça errada' },
  { id: 'comprou_outro',      criterio: 'disse que comprou ou fechou em outro lugar, ou que achou mais barato em outra loja' },
  { id: 'adiou',              criterio: 'deixou pra depois: obra não pronta, mudança futura, "ano que vem", sem urgência' },
  { id: 'outro',              criterio: 'travou por um motivo real que não cabe em nenhum item acima — descreva em objecao_outro' },
]
const OBJECAO_IDS = new Set(OBJECOES.map(o => o.id))

/** Espelho de src/lib/produtos.ts (mesma regra de sincronia). */
const PRODUTOS = new Set([
  'rolo', 'rolo_motorizado', 'double', 'romana', 'horizontal', 'vertical', 'painel', 'cortina',
])
const SENSIBILIDADES = new Set(['baixa', 'media', 'alta'])

/**
 * `resumo_conversa` guarda DOIS formatos no mesmo campo: às vezes um resumo escrito
 * pela IA (o começo é o que importa), às vezes o log bruto que o n8n vai concatenando
 * no FIM conforme a conversa anda (aí o fim é o que importa).
 *
 * Medido no banco em 03/09/2026: 74% das conversas contêm log bruto e 47% passam de
 * 900 caracteres. O corte antigo (`.slice(0, 900)`) pegava só o começo — ou seja, nas
 * conversas longas a IA lia a parte mais VELHA e nunca via o que aconteceu depois,
 * que é justamente onde estão a objeção e o desfecho. Por isso: começo E fim.
 */
function trecho(texto: string | null, max = 2000): string {
  const t = (texto ?? '').trim()
  if (t.length <= max) return t
  const cabeca = Math.floor(max * 0.3)
  return t.slice(0, cabeca) + '\n[…]\n' + t.slice(-(max - cabeca))
}

/**
 * Uma conversa precisa passar pela IA quando: nunca foi classificada, andou desde a
 * última classificação, OU foi classificada antes da taxonomia de objeções existir
 * (objecao_tags nulo) — este último é o backfill, e sem ele o card de Insights nasceria
 * vazio pra toda a base já classificada.
 *
 * Usado nos DOIS lugares (fila e contagem de `restantes`) de propósito: a UI roda em
 * laço até `restantes` zerar, então se os critérios divergirem o laço para cedo e o
 * backfill nunca termina.
 */
function precisaClassificar(l: {
  resumo_conversa: string | null
  classificacao_ia: string | null
  classificacao_em: string | null
  timestamp_ultima_msg: string | null
  objecao_tags: string[] | null
}): boolean {
  if ((l.resumo_conversa ?? '').trim().length < 20) return false
  if (!l.classificacao_ia || !l.classificacao_em) return true
  if (l.objecao_tags == null) return true
  return l.timestamp_ultima_msg != null &&
    new Date(l.timestamp_ultima_msg).getTime() > new Date(l.classificacao_em).getTime()
}

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
              'objecoes, gatilhos, classificacao_ia, classificacao_em, objecao_tags')
      .not('resumo_conversa', 'is', null)
      .order('timestamp_ultima_msg', { ascending: false })
      .limit(200)
    if (leadErro) return resposta(500, { error: leadErro.message })

    const pendentes = (leads ?? []).filter(precisaClassificar).slice(0, LOTE)

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
      // extraídos na importação do histórico: sinal forte de perda (objeção) e de ganho
      // (gatilho). O nome do campo de ENTRADA é diferente do de saída de propósito: os
      // dois se chamavam "objecoes" e o modelo confundia o texto que recebe com o array
      // de slugs que deve devolver.
      objecoes_historico: l.objecoes ?? null,
      o_que_destravou: l.gatilhos ?? null,
      conversa: trecho(l.resumo_conversa),
    }))

    const prompt = `Você é analista comercial da Sombrear (cortinas e persianas sob medida).
Para CADA conversa abaixo, dê um veredito comercial. Responda APENAS um array JSON, um objeto por conversa:
[{"id":"<id exato>","resultado":"venda|negociacao|perdida|pos_venda|sem_interesse|indefinido","motivo":"uma frase curta e concreta em português BR","temperatura":"quente|morno|frio","objecoes":["<slug>"],"objecao_outro":"<texto ou vazio>","produto":"<slug ou vazio>","sensibilidade_preco":"baixa|media|alta"}]

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
  Quando vier "objecoes_historico" preenchido, use a objeção real do cliente como motivo — ela vale mais que a tua leitura do resumo.
  Quando vier "o_que_destravou", cite no motivo o que fechou a venda.
- temperatura: chance de fechar agora (quente = perto de fechar; pos_venda costuma ser morno).

OBJEÇÕES — o que travou o cliente. Use SÓ estes slugs, quantos couberem (pode ser nenhum):
${OBJECOES.map(o => `- "${o.id}": ${o.criterio}`).join('\n')}
Regras das objeções:
- Só marque o que está ESCRITO na conversa. Objeção que você deduziu não é objeção.
- Conversa sem travamento (só operacional, agendamento, nota fiscal, elogio) → "objecoes": [].
- Use "outro" apenas quando houver objeção real fora da lista, e descreva em "objecao_outro"
  em até 10 palavras. Sem objeção real, NÃO use "outro" — deixe a lista vazia.
- "objecao_outro" fica vazio quando "outro" não for usado.

PRODUTO — a família que o cliente quer. Um só, o principal. Use SÓ estes slugs:
"rolo" (persiana rolô, tela solar, screen), "rolo_motorizado", "double" (Double Vision,
Romeu e Julieta), "romana", "horizontal" (PH Alumínio, PH 50, horizontal de alumínio),
"vertical" (PV, persiana vertical), "painel", "cortina" (inclui Wave).
Não deu pra saber → "" (vazio). Nunca chute: produto chutado vira estatística falsa.

SENSIBILIDADE A PREÇO: "alta" (preço foi o assunto central, pediu desconto ou recuou pelo valor),
"media" (comentou o valor mas seguiu), "baixa" (preço não pesou na conversa).

CONVERSAS:
${JSON.stringify(amostra)}`

    const bruto = await chamarGemini(apiKey, prompt)
    let itens: Array<{
      id?: string; resultado?: string; motivo?: string; temperatura?: string
      objecoes?: unknown; objecao_outro?: string; produto?: string; sensibilidade_preco?: string
    }>
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

      // Slug fora da lista é descartado, nunca gravado: se ele entrasse, sumiria da
      // contagem do dash (que só sabe exibir os slugs conhecidos) e o número ficaria
      // errado sem nada indicar. Array vazio é resposta legítima — "não travou em nada".
      const tags = Array.isArray(item.objecoes)
        ? [...new Set(item.objecoes.map(String).filter(t => OBJECAO_IDS.has(t)))]
        : []
      const usouOutro = tags.includes('outro')
      const produto = PRODUTOS.has(String(item.produto)) ? String(item.produto) : null
      const sensibilidade = SENSIBILIDADES.has(String(item.sensibilidade_preco))
        ? String(item.sensibilidade_preco)
        : null

      const { error } = await db.from('crm_sombrear_ia').update({
        classificacao_ia: resultado,
        classificacao_motivo: String(item.motivo ?? '').slice(0, 300) || null,
        classificacao_temperatura: temperatura,
        classificacao_em: agora,
        // sempre grava o array (mesmo vazio): é ele que marca "já passou pela taxonomia"
        // e tira a conversa da fila de backfill em precisaClassificar()
        objecao_tags: tags,
        objecao_outro: usouOutro ? (String(item.objecao_outro ?? '').slice(0, 200) || null) : null,
        produto_familia: produto,
        sensibilidade_preco: sensibilidade,
      }).eq('id', item.id)
      if (!error) gravadas++
    }

    const restantes = (leads ?? []).filter(precisaClassificar).length - gravadas

    return resposta(200, { classificadas: gravadas, restantes: Math.max(0, restantes) })
  } catch (err) {
    return resposta(500, { error: err instanceof Error ? err.message : 'Erro interno' })
  }
})
