import { describe, expect, it } from 'vitest'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { calcularFunilIaEquipe, type Atendimento } from '../analises/funilIaEquipe'

const lead = (id: string, p: Partial<CrmLead> = {}) => ({ id, data_medicao_instalacao: null, medicao_equipe: null, ...p }) as CrmLead

const base = (leads: CrmLead[], extra: Partial<Parameters<typeof calcularFunilIaEquipe>[0]> = {}) =>
  calcularFunilIaEquipe({
    leads, atendimento: new Map<string, Atendimento>(), orcamentosChat: [], idsConvertidos: new Set(),
    cotouForaDoChat: () => false, ...extra,
  })

describe('calcularFunilIaEquipe', () => {
  it('lista vazia dá tudo zero', () => {
    const f = base([])
    expect(f.conversas).toBe(0)
    expect(f.etapas.map(e => [e.ia, e.equipe])).toEqual([[0, 0], [0, 0], [0, 0]])
    expect(f.convertidos).toEqual({ total: 0, ia: 0, equipe: 0, nosDois: 0, semOrcamento: 0 })
  })

  it('conta cada lado pelo que ele fez, e o lead dos dois entra nos dois', () => {
    const leads = [lead('so-ia', { data_medicao_instalacao: 'terça' }), lead('so-eq', { medicao_equipe: 'feita em 25/09' }), lead('dois')]
    const f = base(leads, {
      atendimento: new Map([
        ['so-ia', { ia_respondeu: true, equipe_respondeu: false }],
        ['so-eq', { ia_respondeu: false, equipe_respondeu: true }],
        ['dois', { ia_respondeu: true, equipe_respondeu: true }],
      ]),
      orcamentosChat: [
        { lead_id: 'so-ia', autor: 'ia' }, { lead_id: 'so-eq', autor: 'equipe' },
        { lead_id: 'dois', autor: 'ia' }, { lead_id: 'dois', autor: 'equipe' }, { lead_id: 'fora-do-periodo', autor: 'equipe' },
      ],
      idsConvertidos: new Set(['so-eq', 'dois']),
    })
    expect(f.conversas).toBe(3)
    expect(f.etapas).toEqual([
      { chave: 'atendeu', rotulo: 'Atendeu', ia: 2, equipe: 2 },
      { chave: 'orcamento', rotulo: 'Mandou orçamento', ia: 2, equipe: 2 },
      { chave: 'medicao', rotulo: 'Medição agendada', ia: 1, equipe: 1 },
    ])
    expect(f.convertidos).toEqual({ total: 2, ia: 1, equipe: 2, nosDois: 1, semOrcamento: 0 })
  })

  it('preço da IA fora do chat conta do lado da IA', () => {
    const f = base([lead('calc')], { cotouForaDoChat: l => l.id === 'calc', idsConvertidos: new Set(['calc']) })
    expect(f.etapas[1]).toMatchObject({ ia: 1, equipe: 0 })
    expect(f.convertidos).toMatchObject({ total: 1, ia: 1, semOrcamento: 0 })
  })

  it('convertido sem orçamento no chat fica à parte', () => {
    const f = base([lead('balcao')], { idsConvertidos: new Set(['balcao']) })
    expect(f.convertidos).toEqual({ total: 1, ia: 0, equipe: 0, nosDois: 0, semOrcamento: 1 })
  })

  it('medição em branco não conta', () => {
    const f = base([lead('x', { data_medicao_instalacao: '  ', medicao_equipe: '' })])
    expect(f.etapas[2]).toMatchObject({ ia: 0, equipe: 0 })
  })
})
