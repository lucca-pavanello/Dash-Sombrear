/**
 * Edge Function: gemini-chat
 * Proxy para a API do Gemini — mantém a chave no servidor, fora do bundle.
 * Usado pelo AI Copilot dos orçamentos (src/hooks/useGemini.ts).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
