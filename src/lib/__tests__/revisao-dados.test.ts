/**
 * Revisão de dados de 30/09: Por canal, Agente IA e Análises contando igual.
 *
 * Cada caso é um número que a tela mostrava errado: venda do dia 1º no mês anterior,
 * conversão por canal acima de 100%, mês sem venda sumindo da tabela e lead contado
 * como convertido por uma compra de antes de ele chegar.
 */
import { describe, expect, it } from 'vitest'
import type { Orcamento } from '@/lib/supabase'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { mapaLeadsPorTelefone, acharLeadPorTelefone } from '@/hooks/useAgenteIA'
import { intervaloAtual } from '@/lib/periodos'
import { dataVenda } from '../analises/venda'
import { resumoDinheiro, receitaPorMes } from '../analises/dinheiro'
import { leadsQueCompraram, recebeuPreco } from '../analises/conversao'
import { linhasPorCanal, mesAMes, somarCanais } from '../relatorios/porCanal'
import { calcularKpis } from '../relatorios/kpis'
import { diaDaCasa, mesDaCasa, ultimosMeses } from '../fusoCasa'
import { lerTudo } from '../lerTudo'

const orc = (p: Partial<Orcamento>): Orcamento => ({
  id: Math.random().toString(36).slice(2),
  created_at: '2026-09-10T12:00:00Z',
  responsavel: 'Teste', modelo: 'Rolo', tecido: 'SCREEN', quantidade: 1, fechado: true,
  ...p,
} as Orcamento)

const lead = (p: Partial<CrmLead>): CrmLead => ({
  id: Math.random().toString(36).slice(2),
  created_at: '2026-09-10T12:00:00Z',
  status_lead: '2', ultimo_valor_cotado: null, whatsapp: null, identificador_usuario: null,
  origem: null,
  ...p,
} as CrmLead)

const agora = new Date('2026-09-20T15:00:00-03:00')

describe('data do pedido sem hora', () => {
  it('venda do dia 1º fica no mês dela, no fuso da loja', () => {
    const o = orc({ data_pedido: '2026-09-01', created_at: '2026-08-31T20:00:00Z' })
    expect(diaDaCasa(dataVenda(o))).toBe('2026-09-01')
    expect(mesDaCasa(dataVenda(o))).toBe('2026-09')
  })

  it('entra em "este mês" e não em "mês passado"', () => {
    const o = orc({ data_pedido: '2026-09-01', valor_venda: 1000 })
    expect(resumoDinheiro([o], intervaloAtual('mes', undefined, undefined, agora)).receita).toBe(1000)
    expect(resumoDinheiro([o], intervaloAtual('mes_passado', undefined, undefined, agora)).receita).toBe(0)
  })

  it('receita por mês põe a venda do dia 1º no mês certo', () => {
    const meses = receitaPorMes([orc({ data_pedido: '2026-09-01', valor_venda: 500 })], 2, agora)
    expect(meses.map((m) => [m.mes, m.receita])).toEqual([['2026-08', 0], ['2026-09', 500]])
  })

  it('o resumo da semana conta a venda do primeiro dia e não a do dia seguinte ao fim', () => {
    const k = calcularKpis([], { tipo: 'semanal', inicio: '2026-09-14', fim: '2026-09-20' }, [
      orc({ data_pedido: '2026-09-14', valor_venda: 100 }),
      orc({ data_pedido: '2026-09-21', valor_venda: 999 }),
    ])
    expect(k.receita_fechada).toBe(100)
    expect(k.fechados).toBe(1)
  })
})

describe('resumo semanal sem o histórico importado', () => {
  it('lead "historico" ou "Novo" não é lead novo', () => {
    const k = calcularKpis([
      { id: 'a', created_at: '2026-09-15T12:00:00Z', status_lead: 'historico' },
      { id: 'b', created_at: '2026-09-15T12:00:00Z', status_lead: 'Novo' },
      { id: 'c', created_at: '2026-09-15T12:00:00Z', status_lead: '2' },
    ] as never, { tipo: 'semanal', inicio: '2026-09-14', fim: '2026-09-20' }, [])
    expect(k.leads_novos).toBe(1)
  })
})

describe('cotado e convertido', () => {
  it('"0", "null" e vazio não são preço passado', () => {
    expect(['0', 'null', '', null, 'R$ 0,00'].map(recebeuPreco)).toEqual([false, false, false, false, false])
    expect(recebeuPreco('R$ 1.234,50')).toBe(true)
  })

  it('compra de antes do lead chegar não é conversão do atendimento', () => {
    const l = lead({ id: 'L', whatsapp: '5517997041997', created_at: '2026-09-10T12:00:00Z' })
    const mapa = mapaLeadsPorTelefone([l])
    const achar = (t: string | null | undefined) => acharLeadPorTelefone(mapa, t)
    expect(leadsQueCompraram([orc({ telefone: '17 99704-1997', data_pedido: '2026-09-05' })], achar).has('L')).toBe(false)
    expect(leadsQueCompraram([orc({ telefone: '17 99704-1997', data_pedido: '2026-09-10' })], achar).has('L')).toBe(true)
  })
})

describe('Por canal', () => {
  const canal = (x: { origem?: string | null }) => x.origem ?? 'sem'

  it('conta pedido, não item, e a conversão nunca passa de 100%', () => {
    const leads = [lead({ id: 'L1', origem: 'google' }), lead({ id: 'L2', origem: 'google' })]
    const vendas = [
      // um pedido de três itens do lead L1
      orc({ pedido_id: 'P1', origem: 'google', valor_venda: 100 }),
      orc({ pedido_id: 'P1', origem: 'google', valor_venda: 100 }),
      orc({ pedido_id: 'P1', origem: 'google', valor_venda: 100 }),
      // balcão marcado na mão como Google, de quem não é lead
      orc({ pedido_id: 'P2', origem: 'google', valor_venda: 50 }),
      orc({ pedido_id: 'P3', origem: 'google', valor_venda: 50 }),
    ]
    const [g] = linhasPorCanal({ leads, vendas, canalDoLead: canal, canalDaVenda: canal, compraram: new Set(['L1']) })
    expect(g.fechamentos).toBe(3)
    expect(g.faturamento).toBe(400)
    expect(g.ticket).toBeCloseTo(400 / 3)
    expect(g.conversao).toBe(50)
    expect(somarCanais([g]).conversao).toBe(50)
  })

  it('sem lead no período, conversão é "sem dado", não zero', () => {
    const [g] = linhasPorCanal({
      leads: [], vendas: [orc({ origem: 'google' })],
      canalDoLead: canal, canalDaVenda: canal, compraram: new Set(),
    })
    expect(g.conversao).toBeNull()
  })

  it('mês a mês mostra os 6 meses, com os vazios, pela data do pedido', () => {
    const m = mesAMes([
      orc({ data_pedido: '2026-09-01', origem: 'google', valor_venda: 10 }),
      orc({ data_pedido: '2026-05-10', origem: 'google', valor_venda: 20 }),
      orc({ data_pedido: '2025-12-10', origem: 'google', valor_venda: 99 }),
    ], canal, 6, agora)
    expect(m.meses).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    expect(m.valor('2026-09', 'google')).toEqual({ n: 1, total: 10 })
    expect(m.valor('2026-06', 'google')).toEqual({ n: 0, total: 0 })
  })
})

describe('meses e paginação', () => {
  it('ultimosMeses atravessa a virada do ano', () => {
    expect(ultimosMeses(3, new Date('2026-02-01T12:00:00-03:00'))).toEqual(['2025-12', '2026-01', '2026-02'])
  })

  it('lerTudo continua até a página vir incompleta', async () => {
    const linhas = Array.from({ length: 2500 }, (_, i) => i)
    const lidas = await lerTudo<number>(async (de, ate) => ({ data: linhas.slice(de, ate + 1), error: null }))
    expect(lidas).toHaveLength(2500)
  })
})
