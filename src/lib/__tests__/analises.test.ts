/**
 * As regras de contagem da aba Análise.
 *
 * Cada caso aqui existe porque a conta errada já aconteceu ou estava prestes a
 * acontecer nesta tela: receita que ignorava `valor_cobrado` e não batia com a aba
 * irmã, ticket dividido por item em vez de pedido, percentual sobre amostra de 9,
 * e a comparação de um mês pela metade contra um mês inteiro.
 */
import { describe, expect, it } from 'vitest'
import type { Orcamento } from '@/lib/supabase'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import { periodoAnterior, rotuloAnterior, intervaloAtual } from '@/lib/periodos'
import { receita, pctOuNulo, proporcao, MIN_PARA_PCT } from '../analises/base'
import { baseObjecoes, rankearObjecoes, coberturaIA } from '../analises/objecoes'
import { resumoDinheiro } from '../analises/dinheiro'
import { calcularFunil } from '../analises/funil'
import { demandaVsReceita } from '../analises/demanda'
import { analiseDeCanal, destaqueDeCanal } from '../analises/canal'

const orc = (p: Partial<Orcamento>): Orcamento => ({
  id: Math.random().toString(36).slice(2),
  created_at: '2026-09-10T12:00:00Z',
  responsavel: 'Teste',
  modelo: 'Rolo',
  tecido: 'SCREEN',
  quantidade: 1,
  fechado: true,
  ...p,
})

const lead = (p: Partial<CrmLead>): CrmLead => ({
  id: Math.random().toString(36).slice(2),
  created_at: '2026-09-10T12:00:00Z',
  identificador_usuario: null, whatsapp: null, nome: null, inicio_atendimento: null,
  status_lead: '2', resumo_conversa: null, ultimo_valor_cotado: null, endereco_cep: null,
  data_medicao_instalacao: null, timestamp_ultima_msg: null, id_conta_chatwoot: null,
  id_conversa_chatwoot: null, id_lead_chatwoot: null, inbox_id_chatwoot: null,
  modelo_interesse: null, ambiente: null, medidas_coletadas: null, quantidade: null,
  tecido_cor: null, acabamento_desejado: null, precisa_instalacao: null, cidade: null,
  tipo_imovel: null, orcamento_aceito: null, classificacao_ia: null,
  classificacao_motivo: null, classificacao_temperatura: null, classificacao_em: null,
  lead_score: null, lead_temperatura: null, lead_motivo: null, objecoes: null,
  gatilhos: null, objecao_tags: null, objecao_outro: null, produto_familia: null,
  sensibilidade_preco: null, status_motivo: null, origem: null, origem_bruta: null,
  origem_campanha: null, chatwoot_labels: null, precisa_humano: null, desfecho: null,
  desfecho_motivo: null, desfecho_valor: null, desfecho_em: null, atendente: null,
  primeira_resposta_humana_em: null,
  ...p,
})

describe('receita — uma definição só para as duas abas de Relatórios', () => {
  it('o que o cliente pagou de verdade manda sobre o preço de tabela', () => {
    expect(receita(orc({ valor_venda: 1000, instalacao: 200, valor_cobrado: 900 }))).toBe(900)
  })

  it('sem valor cobrado, soma produto e instalação', () => {
    expect(receita(orc({ valor_venda: 1000, instalacao: 200 }))).toBe(1200)
  })

  it('valor cobrado zero é um desconto total, não ausência de dado', () => {
    expect(receita(orc({ valor_venda: 1000, valor_cobrado: 0 }))).toBe(0)
  })
})

describe('ticket médio é por pedido, não por item', () => {
  it('três itens do mesmo pedido contam como um pedido só', () => {
    const r = resumoDinheiro([
      orc({ pedido_id: 'p1', valor_venda: 1000 }),
      orc({ pedido_id: 'p1', valor_venda: 1000 }),
      orc({ pedido_id: 'p1', valor_venda: 1000 }),
    ], null)
    expect(r.itens).toBe(3)
    expect(r.pedidos).toBe(1)
    expect(r.ticketPorPedido).toBe(3000)   // e não 1000, que é o ticket por item
  })

  it('item sem pedido vinculado é o próprio pedido', () => {
    const r = resumoDinheiro([
      orc({ pedido_id: 'p1', valor_venda: 500 }),
      orc({ pedido_id: 'p1', valor_venda: 500 }),
      orc({ valor_venda: 2000 }),
    ], null)
    expect(r.pedidos).toBe(2)
    expect(r.ticketPorPedido).toBe(1500)
  })

  it('cotação não entra na receita — só no contador de cotações', () => {
    const r = resumoDinheiro([orc({ valor_venda: 800 }), orc({ fechado: false, valor_venda: 9999 })], null)
    expect(r.receita).toBe(800)
    expect(r.cotacoes).toBe(1)
  })
})

describe('amostra pequena não vira porcentagem', () => {
  it('abaixo do piso o percentual é nulo', () => {
    expect(MIN_PARA_PCT).toBe(20)
    expect(pctOuNulo(4, 11)).toBeNull()
    expect(proporcao(4, 11)).toBe('4 de 11')
  })

  it('a partir do piso, vira percentual', () => {
    expect(pctOuNulo(5, 20)).toBe(25)
    expect(proporcao(5, 20)).toBe('25%')
  })
})

describe('objeções — multi-rótulo, denominador é a conversa', () => {
  const leads = [
    lead({ classificacao_ia: 'negociacao', objecao_tags: ['prazo_entrega', 'preco_alto'] }),
    lead({ classificacao_ia: 'perdida', objecao_tags: ['prazo_entrega'] }),
    lead({ classificacao_ia: 'venda', objecao_tags: [] }),
    lead({ classificacao_ia: 'sem_interesse', objecao_tags: ['prazo_entrega'] }),
    lead({ classificacao_ia: null, objecao_tags: null }),
  ]

  it('conta conversa analisada, não etiqueta: 2 objeções numa conversa não viram 2 conversas', () => {
    const base = baseObjecoes(leads, null, null)
    expect(base.analisadas).toHaveLength(3)   // as duas com tag + a de array vazio
    expect(base.naoCliente).toHaveLength(1)
    const linhas = rankearObjecoes(base)
    expect(linhas[0].objecao.id).toBe('prazo_entrega')
    expect(linhas[0].n).toBe(2)               // a do `sem_interesse` ficou de fora
  })

  it('array vazio é "li e não havia objeção" — entra na base, não no ranking', () => {
    const base = baseObjecoes([lead({ classificacao_ia: 'venda', objecao_tags: [] })], null, null)
    expect(base.analisadas).toHaveLength(1)
    expect(rankearObjecoes(base)).toHaveLength(0)
  })

  it('as porcentagens não somam 100, porque a conversa pode ter várias objeções', () => {
    const muitas = Array.from({ length: 20 }, () =>
      lead({ classificacao_ia: 'negociacao', objecao_tags: ['prazo_entrega', 'preco_alto'] }))
    const linhas = rankearObjecoes(baseObjecoes(muitas, null, null))
    expect(linhas.reduce((s, l) => s + (l.pct ?? 0), 0)).toBe(200)
  })

  it('lead histórico NÃO é descartado aqui — o corte vale pro funil, não pra objeção', () => {
    const base = baseObjecoes([
      lead({ status_lead: 'historico', classificacao_ia: 'negociacao', objecao_tags: ['adiou'] }),
      lead({ status_lead: 'Novo', classificacao_ia: 'negociacao', objecao_tags: ['adiou'] }),
    ], null, null)
    expect(rankearObjecoes(base)[0].n).toBe(2)
  })
})

describe('cobertura da IA — o silêncio não pode passar por "não houve objeção"', () => {
  it('conta o que falta ler e há quantos dias a leitura parou', () => {
    const leads = [
      lead({ classificacao_ia: 'venda', objecao_tags: [], classificacao_em: '2026-09-07T10:00:00Z' }),
      lead({ classificacao_ia: null, objecao_tags: null }),
      lead({ classificacao_ia: null, objecao_tags: null }),
    ]
    const c = coberturaIA(leads, baseObjecoes(leads, null, null), new Date('2026-09-22T10:00:00Z'))
    expect(c.conversas).toBe(3)
    expect(c.analisadas).toBe(1)
    expect(c.pendentes).toBe(2)
    expect(c.diasParado).toBe(15)
  })
})

describe('funil — venda de balcão pode passar o meio sem quebrar a barra', () => {
  const soDigitos = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '')

  it('exclui lead histórico do topo', () => {
    const f = calcularFunil(
      [lead({}), lead({ status_lead: 'historico' })],
      [], null, new Map(), soDigitos,
    )
    expect(f.etapas[0].valor).toBe(1)
  })

  it('só conta como orçada a conversa em que a Amanda passou preço', () => {
    const f = calcularFunil(
      [lead({ ultimo_valor_cotado: 'R$ 1.250,00' }), lead({ ultimo_valor_cotado: '0' }), lead({})],
      [], null, new Map(), soDigitos,
    )
    expect(f.etapas[1].valor).toBe(1)
  })

  it('mais vendas que orçamentos não estoura a barra — a base é a maior etapa', () => {
    const f = calcularFunil([lead({})], [orc({}), orc({}), orc({})], null, new Map(), soDigitos)
    expect(f.etapas[2].valor).toBe(3)
    expect(Math.max(...f.etapas.map((e) => e.fatia))).toBe(1)
    expect(f.etapas.every((e) => e.fatia <= 1)).toBe(true)
  })

  it('mede quantas vendas com telefone dá pra atribuir a uma conversa', () => {
    const mapa = new Map([['1799990000', lead({})]])
    const noveDigitos = (v: string | null | undefined) => {
      let d = String(v ?? '').replace(/\D/g, '')
      if (d.length === 11) d = d.slice(0, 2) + d.slice(3)
      return d
    }
    const f = calcularFunil([], [
      orc({ telefone: '(17) 99999-0000' }),
      orc({ telefone: '(17) 98888-1111' }),
      orc({ telefone: null }),
    ], null, mapa, noveDigitos)
    expect(f.vendasComTelefone).toBe(2)
    expect(f.vendasCasadas).toBe(1)
  })
})

describe('demanda × receita — escala compartilhada, nunca dois eixos', () => {
  it('lê o vocabulário dos dois lados com a mesma função', () => {
    const { linhas } = demandaVsReceita(
      [lead({ produto_familia: 'cortina' }), lead({ produto_familia: 'cortina' }), lead({ produto_familia: 'rolo' })],
      [orc({ modelo: 'PH_Aluminio', valor_venda: 1000 }), orc({ modelo: 'Rolo Motorizado', valor_venda: 3000 })],
      null,
    )
    const cortina = linhas.find((l) => l.id === 'cortina')!
    expect(cortina.pctDemanda).toBeCloseTo(66.67, 1)
    expect(cortina.pctReceita).toBe(0)          // o achado: puxa conversa e não fatura
    expect(linhas.find((l) => l.id === 'horizontal')!.pctReceita).toBe(25)
    expect(linhas.find((l) => l.id === 'rolo_motorizado')!.pctReceita).toBe(75)
  })

  it('não identificado fica no fim — é ausência de dado, não família', () => {
    const { linhas } = demandaVsReceita(
      [lead({}), lead({}), lead({}), lead({ produto_familia: 'rolo' })], [], null,
    )
    expect(linhas[linhas.length - 1].id).toBe('sem_produto')
  })
})

describe('canal — a medida que sobrevive à falta de rastro até a venda', () => {
  it('string vazia não é canal', () => {
    const c = analiseDeCanal(
      [lead({ origem: 'google' }), lead({ origem: '' }), lead({ origem: null }), lead({ origem: '  ' })],
      [], null, () => undefined,
    )
    expect(c.identificados).toBe(1)
    expect(c.total).toBe(4)
    expect(c.pctCobertura).toBe(25)
  })

  it('taxa de orçamento é cotados sobre quem chegou pelo canal', () => {
    const c = analiseDeCanal([
      lead({ origem: 'google', ultimo_valor_cotado: 'R$ 1.200,00' }),
      lead({ origem: 'google', ultimo_valor_cotado: '0' }),
      lead({ origem: 'google' }),
      lead({ origem: 'google' }),
    ], [], null, () => undefined)
    expect(c.linhas[0].cotados).toBe(1)
    expect(c.linhas[0].taxaOrcamento).toBe(25)
  })

  it('quem chegou sem canal vira régua visível, não desaparece', () => {
    const c = analiseDeCanal([
      lead({ origem: 'google', ultimo_valor_cotado: '900' }),
      lead({ origem: null }),
      lead({ origem: null }),
    ], [], null, () => undefined)
    expect(c.semCanal.leads).toBe(2)
    expect(c.semCanal.taxaOrcamento).toBe(0)
  })

  it('itens do mesmo pedido contam como um pedido só no canal', () => {
    const origem = lead({ origem: 'google' })
    const c = analiseDeCanal([origem], [
      orc({ telefone: '17999990000', pedido_id: 'p1', valor_venda: 500 }),
      orc({ telefone: '17999990000', pedido_id: 'p1', valor_venda: 500 }),
    ], null, () => origem)
    expect(c.linhas[0].pedidos).toBe(1)
    expect(c.linhas[0].receita).toBe(1000)
    expect(c.vendasAtribuidas).toBe(1)
  })

  it('venda sem canal no orçamento herda o canal do lead pelo telefone', () => {
    const origem = lead({ origem: 'google' })
    const c = analiseDeCanal([origem], [orc({ telefone: '17999990000', valor_venda: 1500 })], null, () => origem)
    expect(c.linhas.find((l) => l.id === 'google')!.receita).toBe(1500)
    expect(c.receitaAtribuida).toBe(1500)
  })

  it('venda que não acha canal nenhum cai na régua e não some da receita total', () => {
    const c = analiseDeCanal([], [orc({ telefone: null, valor_venda: 800 })], null, () => undefined)
    expect(c.receitaTotal).toBe(800)
    expect(c.receitaAtribuida).toBe(0)
    expect(c.semCanal.receita).toBe(800)
  })

  it('o destaque compara o melhor canal com quem chegou sem marcação', () => {
    const leads = [
      ...Array.from({ length: 6 }, (_, i) =>
        lead({ origem: 'google', ultimo_valor_cotado: i < 3 ? '1000' : null })),   // 50%
      ...Array.from({ length: 10 }, (_, i) =>
        lead({ origem: null, ultimo_valor_cotado: i < 1 ? '1000' : null })),       // 10%
    ]
    const d = destaqueDeCanal(analiseDeCanal(leads, [], null, () => undefined))!
    expect(d.linha.id).toBe('google')
    expect(d.vezes).toBeCloseTo(5, 5)
  })

  it('canal com menos de 5 conversas não vira destaque — amostra não aguenta', () => {
    const leads = [
      lead({ origem: 'indicacao', ultimo_valor_cotado: '1000' }),
      ...Array.from({ length: 10 }, () => lead({ origem: null, ultimo_valor_cotado: '1000' })),
    ]
    expect(destaqueDeCanal(analiseDeCanal(leads, [], null, () => undefined))).toBeNull()
  })
})

describe('período — os dois buracos que faziam a aba mentir em silêncio', () => {
  const itens = [
    { d: '2026-09-15T12:00:00Z' },   // mês corrente
    { d: '2026-08-15T12:00:00Z' },   // mês passado
    { d: '2026-01-15T12:00:00Z' },   // fora dos 90 dias
  ]
  const data = (i: { d: string }) => i.d

  it('"mês passado" filtrava NADA — caía no return true e mostrava tudo', () => {
    const agora = new Date()
    const mesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 15, 12)
    const r = filterByPeriod(
      [{ d: mesPassado.toISOString() }, { d: agora.toISOString() }],
      'mes_passado', data,
    )
    expect(r).toHaveLength(1)
    expect(r[0].d).toBe(mesPassado.toISOString())
  })

  it('"90 dias" também', () => {
    expect(filterByPeriod(itens, '90d', data).length).toBeLessThan(itens.length)
  })

  it('data personalizada é lida como local, não UTC — senão inclui o dia anterior', () => {
    // 21h do dia 31/08 no Brasil é 00h de 01/09 em UTC
    const r = filterByPeriod(
      [{ d: '2026-09-01T00:30:00-03:00' }, { d: '2026-08-31T21:00:00-03:00' }],
      'custom', data, '2026-09-01', '2026-09-30',
    )
    expect(r).toHaveLength(1)
  })
})

describe('comparação pro-rata — 22 dias contra 31 seria "-68%" de mentira', () => {
  const agora = new Date(2026, 8, 22, 15, 0, 0)   // 22/09/2026

  it('sem pro-rata, o anterior é o mês civil inteiro', () => {
    const p = periodoAnterior('mes', undefined, undefined, agora)!
    expect(p.fim.getDate()).toBe(31)
  })

  it('com pro-rata, agosto é cortado no mesmo dia 22', () => {
    const p = periodoAnterior('mes', undefined, undefined, agora, true)!
    expect(p.inicio.getMonth()).toBe(7)
    expect(p.fim.getMonth()).toBe(7)
    expect(p.fim.getDate()).toBe(22)
  })

  it('dia que não existe no mês anterior cai no último dia dele', () => {
    const trintaEUmDeMarco = new Date(2026, 2, 31, 15, 0, 0)
    const p = periodoAnterior('mes', undefined, undefined, trintaEUmDeMarco, true)!
    expect(p.fim.getMonth()).toBe(1)
    expect(p.fim.getDate()).toBe(28)
  })

  it('o rótulo avisa que a comparação é com um trecho', () => {
    expect(rotuloAnterior('mes', true)).toBe('vs mesmo trecho do mês anterior')
    expect(rotuloAnterior('mes')).toBe('vs mês anterior')
  })

  it('"mês passado" e "90 dias" ganham intervalo próprio', () => {
    expect(intervaloAtual('mes_passado', undefined, undefined, agora)!.inicio.getMonth()).toBe(7)
    expect(intervaloAtual('90d', undefined, undefined, agora)).not.toBeNull()
  })
})
