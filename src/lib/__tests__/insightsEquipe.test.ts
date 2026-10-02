import { describe, expect, it } from 'vitest'
import type { CrmLead, EquipeLead, RespostasEquipeLead } from '@/hooks/useAgenteIA'
import { leituraPendente, resumirEquipe, tempoLegivel } from '../insights/equipe'

const lead = (id: string, p: Partial<CrmLead> = {}) =>
  ({ id, medicao_equipe: null, timestamp_ultima_msg: '2026-10-01T12:00:00Z', fases_em: '2026-10-01T13:00:00Z', ...p }) as CrmLead
const eq = (lead_id: string, msgs = 4, audios = 0): EquipeLead => ({ lead_id, passagem_em: '2026-10-01T10:00:00Z', msgs_equipe: msgs, audios_equipe: audios })
const resp = (lead_id: string, mediana: number, respostas = 2, longas = 0): RespostasEquipeLead =>
  ({ lead_id, respostas, mediana_min: mediana, esperas_longas: longas })

const base = (leads: CrmLead[], extra: Partial<Parameters<typeof resumirEquipe>[0]> = {}) => resumirEquipe({
  leads, anteriores: [], assunto: 'tudo', numerosPorLead: new Map(), respostasPorLead: new Map(),
  orcamentosChat: [], idsConvertidos: new Set(), ...extra,
})

describe('resumirEquipe', () => {
  it('só entra conversa em que a equipe falou; fornecedor sai da conta e é contado à parte', () => {
    const r = base([
      lead('so-ia'),
      lead('venda', { equipe_assunto: 'venda', equipe_falhas: [] }),
      lead('forn', { equipe_assunto: 'nao_cliente', equipe_falhas: [] }),
      lead('nao-lida'),
    ], { numerosPorLead: new Map([['venda', eq('venda')], ['forn', eq('forn')], ['nao-lida', eq('nao-lida')]]) })
    expect(r.conversas.map(l => l.id)).toEqual(['venda', 'nao-lida'])
    expect(r.naoCliente).toBe(1)
    expect(r.lidas.map(l => l.id)).toEqual(['venda'])
  })

  it('números brutos: mediana das conversas, esperas, áudio, orçamento, medição e convertido', () => {
    const leads = [
      lead('a', { equipe_assunto: 'venda', equipe_falhas: [], medicao_equipe: 'terça' }),
      lead('b', { equipe_assunto: 'venda', equipe_falhas: [] }),
      lead('c', { equipe_assunto: 'venda', equipe_falhas: [] }),
    ]
    const r = base(leads, {
      numerosPorLead: new Map([['a', eq('a', 10, 4)], ['b', eq('b', 6, 0)], ['c', eq('c', 4, 2)]]),
      respostasPorLead: new Map([['a', resp('a', 5, 3, 1)], ['b', resp('b', 30)], ['c', resp('c', 90, 1, 1)]]),
      orcamentosChat: [{ lead_id: 'a', autor: 'equipe' }, { lead_id: 'b', autor: 'ia' }],
      idsConvertidos: new Set(['a']),
    })
    expect(r.numeros).toEqual({
      medianaResposta: 30, respostas: 6, esperasLongas: 2, msgs: 20, audios: 6, orcamentos: 1, medicoes: 1, convertidos: 1,
    })
  })

  it('ranking de falhas sobre as lidas, com o período anterior ao lado', () => {
    const r = base([
      lead('a', { equipe_assunto: 'venda', equipe_falhas: ['sem_followup', 'retorno_esquecido'] }),
      lead('b', { equipe_assunto: 'venda', equipe_falhas: ['sem_followup'] }),
      lead('c', { equipe_assunto: 'pos_venda', equipe_falhas: ['prazo_sem_aviso'] }),
      lead('d', { equipe_assunto: 'venda', equipe_falhas: [] }),
    ], { anteriores: [lead('x', { equipe_assunto: 'venda', equipe_falhas: ['sem_followup'] })] })
    expect(r.falhas.map(f => [f.item.id, f.n, f.pct, f.anterior])).toEqual([
      ['sem_followup', 2, 50, 1], ['retorno_esquecido', 1, 25, 0], ['prazo_sem_aviso', 1, 25, 0],
    ])
  })

  it('filtro de assunto recorta conversas, números e ranking', () => {
    const r = base([
      lead('v', { equipe_assunto: 'venda', equipe_falhas: ['sem_followup'] }),
      lead('p', { equipe_assunto: 'pos_venda', equipe_falhas: ['prazo_sem_aviso'] }),
    ], { assunto: 'pos_venda' })
    expect(r.lidas.map(l => l.id)).toEqual(['p'])
    expect(r.falhas.map(f => f.item.id)).toEqual(['prazo_sem_aviso'])
    expect([r.venda, r.posVenda]).toEqual([1, 1])
  })
})

describe('leituraPendente', () => {
  it('nunca lida ou andou depois da leitura', () => {
    expect(leituraPendente(lead('a', { fases_em: null }))).toBe(true)
    expect(leituraPendente(lead('b', { fases_em: '2026-10-01T11:00:00Z' }))).toBe(true)
    expect(leituraPendente(lead('c'))).toBe(false)
  })
})

describe('tempoLegivel', () => {
  it('minutos, horas e dias', () => {
    expect([tempoLegivel(null), tempoLegivel(12.4), tempoLegivel(80), tempoLegivel(120), tempoLegivel(3000)])
      .toEqual(['—', '12 min', '1h 20', '2h', '2 dias'])
  })
})
