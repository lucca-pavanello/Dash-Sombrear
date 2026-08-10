/**
 * Edge Function: simular
 * Simulador de balcão — calcula o orçamento no servidor com o MESMO motor do
 * dash (calc.ts = cópia de src/lib/simulador.ts), sem expor custos ao cliente.
 *
 * acao 'calcular' → valores de venda (custos/margem só quando o chamador é admin)
 * acao 'salvar'   → grava direto em orcamentos (fonte='simulador', status FEITO)
 *
 * Qualquer usuário APROVADO usa; custo e margem nunca saem para não-admin.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { simular } from './calc.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_EMAIL = 'luccapavanallo@gmail.com'
const MODELOS = new Set(['Rolo', 'Double', 'Romana', 'PV', 'PH_Aluminio', 'PH_50'])
const ACABAMENTOS = new Set(['nenhum', 'bando_branco', 'bando_preto', 'barra', 'kit_box'])
const ROTULO_ACABAMENTO: Record<string, string> = {
  nenhum: 'Sem', bando_branco: 'Bando Branco', bando_preto: 'Bando Preto',
  barra: 'Barra Niveladora', kit_box: 'Kit Box',
}

function resposta(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── Auth: usuário aprovado ──────────────────────────────
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
    const { data: perfil } = await db.from('profiles')
      .select('approved, is_admin, full_name, email').eq('id', caller.id).single()
    if (perfil?.approved !== true) return resposta(403, { error: 'Acesso pendente de aprovação' })
    const isAdmin = caller.email === ADMIN_EMAIL || perfil?.is_admin === true

    const body = await req.json()
    const acao = String(body.acao ?? 'calcular')

    // ══════════════ OPÇÕES (nomes apenas, sem preços) ══════════════
    if (acao === 'opcoes') {
      const [{ data: tec }, { data: art }, { data: p50 }] = await Promise.all([
        db.from('precos_tecidos_vigentes').select('nome').order('nome'),
        db.from('precos_artigos').select('categoria, nome').order('nome'),
        db.from('precos_ph50').select('modelo, cor').order('modelo'),
      ])
      return resposta(200, {
        tecidos: [...new Set((tec ?? []).map(t => t.nome))],
        artigosPV: (art ?? []).filter(a => a.categoria === 'PV').map(a => a.nome),
        artigosPH: (art ?? []).filter(a => a.categoria === 'PH_ALUMINIO').map(a => a.nome),
        ph50: (p50 ?? []).map(p => ({ valor: `${p.modelo}|${p.cor}`, label: `${String(p.modelo).trim()} · ${p.cor}` })),
      })
    }

    // ── Entrada saneada ─────────────────────────────────────
    const e = body.entrada ?? {}
    const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
    const entrada = {
      modelo: String(e.modelo ?? ''),
      tecido: e.tecido ? String(e.tecido) : undefined,
      artigo: e.artigo ? String(e.artigo) : undefined,
      ph50Acabamento: e.ph50Acabamento === 'fita' ? 'fita' as const : 'cadarco' as const,
      ph50Bando: e.ph50Bando === true,
      corFerragem: e.corFerragem === 'PRETA' ? 'PRETA' as const : 'BRANCA' as const,
      largura: num(e.largura),
      altura: num(e.altura),
      quantidade: Math.max(1, Math.round(num(e.quantidade) || 1)),
      acabamento: ACABAMENTOS.has(String(e.acabamento)) ? String(e.acabamento) : 'nenhum',
      incluirInstalacao: e.incluirInstalacao === true,
    }
    if (!MODELOS.has(entrada.modelo)) return resposta(400, { error: 'Modelo inválido' })

    // ── Dados de preço (service role — RLS admin não bloqueia o cálculo) ──
    const [
      { data: tecidos }, { data: componentes }, { data: bandos }, { data: bandoParams },
      { data: barraFaixas }, { data: colocacao }, { data: artigos }, { data: ph50 },
      { data: parametros }, { data: romana },
    ] = await Promise.all([
      db.from('precos_tecidos_vigentes').select('*'),
      db.from('precos_ferragem_componentes').select('*'),
      db.from('precos_bandos').select('*'),
      db.from('precos_bandos_params').select('*'),
      db.from('precos_barra_faixas').select('*'),
      db.from('precos_colocacao').select('*'),
      db.from('precos_artigos').select('*'),
      db.from('precos_ph50').select('*'),
      db.from('precos_parametros').select('*'),
      db.from('precos_romana_matriz').select('*'),
    ])

    // deno-lint-ignore no-explicit-any
    const r = simular(entrada as any, {
      tecidos: tecidos ?? [], componentes: componentes ?? [], bandos: bandos ?? [],
      bandoParams: bandoParams ?? [], barraFaixas: barraFaixas ?? [], colocacao: colocacao ?? [],
      artigos: artigos ?? [], ph50: ph50 ?? [], parametros: parametros ?? [], romana: romana ?? [],
      // deno-lint-ignore no-explicit-any
    } as any)
    if ('erro' in r) return resposta(200, { erro: r.erro })

    const publico = {
      total4x: r.total4x,
      totalAvista: r.totalAvista,
      vendaProduto: r.vendaProduto,
      vendaAcabamento: r.vendaAcabamento,
      instalacao: r.instalacao,
      emPromocao: r.emPromocao,
      descontoPct: r.descontoPct,
      observacoes: r.observacoes,
    }

    // ══════════════ CALCULAR ══════════════
    if (acao === 'calcular') {
      if (!isAdmin) return resposta(200, publico)
      return resposta(200, { ...publico, custoProduto: r.custoProduto, custoAcabamento: r.custoAcabamento })
    }

    // ══════════════ SALVAR ══════════════
    if (acao === 'salvar') {
      const cliente = String(body.cliente ?? '').trim() || 'Balcão'
      const telefone = String(body.telefone ?? '').trim() || null
      const ambiente = String(body.ambiente ?? '').trim() || null
      const instalacaoNum = typeof r.instalacao === 'number' ? r.instalacao : null
      const receita = r.total4x + (instalacaoNum ?? 0)
      const custoTotal = r.custoProduto + r.custoAcabamento
      const margem = receita > 0 ? ((receita - custoTotal) / receita) * 100 : null
      const obs = [
        'Criado no Simulador de balcão.',
        r.instalacao === 'sob_consulta' ? 'Instalação sob consulta.' : null,
        r.emPromocao ? `Tecido em promoção (−${r.descontoPct ?? '?'}%).` : null,
        ...r.observacoes,
      ].filter(Boolean).join(' ')

      const { data: novo, error: insertError } = await db.from('orcamentos').insert({
        responsavel: perfil?.full_name || perfil?.email || 'Balcão',
        cliente,
        telefone,
        ambiente,
        modelo: entrada.modelo,
        tecido: entrada.tecido ?? entrada.artigo ?? null,
        largura: entrada.largura || null,
        altura: entrada.altura || null,
        quantidade: entrada.quantidade,
        cor_ferragem_motor: entrada.corFerragem === 'PRETA' ? 'Preta' : 'Branca',
        acabamentos: ROTULO_ACABAMENTO[entrada.acabamento] ?? 'Sem',
        valor_venda: r.total4x,
        instalacao: instalacaoNum,
        custo_tecido: custoTotal,
        custo_acabamento: r.custoAcabamento,
        valor_parceiro: r.valorParceiro ?? 0,
        margem,
        status: 'FEITO',
        fechado: body.fechado === true,
        fonte: body.fechado === true ? 'fechamento' : 'simulador',
        user_id: caller.id,
        observacoes: obs,
      }).select('id').single()

      if (insertError) return resposta(500, { error: `Falha ao salvar: ${insertError.message}` })
      return resposta(200, { ...publico, id: novo.id, cliente })
    }

    return resposta(400, { error: 'Ação inválida' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return resposta(500, { error: message })
  }
})
