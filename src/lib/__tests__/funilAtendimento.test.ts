import { describe, expect, it } from 'vitest'
import type { CrmLead } from '@/hooks/useAgenteIA'
import { calcularFunilAtendimento, type Atendimento } from '../analises/funilAtendimento'

const lead = (id: string, p: Partial<CrmLead> = {}) => ({ id, data_medicao_instalacao: null, medicao_equipe: null, ...p }) as CrmLead

const base = (leads: CrmLead[], extra: Partial<Parameters<typeof calcularFunilAtendimento>[0]> = {}) =>
  calcularFunilAtendimento({
    leads, atendimento: new Map<string, Atendimento>(), orcamentosChat: [], idsConvertidos: new Set(),
    vendaNoFechamento: new Set(), cotouForaDoChat: () => false, ...extra,
  })

describe('calcularFunilAtendimento', () => {
  it('lista vazia dá tudo zero', () => {
    expect(base([])).toEqual({
      conversas: 0,
      atendeu: { total: 0, soEquipe: 0 },
      orcamento: { total: 0, soIa: 0, ambos: 0, soEquipe: 0, enviados: 0, media: 0, maximo: 0 },
      medicao: { total: 0 },
      converteu: { total: 0, noFechamento: 0, soMarcado: 0 },
    })
  })

  it('atendeu é da IA; quem só a equipe atendeu fica à parte', () => {
    const f = base([lead('a'), lead('b'), lead('c')], {
      atendimento: new Map([
        ['a', { ia_respondeu: true, equipe_respondeu: false }],
        ['b', { ia_respondeu: true, equipe_respondeu: true }],
        ['c', { ia_respondeu: false, equipe_respondeu: true }],
      ]),
    })
    expect(f.atendeu).toEqual({ total: 2, soEquipe: 1 })
  })

  it('orçamento conta o lead uma vez e separa só IA, os dois e só equipe', () => {
    const f = base([lead('ia'), lead('eq'), lead('dois'), lead('calc'), lead('nada')], {
      orcamentosChat: [
        { lead_id: 'ia', autor: 'ia' }, { lead_id: 'ia', autor: 'ia' },
        { lead_id: 'eq', autor: 'equipe' },
        { lead_id: 'dois', autor: 'ia' }, { lead_id: 'dois', autor: 'equipe' },
        { lead_id: 'fora-do-periodo', autor: 'equipe' },
      ],
      cotouForaDoChat: l => l.id === 'calc',
    })
    // ia recebeu 2, eq 1, dois 2, calc 1 (fora do chat): 6 orçamentos para 4 clientes
    expect(f.orcamento).toEqual({ total: 4, soIa: 2, ambos: 1, soEquipe: 1, enviados: 6, media: 1.5, maximo: 2 })
  })

  it('medição é só a que a equipe marcou; a data anotada pela IA não conta', () => {
    const f = base([
      lead('eq', { medicao_equipe: 'visita 25/09' }),
      lead('ia', { data_medicao_instalacao: 'terça de manhã' }),
      lead('branco', { medicao_equipe: '  ' }),
    ])
    expect(f.medicao.total).toBe(1)
  })

  it('marcado no WhatsApp e lançado no Fechamento conta como UM convertido', () => {
    const f = base([lead('os-dois'), lead('so-fechamento'), lead('so-whatsapp')], {
      idsConvertidos: new Set(['os-dois', 'so-fechamento', 'so-whatsapp']),
      vendaNoFechamento: new Set(['os-dois', 'so-fechamento']),
    })
    expect(f.converteu).toEqual({ total: 3, noFechamento: 2, soMarcado: 1 })
  })
})
