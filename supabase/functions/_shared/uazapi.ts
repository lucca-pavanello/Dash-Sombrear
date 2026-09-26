/**
 * Envio de WhatsApp pela Uazapi.
 *
 * O token vinha escrito à mão dentro dos nodes do n8n (e ainda está lá, nos
 * que não migraram). Aqui ele é `UAZAPI_TOKEN`, Function Secret.
 *
 * `destino` aceita número ou JID de grupo: grupo (`...@g.us`) vai inteiro,
 * número é reduzido a dígitos. É a mesma normalização que o n8n fazia inline.
 */
const URL_ENVIO = 'https://lucca.uazapi.com/send/text'

export function normalizarDestino(v: string | null | undefined): string {
  const s = String(v ?? '')
  return s.includes('@g.us') ? s : s.replace(/\D/g, '')
}

export type ResultadoEnvio = { ok: true } | { ok: false; erro: string }

export async function enviarTexto(
  destino: string,
  texto: string,
  origem = 'edge',
): Promise<ResultadoEnvio> {
  const token = Deno.env.get('UAZAPI_TOKEN')
  if (!token) return { ok: false, erro: 'UAZAPI_TOKEN não configurado' }

  const numero = normalizarDestino(destino)
  if (!numero) return { ok: false, erro: 'destino vazio' }

  try {
    // timeout explícito: sem ele a plataforma mata o processo no meio e o erro
    // que chega é "Failed to send a request to the Edge Function", que não
    // distingue "demorou" de "a function não existe"
    const r = await fetch(URL_ENVIO, {
      method: 'POST',
      headers: { token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: numero, text: texto, track_source: origem }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!r.ok) return { ok: false, erro: `uazapi ${r.status}: ${(await r.text()).slice(0, 200)}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha no envio' }
  }
}
