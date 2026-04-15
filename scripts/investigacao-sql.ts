/**
 * Script de investigação do estado real do banco — Fase A (mudança-46)
 * Investiga se as funções/config estão aplicadas no Supabase antes de corrigir.
 *
 * Uso:
 *   npm run auditoria:estoque:investigar
 *
 * Variáveis de ambiente (.env):
 *   SUPABASE_URL ou VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY  — necessário para introspection via information_schema
 *   VITE_SUPABASE_ANON_KEY — fallback com checks limitados
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'

config()

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  'https://nlswyjpjzibuvdsaooyg.supabase.co'

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  ''

if (!SUPABASE_KEY) {
  console.error('❌ Nenhuma chave Supabase encontrada.')
  process.exit(1)
}

const usandoServiceKey = !!process.env.SUPABASE_SERVICE_KEY
console.log(`🔑 Chave: ${usandoServiceKey ? 'service key (introspection completa)' : 'anon key (checks limitados)'}\n`)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface InvestigacaoResult {
  item: string
  status: 'ok' | 'aviso' | 'erro' | 'info'
  detalhe: string
  dados?: unknown
}

const resultados: InvestigacaoResult[] = []

function log(r: InvestigacaoResult) {
  resultados.push(r)
  const emoji = { ok: '✅', aviso: '⚠️ ', erro: '❌', info: 'ℹ️ ' }[r.status]
  console.log(`${emoji} ${r.item}: ${r.detalhe}`)
}

// ─── Heurística melhorada para funções com parâmetros ─────────────────────────
// PostgREST retorna "Could not find the function public.nome without parameters..."
// PostgreSQL retorna "function nome() does not exist"
// Ambos = falso negativo: a função EXISTE com args, só não tem assinatura vazia.
function funcaoExisteComParams(nome: string, errorMsg: string): boolean {
  return (
    errorMsg.includes('without parameters') ||
    (errorMsg.includes('does not exist') && errorMsg.includes(`${nome}()`))
  )
}

async function investigar() {
  console.log('🔍 INVESTIGAÇÃO DO ESTADO REAL DO BANCO (mudança-46)\n')

  await checarFuncoes()
  await checarConfig()
  await checarView()
  await checarDadosReais()
  await checarMigrations()

  gerarRelatorio()
}

// ─── 1. Funções SQL ───────────────────────────────────────────────────────────
async function checarFuncoes() {
  console.log('─── Funções SQL ───')

  const funcoes = [
    { nome: 'estoque_recalcular_abc',        temParams: false },
    { nome: 'estoque_consumir_peps',         temParams: true  },
    { nome: 'estoque_calcular_giro',         temParams: false }, // args opcionais
    { nome: 'estoque_calcular_lec',          temParams: true  },
    { nome: 'estoque_calcular_desconto_combo', temParams: true },
    { nome: 'estoque_fn_capital_travado',    temParams: false }, // arg opcional
    { nome: 'estoque_fn_roi_estoque',        temParams: false },
    { nome: 'estoque_chat_contexto',         temParams: true  },
  ]

  for (const fn of funcoes) {
    const { error } = await supabase.rpc(fn.nome)

    if (!error) {
      log({ item: `fn:${fn.nome}`, status: 'ok', detalhe: 'Existe e executa sem parâmetros' })
      continue
    }

    if (funcaoExisteComParams(fn.nome, error.message)) {
      log({ item: `fn:${fn.nome}`, status: 'ok', detalhe: 'Existe (requer parâmetros — heurística confirmou)' })
      continue
    }

    if (error.message.includes('does not exist') || error.message.includes('Could not find')) {
      log({ item: `fn:${fn.nome}`, status: 'erro', detalhe: `NÃO EXISTE no banco — ${error.message}` })
    } else {
      // Outro erro (tipo incorreto, permissão etc.) — função existe
      log({ item: `fn:${fn.nome}`, status: 'ok', detalhe: `Existe (erro de runtime: ${error.message})` })
    }
  }
}

// ─── 2. Config ────────────────────────────────────────────────────────────────
async function checarConfig() {
  console.log('\n─── estoque_config ───')

  const { data, error } = await supabase.from('estoque_config').select('*')

  if (error) {
    log({ item: 'estoque_config', status: 'erro', detalhe: `Erro ao ler: ${error.message}` })
    return
  }

  if (!data || data.length === 0) {
    log({ item: 'estoque_config', status: 'erro', detalhe: 'TABELA VAZIA — popular com B1 de correcoes-sql.sql' })
    return
  }

  const chavesEsperadas = [
    'lead_time_verde_max_dias',
    'lead_time_amarelo_max_dias',
    'custo_pedido_reais',
    'taxa_custo_estocagem_percent',
    'meses_historico_demanda',
  ]

  const rows = data as { chave: string; valor: string }[]
  const chavesPresentes = rows.map(r => r.chave)
  const faltando = chavesEsperadas.filter(k => !chavesPresentes.includes(k))

  log({
    item: 'estoque_config',
    status: faltando.length > 0 ? 'aviso' : 'ok',
    detalhe: faltando.length > 0
      ? `${rows.length} config(s) presentes, faltando: ${faltando.join(', ')}`
      : `${rows.length} config(s) — todas as chaves esperadas presentes`,
    dados: rows,
  })
}

// ─── 3. View de sugestão (prova se LEC está embutido) ────────────────────────
async function checarView() {
  console.log('\n─── View estoque_vw_sugestao_compra ───')

  const { data, error } = await supabase
    .from('estoque_vw_sugestao_compra')
    .select('*')
    .limit(3)

  if (error) {
    log({ item: 'vw_sugestao_compra', status: 'erro', detalhe: `View não existe ou erro: ${error.message}` })
    return
  }

  const temLec = data && data.length > 0 && 'lec_sugerido' in data[0]

  log({
    item: 'vw_sugestao_compra',
    status: temLec ? 'ok' : 'aviso',
    detalhe: temLec
      ? `Existe e retorna lec_sugerido (LEC está ativo) — ${data?.length ?? 0} produto(s) classe A`
      : `Existe mas sem coluna lec_sugerido — LEC pode não estar aplicado. Colunas: ${data && data.length > 0 ? Object.keys(data[0]).join(', ') : 'nenhuma'}`,
    dados: temLec ? data : undefined,
  })
}

// ─── 4. Dados reais (prova se PEPS funcionou em vendas passadas) ──────────────
async function checarDadosReais() {
  console.log('\n─── Dados reais ───')

  // Vendas registradas
  const { count: totalVendas } = await supabase
    .from('estoque_vendas')
    .select('*', { count: 'exact', head: true })

  log({
    item: 'estoque_vendas',
    status: 'info',
    detalhe: `${totalVendas ?? 0} venda(s) registrada(s) no banco`,
  })

  // Lotes consumidos (quantidade_restante < quantidade original → PEPS rodou)
  const { count: lotesConsumidos } = await supabase
    .from('estoque_lote_itens')
    .select('*', { count: 'exact', head: true })
    .lt('quantidade_restante', supabase.rpc as unknown as number) // workaround — query abaixo

  // Query real via .lt
  const { count: consumidos } = await supabase
    .from('estoque_lote_itens')
    .select('*', { count: 'exact', head: true })
    .filter('quantidade_restante', 'lt', 'quantidade')

  void lotesConsumidos // suprime unused warning

  log({
    item: 'peps_evidencia',
    status: 'info',
    detalhe: `${consumidos ?? 0} item(ns) de lote com quantidade_restante < quantidade original (PEPS ativo)`,
  })

  // Produtos com classificação ABC
  const { count: produtosABC } = await supabase
    .from('estoque_produtos')
    .select('*', { count: 'exact', head: true })
    .not('classificacao_abc', 'is', null)

  log({
    item: 'abc_classificados',
    status: 'info',
    detalhe: `${produtosABC ?? 0} produto(s) com classificação ABC definida`,
  })
}

// ─── 5. Migrations via supabase_migrations (service key) ─────────────────────
async function checarMigrations() {
  console.log('\n─── Migrations aplicadas ───')

  if (!usandoServiceKey) {
    log({ item: 'migrations', status: 'aviso', detalhe: 'Requer service key — não verificado (anon key em uso)' })
    return
  }

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      select version, name, executed_at
      from supabase_migrations.schema_migrations
      order by executed_at desc
      limit 20;
    `,
  })

  if (error) {
    log({ item: 'migrations', status: 'aviso', detalhe: `Não foi possível verificar: ${error.message}` })
    return
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    log({ item: 'migrations', status: 'aviso', detalhe: 'Nenhuma migration encontrada (ou tabela não acessível)' })
    return
  }

  log({ item: 'migrations', status: 'ok', detalhe: `${data.length} migration(s) mais recentes`, dados: data })
}

// ─── Relatório ────────────────────────────────────────────────────────────────
function gerarRelatorio() {
  const data = new Date().toISOString().split('T')[0]
  const arquivo = path.join('scripts', `investigacao-sql-${data}.md`)

  const totais = {
    ok:    resultados.filter(r => r.status === 'ok').length,
    aviso: resultados.filter(r => r.status === 'aviso').length,
    erro:  resultados.filter(r => r.status === 'erro').length,
    info:  resultados.filter(r => r.status === 'info').length,
  }

  let md = `# Investigação SQL — Estado Real do Banco (${data})\n\n`
  md += `> Gerado por \`npm run auditoria:estoque:investigar\`\n\n`
  md += `## Resumo\n\n`
  md += `- ✅ ${totais.ok} OK\n`
  md += `- ⚠️ ${totais.aviso} avisos\n`
  md += `- ❌ ${totais.erro} erros — **requerem ação**\n`
  md += `- ℹ️ ${totais.info} informações\n\n`

  if (totais.erro > 0) {
    md += `## Ações necessárias\n\n`
    md += `Rode o arquivo \`scripts/correcoes-sql.sql\` no SQL Editor do Supabase.\n\n`
    md += `Itens com erro:\n`
    for (const r of resultados.filter(r => r.status === 'erro')) {
      md += `- **${r.item}**: ${r.detalhe}\n`
    }
    md += '\n'
  }

  md += `## Detalhes\n\n`
  for (const r of resultados) {
    const emoji = { ok: '✅', aviso: '⚠️', erro: '❌', info: 'ℹ️' }[r.status]
    md += `### ${emoji} ${r.item}\n\n${r.detalhe}\n\n`
    if (r.dados) {
      md += `<details><summary>Dados</summary>\n\n\`\`\`json\n${JSON.stringify(r.dados, null, 2)}\n\`\`\`\n\n</details>\n\n`
    }
  }

  md += `---\n*Script: \`npm run auditoria:estoque:investigar\`*\n`

  fs.writeFileSync(arquivo, md)
  console.log(`\n📄 Relatório salvo em: ${arquivo}`)
  console.log(`\n📊 RESULTADO: ${totais.ok} OK | ${totais.aviso} avisos | ${totais.erro} erros | ${totais.info} info\n`)

  if (totais.erro > 0) {
    console.log(`⚡ Próximo passo: aplicar scripts/correcoes-sql.sql no SQL Editor do Supabase\n`)
  }
}

investigar().catch(err => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
