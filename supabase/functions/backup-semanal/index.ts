/**
 * Edge Function: backup-semanal
 * Exporta as tabelas vitais (orçamentos, CRM, preços, config) pra um JSON no
 * bucket privado 'backups'. Agendada pelo pg_cron (segunda 06:00 UTC) via
 * pg_net com segredo compartilhado. Mantém os 8 backups mais recentes.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TABELAS = [
  'orcamentos', 'orcamento_historico', 'crm_sombrear_ia', 'orcamentos_sombrear_ia',
  'profiles', 'config_automacoes', 'precos_auditoria',
  'precos_tecidos', 'precos_tecido_modelos', 'precos_promocoes', 'precos_parametros',
  'precos_artigos', 'precos_ferragem_familias', 'precos_ferragem_componentes',
  'precos_ferragem_escada', 'precos_ph50', 'precos_bandos', 'precos_bandos_params',
  'precos_barra_faixas', 'precos_colocacao', 'precos_motor_estrutura',
  'precos_motor_componentes', 'precos_romana_matriz',
]
const MANTER = 8

function resposta(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    if (body.segredo !== Deno.env.get('PUSH_TRIGGER_SECRET')) {
      return resposta(401, { error: 'Não autorizado' })
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const dump: Record<string, unknown[]> = {}
    for (const tabela of TABELAS) {
      const linhas: unknown[] = []
      for (let de = 0; ; de += 1000) {
        const { data, error } = await db.from(tabela).select('*').range(de, de + 999)
        if (error) { dump[`ERRO_${tabela}`] = [{ erro: error.message }]; break }
        linhas.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      dump[tabela] = linhas
    }

    const dia = new Date().toISOString().slice(0, 10)
    const nome = `backup-${dia}.json`
    const conteudo = JSON.stringify({ gerado_em: new Date().toISOString(), tabelas: dump })
    const { error: upError } = await db.storage.from('backups')
      .upload(nome, new Blob([conteudo], { type: 'application/json' }), { upsert: true })
    if (upError) return resposta(500, { error: `Upload falhou: ${upError.message}` })

    // Retenção: mantém os MANTER mais recentes
    const { data: arquivos } = await db.storage.from('backups').list('', { sortBy: { column: 'name', order: 'desc' } })
    const antigos = (arquivos ?? []).filter(a => a.name.startsWith('backup-')).slice(MANTER).map(a => a.name)
    if (antigos.length) await db.storage.from('backups').remove(antigos)

    const total = Object.values(dump).reduce((s, v) => s + v.length, 0)
    return resposta(200, { arquivo: nome, linhas: total, bytes: conteudo.length, removidos: antigos.length })
  } catch (err) {
    return resposta(500, { error: err instanceof Error ? err.message : 'Erro interno' })
  }
})
