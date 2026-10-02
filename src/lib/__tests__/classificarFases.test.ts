import { describe, expect, it } from 'vitest'
import {
  dividirNaPassagem, lerResposta, montarPedido, type MensagemFase,
} from '../../../supabase/functions/classificar-fases/prompt'
import * as espelho from '../../../supabase/functions/_shared/taxonomia'
import { FALHAS, OBJECOES } from '@/lib/insights/taxonomia'

const msg = (autor: MensagemFase['autor'], hora: string, conteudo = 'oi'): MensagemFase => ({
  autor, autor_nome: null, canal_envio: autor === 'equipe' ? 'chatwoot' : null, conteudo, anexos: [],
  excluida: false, enviada_em: `2026-10-01T${hora}:00.000Z`,
})

describe('dividirNaPassagem', () => {
  it('corta na primeira mensagem da equipe', () => {
    const t = dividirNaPassagem([
      msg('cliente', '12:00'), msg('ia', '12:01'), msg('cliente', '12:05'),
      msg('equipe', '13:00'), msg('cliente', '13:10'), msg('ia', '13:11'),
    ])
    expect(t.ia?.map(m => m.enviada_em.slice(11, 16))).toEqual(['12:00', '12:01', '12:05'])
    expect(t.equipe?.map(m => m.enviada_em.slice(11, 16))).toEqual(['13:00', '13:10', '13:11'])
    expect(t.passagem).toBe('2026-10-01T13:00:00.000Z')
  })

  it('sem a Amanda antes da passagem, não há trecho da IA', () => {
    const t = dividirNaPassagem([msg('cliente', '12:00'), msg('equipe', '12:30')])
    expect(t.ia).toBeNull()
    expect(t.equipe).toHaveLength(1)
  })

  it('sem equipe, a conversa inteira é da IA', () => {
    const t = dividirNaPassagem([msg('cliente', '12:00'), msg('ia', '12:01')])
    expect(t.ia).toHaveLength(2)
    expect(t.equipe).toBeNull()
    expect(t.passagem).toBeNull()
  })

  it('ordena pela data antes de cortar', () => {
    const t = dividirNaPassagem([msg('equipe', '13:00'), msg('ia', '12:01'), msg('cliente', '12:00')])
    expect(t.ia).toHaveLength(2)
  })
})

describe('montarPedido', () => {
  it('manda os dois trechos separados e marca o que não existe', () => {
    const p = montarPedido({ nome: 'Ana', modelo_interesse: null },
      dividirNaPassagem([msg('cliente', '12:00', 'quero rolo'), msg('equipe', '12:30', 'segue o preço')]),
      new Date('2026-10-02T12:00:00Z'))
    expect(p).toContain('=== TRECHO DA IA ===\n(nao existe)')
    expect(p).toContain('LOJA (equipe): segue o preço')
    expect(p).toContain('Agora: 02/10 09:00')
    for (const f of FALHAS) expect(p).toContain(`"${f.id}"`)
  })
})

describe('lerResposta', () => {
  const ambos = dividirNaPassagem([msg('cliente', '12:00'), msg('ia', '12:01'), msg('equipe', '13:00')])

  it('lê os dois trechos e descarta slug inventado', () => {
    const r = lerResposta('```json\n{"ia":{"objecoes":["preco_alto","inventado"],"motivo":"achou caro","sensibilidade_preco":"alta"},' +
      '"equipe":{"assunto":"venda","objecoes":[],"falhas":["sem_followup","nao_existe","sem_followup"],"motivo":"mandou preço e não voltou","sensibilidade_preco":"media"}}\n```', ambos)
    expect(r).toEqual({
      ia: { ia_objecao_tags: ['preco_alto'], ia_objecao_outro: null, ia_motivo: 'achou caro', ia_sensibilidade_preco: 'alta' },
      equipe: {
        equipe_assunto: 'venda', equipe_objecao_tags: [], equipe_objecao_outro: null, equipe_falhas: ['sem_followup'],
        equipe_falha_outro: null, equipe_motivo: 'mandou preço e não voltou', equipe_sensibilidade_preco: 'media',
      },
    })
  })

  it('fornecedor não ganha falha nem objeção', () => {
    const r = lerResposta('{"ia":{"objecoes":[]},"equipe":{"assunto":"nao_cliente","objecoes":["preco_alto"],"falhas":["retorno_esquecido"]}}', ambos)
    expect(r?.equipe).toMatchObject({ equipe_assunto: 'nao_cliente', equipe_objecao_tags: [], equipe_falhas: [] })
  })

  it('texto livre só fica quando usou "outro"', () => {
    const r = lerResposta('{"ia":{"objecoes":["outro"],"objecao_outro":"quer cor rosa"},"equipe":{"assunto":"venda","falhas":[],"falha_outro":"sobrou"}}', ambos)
    expect(r?.ia?.ia_objecao_outro).toBe('quer cor rosa')
    expect(r?.equipe?.equipe_falha_outro).toBeNull()
  })

  it('trecho que existe e veio faltando invalida a resposta (tenta de novo depois)', () => {
    expect(lerResposta('{"ia":null,"equipe":{"assunto":"venda"}}', ambos)).toBeUndefined()
    expect(lerResposta('sem json', ambos)).toBeUndefined()
  })

  it('trecho que não existe volta null mesmo se o modelo inventar', () => {
    const soEquipe = dividirNaPassagem([msg('cliente', '12:00'), msg('equipe', '12:30')])
    const r = lerResposta('{"ia":{"objecoes":["preco_alto"]},"equipe":{"assunto":"pos_venda"}}', soEquipe)
    expect(r?.ia).toBeNull()
    expect(r?.equipe?.equipe_assunto).toBe('pos_venda')
  })
})

describe('taxonomia espelhada no Deno', () => {
  it('objeções e falhas iguais dos dois lados', () => {
    expect(espelho.OBJECOES.map(o => [o.id, o.criterio])).toEqual(OBJECOES.map(o => [o.id, o.criterio]))
    expect(espelho.FALHAS.map(f => [f.id, f.criterio])).toEqual(FALHAS.map(f => [f.id, f.criterio]))
  })
})
