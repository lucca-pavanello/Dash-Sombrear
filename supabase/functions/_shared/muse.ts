/**
 * Chamada ao Muse (Meta), formato OpenAI-compatível.
 *
 * É o mesmo endpoint e o mesmo modelo que os workflows do n8n passaram a usar
 * na migração de 24/09 — trocar por Gemini aqui faria as duas metades do
 * sistema responderem com modelos diferentes sem ninguém decidir isso.
 *
 * Timeout explícito: sem ele a plataforma mata o processo no meio e o erro que
 * chega ao chamador é "Failed to send a request to the Edge Function", que não
 * distingue "demorou" de "a function não existe".
 */
const URL_MUSE = 'https://api.meta.ai/v1/chat/completions'
export const MODELO_PADRAO = 'muse-spark-1.3-contributor'

export type ResultadoMuse = { ok: true; texto: string } | { ok: false; erro: string }

export async function pedirTexto(
  prompt: string,
  opcoes: { modelo?: string; maxTokens?: number; timeoutMs?: number } = {},
): Promise<ResultadoMuse> {
  const chave = Deno.env.get('META_API_KEY')
  if (!chave) return { ok: false, erro: 'META_API_KEY não configurada' }

  try {
    const r = await fetch(URL_MUSE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opcoes.modelo ?? MODELO_PADRAO,
        max_tokens: opcoes.maxTokens ?? 4000,
        reasoning_effort: 'minimal',
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(opcoes.timeoutMs ?? 120_000),
    })
    if (!r.ok) return { ok: false, erro: `muse ${r.status}: ${(await r.text()).slice(0, 300)}` }

    const j = await r.json()
    const texto = j?.choices?.[0]?.message?.content
    if (typeof texto !== 'string' || !texto.trim()) return { ok: false, erro: 'resposta sem texto' }
    return { ok: true, texto }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha na chamada' }
  }
}
