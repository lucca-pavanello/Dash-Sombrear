/**
 * Relatório por período — o port do n8n conferido contra o que o n8n gravou.
 *
 * Estes não são casos inventados: a fixture são as linhas reais de
 * `crm_sombrear_ia`, e cada valor esperado foi conferido contra o Postgres,
 * rodando a mesma janela em SQL com os mesmos limites de -03:00. Duas
 * implementações independentes chegando no mesmo número é o que dá confiança
 * na aritmética de data, que é onde esse tipo de código erra.
 *
 * POR QUE NÃO USEI OS NÚMEROS QUE O n8n GRAVOU
 * A primeira versão deste teste exigia os KPIs salvos em `relatorios_ia`:
 * 109 leads em agosto e 60 na semana de 31/08. Deu 108 e 61. Fui conferir no
 * banco e o SQL concorda com o port, não com o relatório salvo — ou seja, o
 * dado mudou depois que o relatório foi gerado. Uma linha de agosto sumiu
 * (existe um workflow que apaga lead de teste) e uma entrou na semana.
 *
 * A consequência é maior que este teste: **relatório antigo da Sombrear não é
 * auditável**, porque `crm_sombrear_ia` é mutável e ninguém guarda o retrato
 * de quando o número foi calculado. O `kpis` em jsonb é o único registro.
 *
 * Se um destes quebrar, não "ajuste o teste": rode a mesma janela em SQL e
 * veja quem está certo.
 *
 * A fixture traz só as 13 colunas que o cálculo usa. Nome e telefone ficaram
 * de fora de propósito: não entram no cálculo e não precisam entrar no repo.
 *
 * Um dos valores conferidos é um ZERO ERRADO, e está aqui de propósito:
 * `fechados` e `receita_fechada` vêm de `desfecho*`, que quase não tem dado, e
 * o relatório afirma "0 vendas" em períodos nos quais a loja vendeu. O teste
 * trava a paridade com o n8n; o cabeçalho de `kpis.ts` explica por que a
 * correção é mudança própria e não veio junto com a migração.
 */
import { describe, expect, it } from 'vitest'
import {
  calcularKpis, decidirPeriodo, limparTextoLlm, montarPrompt, textoDeReserva,
  type LinhaCrm, type Periodo, type VendaMinima,
} from '../relatorios/kpis'
import crmFix from './fixtures/crm-relatorios.json'
import orcFix from './fixtures/orcamentos-relatorios.json'

const linhas = crmFix as unknown as LinhaCrm[]
/** nome do cliente trocado por placeholder na fixture; só 'QA_HARNESS' é literal */
const vendas = orcFix as unknown as VendaMinima[]
const semana = (inicio: string, fim: string): Periodo => ({ tipo: 'semanal', inicio, fim })

/*
 * Desde 30/09 `leads_novos` corta o histórico importado (status 'historico' e 'Novo'),
 * como as abas do dash já faziam. Os totais conferidos contra o Postgres continuam
 * valendo; o número novo é o total menos essas linhas, contadas na mesma fixture:
 * 14-20/09 27-3, 07-13/09 32-3, 31/08-06/09 61-14, agosto 108-46.
 */
describe('KPIs do relatório, conferidos contra o Postgres', () => {
  it('semana de 14 a 20/09 — 27 linhas, 24 leads novos sem o histórico', () => {
    expect(calcularKpis(linhas, semana('2026-09-14', '2026-09-20')).leads_novos).toBe(24)
  })

  it('semana de 07 a 13/09 — 32 linhas, 29 leads novos', () => {
    expect(calcularKpis(linhas, semana('2026-09-07', '2026-09-13')).leads_novos).toBe(29)
  })

  it('semana de 31/08 a 06/09 — 61 linhas, 47 leads novos e SLA médio de 27,1h', () => {
    // o relatório salvo diz 60; o SQL de hoje diz 61 (ver cabeçalho)
    const k = calcularKpis(linhas, semana('2026-08-31', '2026-09-06'))
    expect(k.leads_novos).toBe(47)
    expect(k.sla_medio_horas).toBe(27.1)
  })

  it('agosto inteiro — 108 linhas, 62 leads novos sem o histórico', () => {
    // o relatório salvo diz 109; o SQL de hoje diz 108 (ver cabeçalho)
    const k = calcularKpis(linhas, { tipo: 'mensal', inicio: '2026-08-01', fim: '2026-08-31' })
    expect(k.leads_novos).toBe(62)
  })

  it('agosto — 13 pedidos e R$ 49.378,95, o que a loja realmente vendeu', () => {
    // Este é o número que o relatório vinha errando: dizia 0 vendas e R$ 0
    // porque lia `desfecho_valor` do CRM. Conferido contra o mesmo SELECT em
    // SQL, com os mesmos limites de -03:00.
    const k = calcularKpis(linhas, { tipo: 'mensal', inicio: '2026-08-01', fim: '2026-08-31' }, vendas)
    expect(k.fechados).toBe(13)
    expect(k.receita_fechada).toBe(49378.95)
  })

  it('semana de 14 a 20/09 — 4 pedidos e R$ 15.071,00', () => {
    const k = calcularKpis(linhas, semana('2026-09-14', '2026-09-20'), vendas)
    expect(k.fechados).toBe(4)
    expect(k.receita_fechada).toBe(15071)
  })

  it('sem orçamentos, venda e receita ficam em zero — não inventa', () => {
    const k = calcularKpis(linhas, { tipo: 'mensal', inicio: '2026-08-01', fim: '2026-08-31' })
    expect(k.fechados).toBe(0)
    expect(k.receita_fechada).toBe(0)
  })

  it('itens do mesmo pedido contam como uma venda só', () => {
    const doisItens: VendaMinima[] = [
      { id: 'a', pedido_id: 'p1', fechado: true, valor_venda: 100, created_at: '2026-09-02T12:00:00Z' },
      { id: 'b', pedido_id: 'p1', fechado: true, valor_venda: 50, created_at: '2026-09-02T12:00:00Z' },
    ]
    const k = calcularKpis([], semana('2026-09-01', '2026-09-07'), doisItens)
    expect(k.fechados).toBe(1)
    expect(k.receita_fechada).toBe(150)
  })

  it('linha do harness de QA não entra na receita', () => {
    const comTeste: VendaMinima[] = [
      { id: 'a', cliente: 'Fulano', fechado: true, valor_venda: 100, created_at: '2026-09-02T12:00:00Z' },
      { id: 'b', cliente: 'QA_HARNESS', fechado: true, valor_venda: 999, created_at: '2026-09-02T12:00:00Z' },
    ]
    const k = calcularKpis([], semana('2026-09-01', '2026-09-07'), comTeste)
    expect(k.fechados).toBe(1)
    expect(k.receita_fechada).toBe(100)
  })

  it('valor_cobrado manda sobre valor_venda + instalação', () => {
    const comDesconto: VendaMinima[] = [
      { id: 'a', fechado: true, valor_venda: 1000, instalacao: 200, valor_cobrado: 900, created_at: '2026-09-02T12:00:00Z' },
    ]
    expect(calcularKpis([], semana('2026-09-01', '2026-09-07'), comDesconto).receita_fechada).toBe(900)
  })

  it('o SLA descarta janela negativa e maior que 14 dias', () => {
    const sujas: LinhaCrm[] = [
      { id: 'a', avisado_fechamento_em: '2026-09-02T10:00:00Z', primeira_resposta_humana_em: '2026-09-02T08:00:00Z' },
      { id: 'b', avisado_fechamento_em: '2026-09-02T10:00:00Z', primeira_resposta_humana_em: '2026-10-30T10:00:00Z' },
      { id: 'c', avisado_fechamento_em: '2026-09-02T10:00:00Z', primeira_resposta_humana_em: '2026-09-02T12:00:00Z' },
    ]
    expect(calcularKpis(sujas, semana('2026-09-01', '2026-09-07')).sla_medio_horas).toBe(2)
  })
})

describe('qual período gerar', () => {
  // quarta-feira, 2026-09-23
  const quarta = new Date(2026, 8, 23, 10, 0, 0)

  it('pedido pendente do usuário passa na frente de tudo', () => {
    const p = decidirPeriodo(
      [{ id: 'p1', periodo_inicio: '2026-09-01', periodo_fim: '2026-09-05', status: 'pendente' }],
      [],
      quarta,
    )
    expect(p).toEqual({ tipo: 'custom', inicio: '2026-09-01', fim: '2026-09-05', pedido_id: 'p1' })
  })

  it('pedido já pronto não conta como pendente', () => {
    const p = decidirPeriodo(
      [{ id: 'p1', periodo_inicio: '2026-09-01', periodo_fim: '2026-09-05', status: 'pronto' }],
      [],
      quarta,
    )
    expect(p?.tipo).toBe('semanal')
  })

  it('sem pedido, pega a última semana completa (segunda a domingo)', () => {
    expect(decidirPeriodo([], [], quarta)).toEqual({
      tipo: 'semanal', inicio: '2026-09-14', fim: '2026-09-20',
    })
  })

  it('semana já feita desce para o mês', () => {
    const p = decidirPeriodo([], [{ tipo: 'semanal', periodo_inicio: '2026-09-14', periodo_fim: '2026-09-20' }], quarta)
    expect(p).toEqual({ tipo: 'mensal', inicio: '2026-08-01', fim: '2026-08-31' })
  })

  it('semana e mês feitos, e o ano anterior é antes da coleta — nada a gerar', () => {
    const p = decidirPeriodo(
      [],
      [
        { tipo: 'semanal', periodo_inicio: '2026-09-14', periodo_fim: '2026-09-20' },
        { tipo: 'mensal', periodo_inicio: '2026-08-01', periodo_fim: '2026-08-31' },
      ],
      quarta,
    )
    // 2025 termina antes de DATA_INICIO (2026-08-10), então o anual não entra
    expect(p).toBeNull()
  })

  it('período que termina antes da coleta é pulado', () => {
    // primeira segunda depois do início da coleta: a semana anterior é anterior a ele
    const cedo = new Date(2026, 7, 12, 10, 0, 0) // 12/08/2026, quarta
    const p = decidirPeriodo([], [], cedo)
    expect(p?.tipo).not.toBe('semanal')
  })
})

describe('texto do LLM', () => {
  it('tira aspas em volta', () => {
    expect(limparTextoLlm('"foi uma boa semana"')).toBe('foi uma boa semana')
  })

  it('desembrulha a resposta que veio como JSON (aconteceu em 27/08)', () => {
    expect(limparTextoLlm('{"resumo": "27 leads novos"}')).toBe('27 leads novos')
  })

  it('troca \\n literal por quebra de verdade', () => {
    expect(limparTextoLlm('linha um\\nlinha dois')).toBe('linha um\nlinha dois')
  })

  it('JSON malformado não quebra — devolve o texto como veio', () => {
    expect(limparTextoLlm('{isto nao e json}')).toBe('{isto nao e json}')
  })

  it('o texto de reserva sai mesmo sem LLM', () => {
    const k = calcularKpis(linhas, semana('2026-09-14', '2026-09-20'))
    const t = textoDeReserva(k)
    expect(t).toContain('24 leads novos')
    expect(t.split('\n').length).toBeGreaterThanOrEqual(3)
  })

  it('o prompt carrega os números e proíbe inventar', () => {
    const k = calcularKpis(linhas, semana('2026-09-14', '2026-09-20'))
    const p = montarPrompt(k)
    expect(p).toContain('REGRA ABSOLUTA')
    expect(p).toContain('"leads_novos":24')
  })
})
