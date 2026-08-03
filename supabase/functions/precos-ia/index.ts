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
  'atualizar_parametro', 'atualizar_preco_artigo', 'atualizar_componente_ferragem',
  'atualizar_ph50', 'atualizar_bando_param', 'atualizar_colocacao',
  'atualizar_barra_faixa', 'atualizar_motor_componente', 'atualizar_motor_estrutura',
  'atualizar_romana',
])
const CAMPOS_PH50 = new Set(['preco_cadarco', 'preco_fita', 'bando_ml', 'aba_pc'])
const CAMPOS_BANDO = new Set(['preco_metro', 'par', 'cd1', 'cd2'])

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

      // contexto compacto do banco — TODAS as tabelas de preço (menos a matriz Romana, grande demais)
      const [
        { data: tecidos }, { data: promos }, { data: params }, { data: artigos },
        { data: ferragens }, { data: ph50 }, { data: bandoParams }, { data: bandos },
        { data: barraFaixas }, { data: colocacao }, { data: motorEst }, { data: motorComp },
      ] = await Promise.all([
        db.from('precos_tecidos').select('nome, tipo, largura, preco').order('nome'),
        db.from('precos_promocoes').select('id, alvo_nome, desconto_pct, inicio, fim').order('inicio'),
        db.from('precos_parametros').select('chave, valor, descricao'),
        db.from('precos_artigos').select('categoria, nome, preco'),
        db.from('precos_ferragem_componentes').select('id, familia, cor, espessura, item, tipo_custo, valor').order('familia'),
        db.from('precos_ph50').select('modelo, cor, preco_cadarco, preco_fita, bando_ml, aba_pc'),
        db.from('precos_bandos_params').select('cor, preco_metro, par, cd1, cd2'),
        db.from('precos_bandos').select('cor, largura, qtd_cd'),
        db.from('precos_barra_faixas').select('largura_min, qtd_presilhas'),
        db.from('precos_colocacao').select('id, ml_min, ml_max, preco'),
        db.from('precos_motor_estrutura').select('id, largura, alt_faixa, valor, grupo'),
        db.from('precos_motor_componentes').select('item, custo, quantidade'),
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
- {"tipo":"atualizar_componente_ferragem","id":123,"item":"nome do item (informativo)","valor":14.00}  (use o id do componente listado em FERRAGENS; a escada inteira recalcula sozinha)
- {"tipo":"atualizar_ph50","modelo":"MODELO EXATO","cor":"COR EXATA","campo":"preco_cadarco|preco_fita|bando_ml|aba_pc","valor":250.00}
- {"tipo":"atualizar_bando_param","cor":"BRANCO" ou "PRETO","campo":"preco_metro|par|cd1|cd2","valor":30.00}
- {"tipo":"atualizar_colocacao","id":1,"preco":85.00}  (use o id da faixa em INSTALAÇÃO)
- {"tipo":"atualizar_barra_faixa","largura_min":2.5,"qtd_presilhas":3}
- {"tipo":"atualizar_motor_componente","item":"ITEM EXATO","custo":399.00}
- {"tipo":"atualizar_motor_estrutura","id":1,"valor":66.13}  (use o id da linha em MOTOR estrutura)
- {"tipo":"atualizar_romana","largura":1.30,"altura":1.20,"custo":100.68}  (célula exata da matriz, passos de 0,10 entre 1,00 e 4,00)

Regras:
- Use APENAS nomes que existem nos dados abaixo (case exato). Se o admin falar "screen 3 bege", encontre "SCREEN 3% BEGE".
- Um pedido pode gerar várias ações (ex.: "screen 1% em promoção" = 1 ação por... NÃO: promoção é por NOME de tecido, uma ação por nome distinto que casar).
- Datas relativas: resolva com base em hoje ("a partir de segunda", "até o fim do mês").
- NUNCA invente valores. Dúvida ou ambiguidade → acoes vazia + pergunta na resposta.
- Pedidos fora de preços/promoções/parâmetros → acoes vazia + explique educadamente.

Consulta: você PODE responder perguntas de preço sobre QUALQUER dado abaixo (ferragens, PH 50,
bandôs, barra, instalação, motor) — cite o valor exato. Edição: TUDO acima é editável pelas ações;
apenas criar/remover LINHAS (tecido novo, faixa nova etc.) se faz na aba correspondente.
Romana: a matriz não está listada aqui — para EDITAR uma célula use atualizar_romana com a célula
exata que o admin informar; para CONSULTAR valores dela, indique a aba Ferragens › ROMANA.

DADOS ATUAIS:
TECIDOS: ${JSON.stringify(tecidos)}
PROMOÇÕES: ${JSON.stringify(promos)}
PARÂMETROS: ${JSON.stringify(params)}
ARTIGOS (PV/PH Alumínio, preço por m²): ${JSON.stringify(artigos)}
FERRAGENS (componentes; escada = soma(por_metro)×largura + soma(fixo); 'opcional_*' fica fora da soma): ${JSON.stringify(ferragens)}
PH 50MM (preço por m²): ${JSON.stringify(ph50)}
BANDÔ (preço = largura×preco_metro + qtd_cd×(cd1+cd2) + par): params=${JSON.stringify(bandoParams)} escada=${JSON.stringify(bandos)}
BARRA NIVELADORA (preço = metro×largura + presilha×qtd; params barra_* acima): faixas=${JSON.stringify(barraFaixas)}
INSTALAÇÃO (por metro linear): ${JSON.stringify(colocacao)}
MOTOR: estrutura=${JSON.stringify(motorEst)} componentes=${JSON.stringify(motorComp)}
ROMANA: a ferragem é uma matriz largura×altura (31×31) editável na aba Ferragens › ROMANA — grande demais pra listar aqui.`

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
        } else if (tipo === 'atualizar_componente_ferragem') {
          if (!(Number(acao.valor) > 0)) return resposta(400, { error: `Valor inválido no componente ${acao.item ?? acao.id}` })
          const { count } = await db.from('precos_ferragem_componentes')
            .select('id', { count: 'exact', head: true }).eq('id', Number(acao.id))
          if (!count) return resposta(400, { error: `Componente de ferragem #${acao.id} não existe` })
        } else if (tipo === 'atualizar_ph50') {
          if (!CAMPOS_PH50.has(String(acao.campo))) return resposta(400, { error: `Campo inválido no PH 50: ${acao.campo}` })
          if (!(Number(acao.valor) > 0)) return resposta(400, { error: `Valor inválido em ${acao.modelo} ${acao.cor}` })
          const { count } = await db.from('precos_ph50').select('id', { count: 'exact', head: true })
            .eq('modelo', String(acao.modelo)).eq('cor', String(acao.cor))
          if (!count) return resposta(400, { error: `Item PH 50 não encontrado: ${acao.modelo} ${acao.cor}` })
        } else if (tipo === 'atualizar_bando_param') {
          if (!CAMPOS_BANDO.has(String(acao.campo))) return resposta(400, { error: `Campo inválido no bandô: ${acao.campo}` })
          if (!(Number(acao.valor) > 0)) return resposta(400, { error: `Valor inválido no bandô ${acao.cor}` })
          const { count } = await db.from('precos_bandos_params').select('cor', { count: 'exact', head: true }).eq('cor', String(acao.cor))
          if (!count) return resposta(400, { error: `Bandô não encontrado: ${acao.cor}` })
        } else if (tipo === 'atualizar_colocacao') {
          if (!(Number(acao.preco) > 0)) return resposta(400, { error: 'Preço de instalação inválido' })
          const { count } = await db.from('precos_colocacao').select('id', { count: 'exact', head: true }).eq('id', Number(acao.id))
          if (!count) return resposta(400, { error: `Faixa de instalação #${acao.id} não existe` })
        } else if (tipo === 'atualizar_barra_faixa') {
          const qtd = Number(acao.qtd_presilhas)
          if (!(Number.isInteger(qtd) && qtd > 0)) return resposta(400, { error: 'Quantidade de presilhas inválida' })
          const { count } = await db.from('precos_barra_faixas').select('largura_min', { count: 'exact', head: true })
            .eq('largura_min', Number(acao.largura_min))
          if (!count) return resposta(400, { error: `Faixa da barra não encontrada: a partir de ${acao.largura_min}m` })
        } else if (tipo === 'atualizar_motor_componente') {
          if (!(Number(acao.custo) > 0)) return resposta(400, { error: `Custo inválido em ${acao.item}` })
          const { count } = await db.from('precos_motor_componentes').select('id', { count: 'exact', head: true }).eq('item', String(acao.item))
          if (!count) return resposta(400, { error: `Componente de motor não encontrado: ${acao.item}` })
        } else if (tipo === 'atualizar_motor_estrutura') {
          if (!(Number(acao.valor) > 0)) return resposta(400, { error: 'Valor de estrutura inválido' })
          const { count } = await db.from('precos_motor_estrutura').select('id', { count: 'exact', head: true }).eq('id', Number(acao.id))
          if (!count) return resposta(400, { error: `Linha de estrutura #${acao.id} não existe` })
        } else if (tipo === 'atualizar_romana') {
          if (!(Number(acao.custo) > 0)) return resposta(400, { error: 'Custo inválido na matriz Romana' })
          const { count } = await db.from('precos_romana_matriz').select('largura', { count: 'exact', head: true })
            .eq('largura', Number(acao.largura)).eq('altura', Number(acao.altura))
          if (!count) return resposta(400, { error: `Célula ${acao.largura}×${acao.altura} não existe na matriz Romana` })
        }
      }

      // FASE 2: aplicar (tudo já validado) — guarda o "antes" no detalhe pra permitir o Desfazer
      const aplicadas: string[] = []
      for (const acao of acoes) {
        const tipo = String(acao.tipo ?? '')
        let detalhe: Record<string, unknown> = { ...acao }

        if (tipo === 'criar_promocao') {
          const pct = Number(acao.desconto_pct)
          const { data: nova, error } = await db.from('precos_promocoes').insert({
            alvo_tipo: 'tecido', alvo_nome: acao.tecido, desconto_pct: pct, inicio: acao.inicio, fim: acao.fim,
          }).select('id').single()
          if (error) throw error
          detalhe = { ...detalhe, promo_id: nova?.id }
          aplicadas.push(`Promoção: ${acao.tecido} −${pct}% (${acao.inicio} → ${acao.fim})`)
        } else if (tipo === 'remover_promocao') {
          const { data: antes } = await db.from('precos_promocoes').select('*').eq('id', Number(acao.id)).single()
          const { error } = await db.from('precos_promocoes').delete().eq('id', Number(acao.id))
          if (error) throw error
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Promoção #${acao.id} removida`)
        } else if (tipo === 'atualizar_preco_tecido') {
          const preco = Number(acao.preco)
          let qa = db.from('precos_tecidos').select('id, largura, preco').eq('nome', acao.nome)
          if (acao.largura != null) qa = qa.eq('largura', Number(acao.largura))
          const { data: antes } = await qa
          let q = db.from('precos_tecidos').update({ preco }).eq('nome', acao.nome)
          if (acao.largura != null) q = q.eq('largura', Number(acao.largura))
          const { error, count } = await q.select('id', { count: 'exact' })
          if (error) throw error
          if (!count) throw new Error(`Tecido não encontrado: ${acao.nome}`)
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Preço: ${acao.nome}${acao.largura != null ? ` (${acao.largura}m)` : ''} → R$ ${preco.toFixed(2)}`)
        } else if (tipo === 'atualizar_parametro') {
          const { data: antes } = await db.from('precos_parametros').select('valor').eq('chave', String(acao.chave)).single()
          const { error, count } = await db.from('precos_parametros')
            .update({ valor: Number(acao.valor) }).eq('chave', String(acao.chave)).select('chave', { count: 'exact' })
          if (error) throw error
          if (!count) throw new Error(`Parâmetro não encontrado: ${acao.chave}`)
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Parâmetro: ${acao.chave} → ${acao.valor}`)
        } else if (tipo === 'atualizar_preco_artigo') {
          const preco = Number(acao.preco)
          const { data: antes } = await db.from('precos_artigos').select('preco')
            .eq('categoria', String(acao.categoria)).eq('nome', String(acao.nome)).single()
          const { error, count } = await db.from('precos_artigos')
            .update({ preco }).eq('categoria', String(acao.categoria)).eq('nome', String(acao.nome))
            .select('id', { count: 'exact' })
          if (error) throw error
          if (!count) throw new Error(`Artigo não encontrado: ${acao.nome}`)
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Artigo: ${acao.nome} → R$ ${preco.toFixed(2)}`)
        } else if (tipo === 'atualizar_componente_ferragem') {
          const valor = Number(acao.valor)
          const { data: antes } = await db.from('precos_ferragem_componentes')
            .select('familia, cor, espessura, item, valor').eq('id', Number(acao.id)).single()
          const { error, count } = await db.from('precos_ferragem_componentes')
            .update({ valor }).eq('id', Number(acao.id)).select('id', { count: 'exact' })
          if (error) throw error
          if (!count) throw new Error(`Componente #${acao.id} não encontrado`)
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Ferragem: ${antes?.item ?? acao.item ?? `componente #${acao.id}`} (${antes?.familia ?? ''} ${antes?.cor ?? ''}) → R$ ${valor.toFixed(2)}`)
        } else if (tipo === 'atualizar_ph50') {
          const campo = String(acao.campo), valor = Number(acao.valor)
          const { data: antes } = await db.from('precos_ph50').select(campo)
            .eq('modelo', String(acao.modelo)).eq('cor', String(acao.cor)).single()
          const { error } = await db.from('precos_ph50').update({ [campo]: valor })
            .eq('modelo', String(acao.modelo)).eq('cor', String(acao.cor))
          if (error) throw error
          detalhe = { ...detalhe, antes }
          aplicadas.push(`PH 50 ${acao.modelo} ${acao.cor}: ${campo} → R$ ${valor.toFixed(2)}`)
        } else if (tipo === 'atualizar_bando_param') {
          const campo = String(acao.campo), valor = Number(acao.valor)
          const { data: antes } = await db.from('precos_bandos_params').select(campo).eq('cor', String(acao.cor)).single()
          const { error } = await db.from('precos_bandos_params').update({ [campo]: valor }).eq('cor', String(acao.cor))
          if (error) throw error
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Bandô ${acao.cor}: ${campo} → R$ ${valor.toFixed(2)}`)
        } else if (tipo === 'atualizar_colocacao') {
          const preco = Number(acao.preco)
          const { data: antes } = await db.from('precos_colocacao').select('ml_min, ml_max, preco').eq('id', Number(acao.id)).single()
          const { error } = await db.from('precos_colocacao').update({ preco }).eq('id', Number(acao.id))
          if (error) throw error
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Instalação (${antes?.ml_min}–${antes?.ml_max}ml) → R$ ${preco.toFixed(2)}`)
        } else if (tipo === 'atualizar_barra_faixa') {
          const qtd = Number(acao.qtd_presilhas)
          const { data: antes } = await db.from('precos_barra_faixas').select('qtd_presilhas')
            .eq('largura_min', Number(acao.largura_min)).single()
          const { error } = await db.from('precos_barra_faixas').update({ qtd_presilhas: qtd })
            .eq('largura_min', Number(acao.largura_min))
          if (error) throw error
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Barra: a partir de ${acao.largura_min}m → ${qtd} presilhas`)
        } else if (tipo === 'atualizar_motor_componente') {
          const custo = Number(acao.custo)
          const { data: antes } = await db.from('precos_motor_componentes').select('custo').eq('item', String(acao.item)).single()
          const { error } = await db.from('precos_motor_componentes').update({ custo }).eq('item', String(acao.item))
          if (error) throw error
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Motor: ${acao.item} → R$ ${custo.toFixed(2)}`)
        } else if (tipo === 'atualizar_motor_estrutura') {
          const valor = Number(acao.valor)
          const { data: antes } = await db.from('precos_motor_estrutura').select('largura, alt_faixa, valor').eq('id', Number(acao.id)).single()
          const { error } = await db.from('precos_motor_estrutura').update({ valor }).eq('id', Number(acao.id))
          if (error) throw error
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Motor estrutura (${antes?.largura}m, ${antes?.alt_faixa}) → R$ ${valor.toFixed(2)}`)
        } else if (tipo === 'atualizar_romana') {
          const custo = Number(acao.custo)
          const { data: antes } = await db.from('precos_romana_matriz').select('custo')
            .eq('largura', Number(acao.largura)).eq('altura', Number(acao.altura)).single()
          const { error } = await db.from('precos_romana_matriz').update({ custo })
            .eq('largura', Number(acao.largura)).eq('altura', Number(acao.altura))
          if (error) throw error
          detalhe = { ...detalhe, antes }
          aplicadas.push(`Romana ${acao.largura}×${acao.altura}m → R$ ${custo.toFixed(2)}`)
        }

        await db.from('precos_auditoria').insert({
          usuario: caller.email ?? caller.id, origem: 'ia', acao: tipo, detalhe,
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
