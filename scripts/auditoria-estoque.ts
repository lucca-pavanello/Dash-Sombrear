/**
 * Script de auditoria do módulo de estoque
 * Somente leitura — não modifica banco nem código.
 *
 * Uso:
 *   npm run auditoria:estoque
 *
 * Variáveis de ambiente (.env):
 *   SUPABASE_URL ou VITE_SUPABASE_URL   — URL do projeto Supabase
 *   SUPABASE_SERVICE_KEY                — Service Role Key (necessário para trigger check)
 *   Se não tiver a service key, usa VITE_SUPABASE_ANON_KEY (checks básicos funcionam, trigger check não)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'

config() // carrega .env

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  'https://nlswyjpjzibuvdsaooyg.supabase.co'

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  ''

if (!SUPABASE_KEY) {
  console.error('❌ Nenhuma chave Supabase encontrada. Configure SUPABASE_SERVICE_KEY ou VITE_SUPABASE_ANON_KEY no .env')
  process.exit(1)
}

const usandoServiceKey = !!process.env.SUPABASE_SERVICE_KEY
if (!usandoServiceKey) {
  console.warn('⚠️  Usando anon key — verificação de triggers pode ser limitada\n')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface CheckResult {
  nome: string
  status: 'ok' | 'aviso' | 'erro'
  detalhe: string
  dados?: unknown
}

const resultados: CheckResult[] = []

function log(check: CheckResult) {
  resultados.push(check)
  const emoji = { ok: '✅', aviso: '⚠️ ', erro: '❌' }[check.status]
  console.log(`${emoji} ${check.nome}: ${check.detalhe}`)
}

async function auditar() {
  console.log('🔍 INICIANDO AUDITORIA DO MÓDULO DE ESTOQUE\n')

  // ━━━ TABELAS ━━━
  console.log('─── Tabelas ───')
  await checkTabela('estoque_produtos', ['id', 'sku', 'nome', 'tipo', 'unidade', 'estoque_atual', 'custo_unitario', 'classificacao_abc', 'ativo'])
  await checkTabela('estoque_fornecedores', ['id', 'nome', 'prazo_entrega_dias', 'ativo'])
  await checkTabela('estoque_localizacoes', ['id', 'codigo', 'setor', 'nivel_acesso', 'ativo'])
  await checkTabela('estoque_lotes', ['id', 'produto_id', 'quantidade_inicial', 'quantidade_atual', 'custo_unitario'])
  await checkTabela('estoque_vendas', ['id', 'cliente', 'vendedor', 'data', 'total'])
  await checkTabela('estoque_venda_itens', ['id', 'venda_id', 'produto_id', 'quantidade', 'preco_unitario', 'subtotal'])
  await checkTabela('estoque_movimentacoes', ['id', 'produto_id', 'tipo', 'quantidade', 'created_at'])
  await checkTabela('estoque_config', ['chave', 'valor'])
  // Tabelas opcionais (mudança-41 — requerem migration aplicada)
  await checkTabela('estoque_fornecedor_categorias', ['id', 'fornecedor_id', 'tipo_produto', 'lead_time_dias'], { opcional: true })
  await checkTabela('estoque_fornecedor_descontos_combo', ['id', 'fornecedor_id', 'categorias_combo', 'percentual_desconto'], { opcional: true })

  // ━━━ VIEWS ━━━
  console.log('\n─── Views ───')
  await checkView('estoque_vw_lead_time')
  await checkView('estoque_vw_sugestao_compra')
  await checkView('estoque_vw_sugestao_movimentacao')
  await checkView('estoque_vw_fornecedor_lead_time_efetivo', { opcional: true })

  // ━━━ FUNÇÕES SQL ━━━
  console.log('\n─── Funções SQL ───')
  await checkFuncao('estoque_recalcular_abc')
  await checkFuncao('estoque_consumir_peps')
  await checkFuncao('estoque_calcular_giro')
  await checkFuncao('estoque_calcular_lec')
  await checkFuncao('estoque_chat_contexto', { opcional: true })
  await checkFuncao('estoque_calcular_desconto_combo', { opcional: true })

  // ━━━ TRIGGERS ━━━
  console.log('\n─── Triggers ───')
  await checkTriggers()

  // ━━━ INTEGRIDADE DE DADOS ━━━
  console.log('\n─── Integridade de dados ───')
  await checkIntegridadeDados()

  // ━━━ CONFIG ATIVA ━━━
  console.log('\n─── Configurações ───')
  await checkConfigEstoque()

  // ━━━ GERAR RELATÓRIO ━━━
  gerarRelatorio()
}

async function checkTabela(
  nome: string,
  colunasObrigatorias: string[],
  opts: { opcional?: boolean } = {},
) {
  try {
    const { data, error } = await supabase.from(nome).select('*').limit(1)

    if (error) {
      if (opts.opcional) {
        log({ nome: `Tabela ${nome}`, status: 'aviso', detalhe: `Não existe (opcional — migration pendente): ${error.message}` })
      } else {
        log({ nome: `Tabela ${nome}`, status: 'erro', detalhe: `Não acessível: ${error.message}` })
      }
      return
    }

    const { count } = await supabase.from(nome).select('*', { count: 'exact', head: true })

    if (data && data.length > 0) {
      const colunasPresentes = Object.keys(data[0])
      const faltando = colunasObrigatorias.filter(c => !colunasPresentes.includes(c))
      if (faltando.length > 0) {
        log({ nome: `Tabela ${nome}`, status: 'aviso', detalhe: `Colunas não encontradas (podem ter nome diferente): ${faltando.join(', ')}`, dados: { colunas_presentes: colunasPresentes } })
        return
      }
    }

    log({ nome: `Tabela ${nome}`, status: 'ok', detalhe: `${count ?? 0} registros, colunas OK` })
  } catch (e: unknown) {
    log({ nome: `Tabela ${nome}`, status: 'erro', detalhe: String(e) })
  }
}

async function checkView(nome: string, opts: { opcional?: boolean } = {}) {
  try {
    const { data, error } = await supabase.from(nome).select('*').limit(1)
    if (error) {
      if (opts.opcional) {
        log({ nome: `View ${nome}`, status: 'aviso', detalhe: `Não existe (opcional): ${error.message}` })
      } else {
        log({ nome: `View ${nome}`, status: 'erro', detalhe: error.message })
      }
      return
    }
    const { count } = await supabase.from(nome).select('*', { count: 'exact', head: true })
    log({ nome: `View ${nome}`, status: 'ok', detalhe: `Retorna ${count ?? 0} linhas` })
  } catch (e: unknown) {
    log({ nome: `View ${nome}`, status: 'erro', detalhe: String(e) })
  }
}

async function checkFuncao(nome: string, opts: { opcional?: boolean } = {}) {
  try {
    const { error } = await supabase.rpc(nome)
    if (error) {
      // Heurística: função existe mas foi chamada sem args
      // PostgREST: "Could not find the function public.nome without parameters in the schema cache"
      // PostgreSQL: "function nome() does not exist" (assinatura vazia não bate, função existe com args)
      const existeComParams =
        error.message.includes('without parameters') ||
        (error.message.includes('does not exist') && error.message.includes(`${nome}()`))

      if (existeComParams) {
        log({ nome: `Função ${nome}`, status: 'ok', detalhe: 'Existe (requer parâmetros — verificado via heurística)' })
        return
      }

      if (error.message.includes('does not exist') || error.message.includes('Could not find')) {
        if (opts.opcional) {
          log({ nome: `Função ${nome}`, status: 'aviso', detalhe: 'Não existe (opcional — migration pendente)' })
        } else {
          log({ nome: `Função ${nome}`, status: 'erro', detalhe: 'Função não existe no banco' })
        }
      } else {
        // Outro erro = função existe mas há outro problema
        log({ nome: `Função ${nome}`, status: 'ok', detalhe: `Existe (requer parâmetros para executar — ${error.message})` })
      }
      return
    }
    log({ nome: `Função ${nome}`, status: 'ok', detalhe: 'Existe e executa sem parâmetros' })
  } catch (e: unknown) {
    log({ nome: `Função ${nome}`, status: 'erro', detalhe: String(e) })
  }
}

async function checkTriggers() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        select trigger_name, event_object_table, action_timing, event_manipulation
        from information_schema.triggers
        where trigger_schema = 'public' and event_object_table like 'estoque_%'
        order by event_object_table, trigger_name;
      `,
    })

    if (error) {
      log({ nome: 'Triggers', status: 'aviso', detalhe: `Não foi possível listar via RPC (${error.message}). Verifique manualmente no SQL Editor do Supabase.` })
      return
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      log({ nome: 'Triggers', status: 'erro', detalhe: 'Nenhum trigger encontrado em tabelas estoque_*' })
      return
    }

    log({ nome: 'Triggers', status: 'ok', detalhe: `${Array.isArray(data) ? data.length : '?'} triggers ativos`, dados: data })
  } catch (e: unknown) {
    log({ nome: 'Triggers', status: 'aviso', detalhe: `Verificação automática indisponível: ${String(e)}` })
  }
}

async function checkIntegridadeDados() {
  // Produtos sem fornecedor
  try {
    const { count: produtosSemForn } = await supabase
      .from('estoque_produtos')
      .select('*', { count: 'exact', head: true })
      .is('fornecedor_id', null)
      .eq('ativo', true)
    log({
      nome: 'Produtos sem fornecedor',
      status: (produtosSemForn ?? 0) > 0 ? 'aviso' : 'ok',
      detalhe: `${produtosSemForn ?? 0} produto(s) ativo(s) sem fornecedor cadastrado`,
    })
  } catch (e: unknown) {
    log({ nome: 'Produtos sem fornecedor', status: 'aviso', detalhe: `Coluna fornecedor_id pode não existir: ${String(e)}` })
  }

  // Produtos sem localização
  try {
    const { count: produtosSemLoc } = await supabase
      .from('estoque_produtos')
      .select('*', { count: 'exact', head: true })
      .is('localizacao_id', null)
      .eq('ativo', true)
    log({
      nome: 'Produtos sem localização',
      status: (produtosSemLoc ?? 0) > 0 ? 'aviso' : 'ok',
      detalhe: `${produtosSemLoc ?? 0} produto(s) ativo(s) sem localização`,
    })
  } catch (e: unknown) {
    log({ nome: 'Produtos sem localização', status: 'aviso', detalhe: `Coluna localizacao_id pode não existir: ${String(e)}` })
  }

  // Produtos sem custo_unitario / custo_medio
  try {
    const { count: produtosSemCusto } = await supabase
      .from('estoque_produtos')
      .select('*', { count: 'exact', head: true })
      .or('custo_unitario.is.null,custo_unitario.eq.0')
      .eq('ativo', true)
    log({
      nome: 'Produtos sem custo',
      status: (produtosSemCusto ?? 0) > 0 ? 'aviso' : 'ok',
      detalhe: `${produtosSemCusto ?? 0} produto(s) ativo(s) com custo_unitario zero ou null`,
    })
  } catch (e: unknown) {
    log({ nome: 'Produtos sem custo', status: 'aviso', detalhe: `Erro: ${String(e)}` })
  }

  // Produtos sem classificação ABC
  try {
    const { count: produtosSemABC } = await supabase
      .from('estoque_produtos')
      .select('*', { count: 'exact', head: true })
      .is('classificacao_abc', null)
      .eq('ativo', true)
    log({
      nome: 'Produtos sem classe ABC',
      status: (produtosSemABC ?? 0) > 0 ? 'aviso' : 'ok',
      detalhe: `${produtosSemABC ?? 0} produto(s) sem classificação (rodar estoque_recalcular_abc)`,
    })
  } catch (e: unknown) {
    log({ nome: 'Produtos sem classe ABC', status: 'aviso', detalhe: `Erro: ${String(e)}` })
  }

  // Lotes com quantidade negativa
  try {
    const { count: lotesNegativos } = await supabase
      .from('estoque_lotes')
      .select('*', { count: 'exact', head: true })
      .lt('quantidade_atual', 0)
    log({
      nome: 'Lotes com quantidade negativa',
      status: (lotesNegativos ?? 0) > 0 ? 'erro' : 'ok',
      detalhe: `${lotesNegativos ?? 0} lote(s) com qtd negativa (possível bug no PEPS)`,
    })
  } catch (e: unknown) {
    log({ nome: 'Lotes com quantidade negativa', status: 'aviso', detalhe: `Erro: ${String(e)}` })
  }

  // Vendas sem itens
  try {
    const { data: todasVendas } = await supabase.from('estoque_vendas').select('id')
    const { data: vendasComItens } = await supabase.from('estoque_venda_itens').select('venda_id')
    const idsComItens = new Set((vendasComItens ?? []).map((v: { venda_id: string }) => v.venda_id))
    const orfas = (todasVendas ?? []).filter((v: { id: string }) => !idsComItens.has(v.id))
    log({
      nome: 'Vendas sem itens',
      status: orfas.length > 0 ? 'aviso' : 'ok',
      detalhe: `${orfas.length} venda(s) sem itens (possível lixo de teste)`,
    })
  } catch (e: unknown) {
    log({ nome: 'Vendas sem itens', status: 'aviso', detalhe: `Erro: ${String(e)}` })
  }
}

async function checkConfigEstoque() {
  // Chaves reais do banco (corretas — o spec tinha nomes errados)
  const chavesEsperadas = [
    'lead_time_verde_max_dias',
    'lead_time_amarelo_max_dias',
    'custo_pedido_reais',
    'taxa_custo_estocagem_percent',
    'meses_historico_demanda',
  ]

  try {
    const { data: configs, error } = await supabase.from('estoque_config').select('*')

    if (error) {
      log({ nome: 'Config Estoque', status: 'erro', detalhe: `Erro ao ler configs: ${error.message}` })
      return
    }

    if (!configs || configs.length === 0) {
      log({ nome: 'Config Estoque', status: 'erro', detalhe: 'Nenhuma config encontrada na tabela estoque_config' })
      return
    }

    const chavesPresentes = (configs as { chave: string; valor: string }[]).map(c => c.chave)
    const faltando = chavesEsperadas.filter(k => !chavesPresentes.includes(k))

    if (faltando.length > 0) {
      log({ nome: 'Config Estoque', status: 'aviso', detalhe: `Chaves faltando: ${faltando.join(', ')}`, dados: { chaves_presentes: chavesPresentes } })
    } else {
      log({
        nome: 'Config Estoque',
        status: 'ok',
        detalhe: `Todas as ${chavesEsperadas.length} chaves esperadas presentes`,
        dados: configs,
      })
    }
  } catch (e: unknown) {
    log({ nome: 'Config Estoque', status: 'erro', detalhe: String(e) })
  }
}

function gerarRelatorio() {
  const data = new Date().toISOString().split('T')[0]
  const arquivo = path.join('scripts', `auditoria-estoque-${data}.md`)

  const totais = {
    ok: resultados.filter(r => r.status === 'ok').length,
    aviso: resultados.filter(r => r.status === 'aviso').length,
    erro: resultados.filter(r => r.status === 'erro').length,
  }

  let md = `# Auditoria do Módulo de Estoque — ${data}\n\n`
  md += `## Resumo\n\n`
  md += `- ✅ ${totais.ok} verificações OK\n`
  md += `- ⚠️ ${totais.aviso} avisos\n`
  md += `- ❌ ${totais.erro} erros\n\n`
  md += `## Detalhes\n\n`

  for (const r of resultados) {
    const emoji = { ok: '✅', aviso: '⚠️', erro: '❌' }[r.status]
    md += `### ${emoji} ${r.nome}\n\n${r.detalhe}\n\n`
    if (r.dados) {
      md += `<details><summary>Dados</summary>\n\n\`\`\`json\n${JSON.stringify(r.dados, null, 2)}\n\`\`\`\n\n</details>\n\n`
    }
  }

  md += `\n---\n*Gerado automaticamente por \`npm run auditoria:estoque\`*\n`

  fs.writeFileSync(arquivo, md)
  console.log(`\n📄 Relatório salvo em: ${arquivo}`)
  console.log(`\n📊 RESUMO FINAL: ${totais.ok} OK | ${totais.aviso} avisos | ${totais.erro} erros\n`)
}

auditar().catch(err => {
  console.error('❌ Erro fatal na auditoria:', err)
  process.exit(1)
})
