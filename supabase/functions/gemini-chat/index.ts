/**
 * Edge Function: gemini-chat
 * Proxy para a API do Gemini — mantém a chave no servidor, fora do bundle.
 * Usado pelo card de Insights do Agente IA (src/components/agente/InsightsAmanda.tsx).
 * O copiloto do dash saiu daqui para a `copilot-ia`, que tem ferramentas.
 *
 * Só usuário logado e aprovado: antes qualquer um com a URL gastava a chave.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const semAcesso = (status: number, error: string) => new Response(JSON.stringify({ error }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
    if (!authHeader) return semAcesso(401, 'Não autorizado')
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const doUsuario = createClient(url, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await doUsuario.auth.getUser()
    if (!user) return semAcesso(401, 'Token inválido')
    const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: perfil } = await admin.from('profiles').select('approved').eq('id', user.id).single()
    if (perfil?.approved !== true) return semAcesso(403, 'Acesso pendente de aprovação')

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { contents } = await req.json()

    // Mesma estratégia do precos-ia: tenta modelos atuais em ordem
    // (gemini-1.5-flash foi aposentado pelo Google — não usar)
    let data: unknown = null
    let status = 500
    for (const modelo of ['gemini-3.7-flash', 'gemini-flash-latest']) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      })
      data = await res.json()
      status = res.status
      if (res.ok) {
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // 404 = modelo indisponível → tenta o próximo; outros erros param aqui
      if (res.status !== 404) break
    }

    return new Response(JSON.stringify({ error: data }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
