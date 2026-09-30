/**
 * Ferramentas do copilot: os números que a IA recebe têm de ser os mesmos das telas.
 * Cada caso aqui é uma pergunta que o copilot antigo não sabia responder ou respondia
 * com a conta errada (margem com as linhas da calculadora, item contado como venda).
 */
import { describe, expect, it } from 'vitest'
import {
  calcular, compararPeriodos, leadsParados, leadsQuentes, numerosDoPeriodo, porCanal,
  porModelo, rodarFerramenta, serieMensal, verLead, type LeadCopilot, type VendaCopilot,
} from '../copilot/ferramentas'
import { FERRAMENTAS } from '../copilot/prompt'

const venda = (p: Partial<VendaCopilot>): VendaCopilot => ({
  id: Math.random().toString(36).slice(2), created_at: '2026-09-10T12:00:00Z', fechado: true, ...p,
})
const lead = (p: Partial<LeadCopilot>): LeadCopilot => ({
  id: Math.random().toString(36).slice(2), created_at: '2026-09-01T12:00:00Z', status_lead: '3', ...p,
})
const HOJE = '2026-09-20'
const setembro = { inicio: '2026-09-01', fim: '2026-09-30' }

describe('números do período', () => {
  it('pedido é um só com vários itens, e a calculadora não entra', () => {
    const n = numerosDoPeriodo([
      venda({ pedido_id: 'P', valor_venda: 100, margem: 40, data_pedido: '2026-09-01' }),
      venda({ pedido_id: 'P', valor_venda: 300, margem: 20, data_pedido: '2026-09-01' }),
      venda({ fechado: false, valor_venda: 9999, margem: -1851 }),
      venda({ cliente: 'QA_HARNESS', valor_venda: 5000 }),
    ], setembro, HOJE)
    expect(n.pedidos).toBe(1)
    expect(n.itens).toBe(2)
    expect(n.receita).toBe(400)
    expect(n.ticket_por_pedido).toBe(400)
    // ponderada pela receita: (40*100 + 20*300) / 400
    expect(n.margem_media_pct).toBe(25)
    expect(n.aviso).toBe('período ainda em andamento')
  })

  it('venda do dia 1º é do mês dela', () => {
    expect(numerosDoPeriodo([venda({ data_pedido: '2026-09-01', valor_venda: 10 })],
      { inicio: '2026-08-01', fim: '2026-08-31' }, HOJE).receita).toBe(0)
  })

  it('sem margem informada, margem é null e não zero', () => {
    expect(numerosDoPeriodo([venda({ valor_venda: 10 })], setembro, HOJE).margem_media_pct).toBeNull()
  })
})

describe('comparar períodos', () => {
  it('mês em andamento corta o anterior no mesmo trecho', () => {
    const r = compararPeriodos([
      venda({ data_pedido: '2026-09-05', valor_venda: 200 }),
      venda({ data_pedido: '2026-08-05', valor_venda: 100 }),
      venda({ data_pedido: '2026-08-25', valor_venda: 900 }),
    ], setembro, { inicio: '2026-08-01', fim: '2026-08-31' }, HOJE)
    expect(r.anterior.periodo.fim).toBe('2026-08-20')
    expect(r.anterior.receita).toBe(100)
    expect(r.variacao_pct.receita).toBe(100)
    expect(r.aviso).toMatch(/cortado/)
  })
})

describe('série, modelo e canal', () => {
  it('série mensal traz os meses zerados', () => {
    const s = serieMensal([venda({ data_pedido: '2026-09-02', valor_venda: 5 })], 3, HOJE)
    expect(s.map((m) => [m.mes, m.receita])).toEqual([['2026-07', 0], ['2026-08', 0], ['2026-09', 5]])
  })

  it('modelo mais vendido pela receita', () => {
    const m = porModelo([
      venda({ modelo: 'Rolo', valor_venda: 100 }),
      venda({ modelo: 'Romana', valor_venda: 300 }),
    ], setembro)
    expect(m[0].modelo).toBe('Romana')
  })

  it('canal: conversão é lead que comprou ÷ lead, e balcão do canal entra só na receita', () => {
    const l1 = lead({ origem: 'google', whatsapp: '5517997041997' })
    const l2 = lead({ origem: 'google' })
    const r = porCanal([
      venda({ telefone: '(17) 99704-1997', valor_venda: 100, data_pedido: '2026-09-05' }),
      venda({ origem: 'google', valor_venda: 50 }),
      venda({ origem: 'google', valor_venda: 50 }),
    ], [l1, l2], setembro)
    const g = r.find((x) => x.canal === 'google')!
    expect(g.leads).toBe(2)
    expect(g.leads_que_compraram).toBe(1)
    expect(g.conversao_pct).toBe(50)
    expect(g.pedidos).toBe(3)
    expect(g.receita).toBe(200)
  })
})

describe('leads', () => {
  const quente = lead({ nome: 'Ana', lead_temperatura: 'QUENTE', lead_score: 90, whatsapp: '5517900000001', ultimo_valor_cotado: 'R$ 2.000', timestamp_ultima_msg: '2026-09-02T12:00:00Z' })
  const comprou = lead({ nome: 'Bia', lead_temperatura: 'QUENTE', lead_score: 99, whatsapp: '5517900000002' })
  const historico = lead({ nome: 'Caio', lead_temperatura: 'QUENTE', status_lead: 'historico' })
  const vendas = [venda({ telefone: '17900000002', data_pedido: '2026-09-15' })]

  it('quentes: sem quem já comprou e sem histórico, e sem telefone na saída', () => {
    const r = leadsQuentes([quente, comprou, historico], vendas, 10, HOJE)
    expect(r.leads.map((l) => l.nome)).toEqual(['Ana'])
    expect(JSON.stringify(r)).not.toContain('5517900000001')
  })

  it('parados: recebeu preço e está sem mensagem há 7+ dias', () => {
    const r = leadsParados([quente, comprou], vendas, 7, 10, HOJE)
    expect(r.leads.map((l) => [l.nome, l.dias_sem_mensagem])).toEqual([['Ana', 18]])
  })

  it('ver lead acha por nome e não devolve telefone', () => {
    const r = verLead([quente], [], 'an', HOJE)
    expect(r.achados).toBe(1)
    expect(JSON.stringify(r)).not.toContain('5517900000001')
  })
})

describe('calcular e despacho', () => {
  it('faz a conta e recusa o que não é conta', () => {
    expect(calcular('(15071 - 12000) / 12000 * 100')).toEqual({ resultado: 25.5917 })
    expect(calcular('1,5 * 2')).toEqual({ resultado: 3 })
    expect(calcular('process.exit()')).toEqual({ erro: 'expressão inválida' })
  })

  it('argumento inválido vira erro legível', () => {
    expect(rodarFerramenta('numeros_do_periodo', { periodo: { inicio: 'ontem' } }, { orcamentos: [], leads: [] }, HOJE))
      .toHaveProperty('erro')
    expect(rodarFerramenta('apagar_tudo', {}, { orcamentos: [], leads: [] }, HOJE)).toHaveProperty('erro')
  })

  it('toda ferramenta declarada tem implementação', () => {
    for (const f of FERRAMENTAS) {
      const r = rodarFerramenta(f.name, {}, { orcamentos: [], leads: [] }, HOJE) as { erro?: string }
      expect(r?.erro ?? '').not.toMatch(/desconhecida/)
    }
  })
})
