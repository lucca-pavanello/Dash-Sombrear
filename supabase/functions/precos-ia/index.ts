/**
 * Edge Function: precos-ia
 * IA de gestão de preços (Precificação 2.0 — Fase 4).
 * Princípio: a IA PROPÕE, o admin CONFIRMA, o sistema APLICA (com auditoria).
 *
 * modo 'propor'  → interpreta o pedido em linguagem natural e devolve { resposta, acoes[] }
 * modo 'aplicar' → valida e aplica as ações confirmadas, grava auditoria e dispara o sync
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYNC_WEBHOOK = 'https://n8n-n8n.yjlhot.easypanel.host/webhook/sincronizar-precos'
const TIPOS_VALIDOS = new Set([
  'criar_promocao', 'remover_promocao', 'atualizar_preco_tecido',
  'atualizar_parametro', 'atualizar_preco_artigo',
])

function resposta(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── Auth: apenas admin ──────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return resposta(401, { error: 'Não autorizado' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
    if (authError || !caller) return resposta(401, { error: 'Token inválido' })

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: perfil } = await db.from('profiles').select('is_admin').eq('id', caller.id).single()
    const isAdmin = caller.email === 'luccapavanallo@gmail.com' || perfil?.is_admin === true
    if (!isAdmin) return resposta(403, { error: 'Acesso negado: apenas admins' })

    const body = await req.json()

    // ══════════════ MODO PROPOR ══════════════
    if (body.modo === 'propor') {
      const mensagem = String(body.mensagem ?? '').slice(0, 2000)
      if (!mensagem.trim()) return resposta(400, { error: 'Mensagem vazia' })

      // contexto compacto do banco
      const [{ data: tecidos }, { data: promos }, { data: params }, { data: artigos }] = await Promise.all([
        db.from('precos_tecidos').select('nome, tipo, largura, preco').order('nome'),
        db.from('precos_promocoes').select('id, alvo_nome, desconto_pct, inicio, fim').order('inicio'),
        db.from('precos_parametros').select('chave, valor, descricao'),
        db.from('precos_artigos').select('categoria, nome, preco'),
      ])

      const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
      const sistema = `Você é a assistente de gestão de preços da Sombrear (persianas). Hoje é ${hoje}.
O admin descreve mudanças em linguagem natural; você devolve APENAS um JSON válido:
{"resposta": "texto curto e simpático confirmando o que entendeu (ou perguntando o que faltou)",
 "acoes": [lista de ações — VAZIA se faltar informação ou o pedido não for sobre preços]}

Tipos de ação permitidos (use EXATAMENTE estes campos):
- {"tipo":"criar_promocao","tecido":"NOME EXATO","desconto_pct":10,"inicio":"YYYY-MM-DD","fim":"YYYY-MM-DD"}
- {"tipo":"remover_promocao","id":123}
- {"tipo":"atualizar_preco_tecido","nome":"NOME EXATO","largura":null ou número,"preco":36.00}  (largura null = todas as larguras)
- {"tipo":"atualizar_parametro","chave":"chave_exata","valor":2.8}
- {"tipo":"atualizar_preco_artigo","categoria":"PV" ou "PH_ALUMINIO","nome":"NOME EXATO","preco":50.00}

Regras:
- Use APENAS nomes que existem nos dados abaixo (case exato). Se o admin falar "screen 3 bege", encontre "SCREEN 3% BEGE".
- Um pedido pode gerar várias ações (ex.: "screen 1% em promoção" = 1 ação por... NÃO: promoção é por NOME de tecido, uma ação por nome distinto que casar).
- Datas relativas: resolva com base em hoje ("a partir de segunda", "até o fim do mês").
- NUNCA invente valores. Dúvida ou ambiguidade → acoes vazia + pergunta na resposta.
- Pedidos fora de preços/promoções/parâmetros → acoes vazia + explique educadamente.

DADOS ATUAIS:
TECIDOS: ${JSON.stringify(tecidos)}
PROMOÇÕES: ${JSON.stringify(promos)}
PARÂMETROS: ${JSON.stringify(params)}
ARTIGOS: ${JSON.stringify(artigos)}`

      const historico = Array.isArray(body.historico) ? body.historico.slice(-6) : []
      const contents = [
        ...historico.map((h: { papel: string; texto: string }) => ({
          role: h.papel === 'user' ? 'user' : 'model',
          parts: [{ text: String(h.texto).slice(0, 1000) }],
        })),
        { role: 'user', parts: [{ text: mensagem }] },
      ]

      const apiKey = Deno.env.get('GEMINI_API_KEY')!
      const corpo = JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      })
      // modelos em ordem de preferência (1.5 foi aposentado; mantém fallback)
      let data: Record<string, unknown> | null = null
      let ultimoErro: unknown = null
      for (const modelo of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo },
        )
        const json = await res.json()
        if (res.ok) { data = json; break }
        ultimoErro = json
        console.error(`precos-ia: modelo ${modelo} falhou`, JSON.stringify(json).slice(0, 300))
      }
      if (!data) return resposta(502, { error: 'Nenhum modelo Gemini respondeu', detalhe: ultimoErro })

      const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
      let parsed: { resposta?: string; acoes?: unknown[] }
      try { parsed = JSON.parse(texto) } catch { parsed = { resposta: 'Não consegui interpretar — pode reformular?', acoes: [] } }

      const acoes = (Array.isArray(parsed.acoes) ? parsed.acoes : [])
        .filter((a) => a && typeof a === 'object' && TIPOS_VALIDOS.has((a as { tipo?: string }).tipo ?? ''))
      return resposta(200, { resposta: parsed.resposta ?? '', acoes })
    }

    // ══════════════ MODO APLICAR ══════════════
    if (body.modo === 'aplicar') {
      const acoes = Array.isArray(body.acoes) ? body.acoes : []
      if (acoes.length === 0) return resposta(400, { error: 'Nenhuma ação para aplicar' })
      if (acoes.length > 20) return resposta(400, { error: 'Máximo de 20 ações por vez' })

      // FASE 1: validar TODAS as ações antes de aplicar qualquer uma
      // (evita aplicação parcial: ou entra tudo, ou nada entra)
      for (const acao of acoes) {
        const tipo = String(acao.tipo ?? '')
        if (!TIPOS_VALIDOS.has(tipo)) return resposta(400, { error: `Ação desconhecida: ${tipo}` })
        if (tipo === 'criar_promocao') {
          const pct = Number(acao.desconto_pct)
          if (!(pct > 0 && pct < 100)) return resposta(400, { error: `Desconto inválido em ${acao.tecido}` })
          if (!acao.inicio || !acao.fim || String(acao.fim) < String(acao.inicio)) return resposta(400, { error: `Período inválido em ${acao.tecido}` })
          const { count } = await db.from('precos_tecidos').select('id', { count: 'exact', head: true }).eq('nome', acao.tecido)
          if (!count) return resposta(400, { error: `Tecido não encontrado: ${acao.tecido}` })
        } else if (tipo === 'remover_promocao') {
          const { count } = await db.from('precos_promocoes').select('id', { count: 'exact', head: true }).eq('id', Number(acao.id))
          if (!count) return resposta(400, { error: `Promoção #${acao.id} não existe` })
        } else if (tipo === 'atualizar_preco_tecido') {
          if (!(Number(acao.preco) > 0)) return resposta(400, { error: `Preço inválido em ${acao.nome}` })
          let qv = db.from('precos_tecidos').select('id', { count: 'exact', head: true }).eq('nome', acao.nome)
          if (acao.largura != null) qv = qv.eq('largura', Number(acao.largura))
          const { count } = await qv
          if (!count) return resposta(400, { error: `Tecido não encontrado: ${acao.nome}` })
        } else if (tipo === 'atualizar_parametro') {
          const { count } = await db.from('precos_parametros').select('chave', { count: 'exact', head: true }).eq('chave', String(acao.chave))
          if (!count) return resposta(400, { error: `Parâmetro não encontrado: ${acao.chave}` })
        } else if (tipo === 'atualizar_preco_artigo') {
          if (!(Number(acao.preco) > 0)) return resposta(400, { error: `Preço inválido em ${acao.nome}` })
          const { count } = await db.from('precos_artigos').select('id', { count: 'exact', head: true })
            .eq('categoria', String(acao.categoria)).eq('nome', String(acao.nome))
          if (!count) return resposta(400, { error: `Artigo não encontrado: ${acao.nome}` })
        }
      }

      // FASE 2: aplicar (tudo já validado)
      const aplicadas: string[] = []
      for (const acao of acoes) {
        const tipo = String(acao.tipo ?? '')

        if (tipo === 'criar_promocao') {
          const pct = Number(acao.desconto_pct)
          const { error } = await db.from('precos_promocoes').insert({
            alvo_tipo: 'tecido', alvo_nome: acao.tecido, desconto_pct: pct, inicio: acao.inicio, fim: acao.fim,
          })
          if (error) throw error
          aplicadas.push(`Promoção: ${acao.tecido} −${pct}% (${acao.inicio} → ${acao.fim})`)
        } else if (tipo === 'remover_promocao') {
          const { error } = await db.from('precos_promocoes').delete().eq('id', Number(acao.id))
          if (error) throw error
          aplicadas.push(`Promoção #${acao.id} removida`)
        } else if (tipo === 'atualizar_preco_tecido') {
          const preco = Number(acao.preco)
          let q = db.from('precos_tecidos').update({ preco }).eq('nome', acao.nome)
          if (acao.largura != null) q = q.eq('largura', Number(acao.largura))
          const { error, count } = await q.select('id', { count: 'exact' })
          if (error) throw error
          if (!count) throw new Error(`Tecido não encontrado: ${acao.nome}`)
          aplicadas.push(`Preço: ${acao.nome}${acao.largura != null ? ` (${acao.largura}m)` : ''} → R$ ${preco.toFixed(2)}`)
        } else if (tipo === 'atualizar_parametro') {
          const { error, count } = await db.from('precos_parametros')
            .update({ valor: Number(acao.valor) }).eq('chave', String(acao.chave)).select('chave', { count: 'exact' })
          if (error) throw error
          if (!count) throw new Error(`Parâmetro não encontrado: ${acao.chave}`)
          aplicadas.push(`Parâmetro: ${acao.chave} → ${acao.valor}`)
        } else if (tipo === 'atualizar_preco_artigo') {
          const preco = Number(acao.preco)
          const { error, count } = await db.from('precos_artigos')
            .update({ preco }).eq('categoria', String(acao.categoria)).eq('nome', String(acao.nome))
            .select('id', { count: 'exact' })
          if (error) throw error
          if (!count) throw new Error(`Artigo não encontrado: ${acao.nome}`)
          aplicadas.push(`Artigo: ${acao.nome} → R$ ${preco.toFixed(2)}`)
        }

        await db.from('precos_auditoria').insert({
          usuario: caller.email ?? caller.id, origem: 'ia', acao: tipo, detalhe: acao,
        })
      }

      // espelha na planilha (não bloqueia a resposta se falhar)
      try {
        await fetch(SYNC_WEBHOOK, { method: 'POST', signal: AbortSignal.timeout(5000) })
      } catch (_) { /* sync agendado cobre */ }

      return resposta(200, { ok: true, aplicadas })
    }

    return resposta(400, { error: 'modo deve ser "propor" ou "aplicar"' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return resposta(500, { error: message })
  }
})
