/**
 * Edge Function: push-aceite
 * Disparada pelo trigger trg_push_aceite (pg_net) quando um orçamento é aceito
 * pelo cliente na página pública. Envia Web Push para todos os aparelhos
 * inscritos (equipe da Sombrear com o PWA instalado).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const body = await req.json()
    // Autoriza só o trigger do banco (segredo compartilhado no corpo — pg_net)
    if (body.segredo !== Deno.env.get('PUSH_TRIGGER_SECRET')) {
      return resposta(401, { error: 'Não autorizado' })
    }

    webpush.setVapidDetails(
      'mailto:luccapavanallo@gmail.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth')
    if (!subs?.length) return resposta(200, { enviados: 0 })

    const valor = body.valor_venda != null
      ? `R$ ${Number(body.valor_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : null
    const payload = JSON.stringify({
      title: '🎉 Orçamento aceito!',
      body: [body.cliente ?? 'Cliente', body.modelo, valor].filter(Boolean).join(' · '),
      url: '/orcamentos/kanban',
    })

    let enviados = 0
    const mortas: string[] = []
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        enviados++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) mortas.push(s.id) // aparelho desinscreveu
      }
    }))
    if (mortas.length) await db.from('push_subscriptions').delete().in('id', mortas)

    return resposta(200, { enviados, removidas: mortas.length })
  } catch (err) {
    return resposta(500, { error: err instanceof Error ? err.message : 'Erro interno' })
  }
})
