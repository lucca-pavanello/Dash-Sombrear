/**
 * Edge Function: relatorios-periodo
 *
 * Gera o resumo do período que o dash mostra em Relatórios. Substitui o
 * workflow n8n `Dash | Relatorios por periodo (IA)` (JpZHo2U2y3eY4cjj).
 *
 * Quem chama, depois da migração 0022:
 *   • pg_cron, uma vez por dia — pega semana/mês/ano fechados;
 *   • trigger em `relatorios_pedidos`, na hora — pedido do usuário no dash.
 *
 * O n8n rodava a cada 2 MINUTOS, 06h-23h, com `saveDataSuccessExecution: none`.
 * São ~510 execuções por dia, invisíveis no histórico por configuração, quase
 * todas para descobrir que não havia nada a fazer. O pedido manual não perde
 * nada com a troca: ganha, porque sai na hora em vez de esperar até 2 min.
 *
 * Toda a aritmética está em src/lib/relatorios/kpis.ts, testada contra o
 * Postgres. Aqui só entra I/O. O LLM escreve o texto por cima dos números e,
 * se falhar, o relatório sai mesmo assim com o texto de reserva.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { preflight, resposta } from '../_shared/resposta.ts'
import { segredoConfere } from '../_shared/automacao.ts'
import { pedirTexto } from '../_shared/muse.ts'
import {
  calcularKpis, decidirPeriodo, limparTextoLlm, montarPrompt, textoDeReserva,
  type LinhaCrm, type PedidoRelatorio, type RelatorioPronto, type VendaMinima,
} from '../../../src/lib/relatorios/kpis.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight()

  const body = await req.json().catch(() => null)
  if (!segredoConfere(body)) return resposta(401, { error: 'Não autorizado' })

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  try {
    const [{ data: pedidos }, { data: prontos }] = await Promise.all([
      db.from('relatorios_pedidos').select('id, periodo_inicio, periodo_fim, status'),
      db.from('relatorios_ia').select('tipo, periodo_inicio, periodo_fim'),
    ])

    const periodo = decidirPeriodo(
      (pedidos ?? []) as PedidoRelatorio[],
      (prontos ?? []) as RelatorioPronto[],
    )
    if (!periodo) return resposta(200, { ok: true, gerou: false, motivo: 'nada a gerar' })

    const [{ data: leads, error: erroLeads }, { data: vendas, error: erroVendas }] = await Promise.all([
      db.from('crm_sombrear_ia').select(
        'id, created_at, origem, lead_temperatura, status_lead, ultimo_valor_cotado, ' +
        'precisa_humano, avisado_fechamento_em, primeira_resposta_humana_em, ' +
        'desfecho, desfecho_em, desfecho_valor, objecoes',
      ),
      // venda e receita vêm daqui, não do CRM — ver o cabeçalho de kpis.ts
      db.from('orcamentos').select(
        'id, cliente, valor_cobrado, valor_venda, instalacao, fechado, data_pedido, created_at, pedido_id',
      ).eq('fechado', true),
    ])
    if (erroLeads) return resposta(500, { error: `leitura do CRM: ${erroLeads.message}` })
    if (erroVendas) return resposta(500, { error: `leitura de orçamentos: ${erroVendas.message}` })

    const kpis = calcularKpis(
      (leads ?? []) as LinhaCrm[],
      periodo,
      (vendas ?? []) as VendaMinima[],
    )

    const llm = await pedirTexto(montarPrompt(kpis))
    const texto = llm.ok ? limparTextoLlm(llm.texto) : ''
    if (!llm.ok) console.error('[relatorios-periodo] LLM falhou, usando reserva:', llm.erro)

    // Corrida: o cron diário e o trigger de pedido podem cair juntos. A checagem
    // de `decidirPeriodo` foi há alguns segundos — reconfere agora, já com o
    // texto pronto, antes de gravar duplicado.
    const { data: agora } = await db.from('relatorios_ia')
      .select('id').eq('tipo', periodo.tipo)
      .eq('periodo_inicio', periodo.inicio).eq('periodo_fim', periodo.fim).limit(1)
    if (agora && agora.length > 0) {
      return resposta(200, { ok: true, gerou: false, motivo: 'outra execução chegou antes' })
    }

    const { error: erroGravar } = await db.from('relatorios_ia').insert({
      tipo: periodo.tipo,
      periodo_inicio: periodo.inicio,
      periodo_fim: periodo.fim,
      texto: texto || textoDeReserva(kpis),
      kpis,
    })
    if (erroGravar) return resposta(500, { error: `gravação: ${erroGravar.message}` })

    // o pedido do usuário só vira 'pronto' depois que o relatório existe — se a
    // ordem fosse inversa, uma falha na gravação deixaria o dash esperando para
    // sempre um relatório que nunca foi escrito
    if (periodo.pedido_id) {
      await db.from('relatorios_pedidos').update({ status: 'pronto' }).eq('id', periodo.pedido_id)
    }

    return resposta(200, {
      ok: true,
      gerou: true,
      tipo: periodo.tipo,
      periodo: `${periodo.inicio} a ${periodo.fim}`,
      leads_novos: kpis.leads_novos,
      fechados: kpis.fechados,
      receita_fechada: kpis.receita_fechada,
      texto_do_llm: llm.ok,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('[relatorios-periodo]', message)
    return resposta(500, { error: message })
  }
})
