import { describe, expect, it } from 'vitest'
import { lerResposta, transcrever, type MensagemResumo } from '../../../supabase/functions/resumir-conversas/prompt'

const msg = (p: Partial<MensagemResumo>): MensagemResumo => ({
  autor: 'cliente', autor_nome: null, canal_envio: null, conteudo: 'oi', anexos: [], excluida: false,
  enviada_em: '2026-10-01T12:24:00.000Z', ...p,
})

describe('transcrever', () => {
  it('diz quem falou e por onde, no horário de Rio Preto', () => {
    const t = transcrever([
      msg({ conteudo: 'Somos de Mato Grosso do Sul' }),
      msg({ autor: 'equipe', canal_envio: 'celular', conteudo: 'Avenida Fernando Costa 984' }),
      msg({ autor: 'equipe', canal_envio: 'chatwoot', autor_nome: 'Stella', conteudo: 'Te aguardo' }),
      msg({ autor: 'ia', conteudo: 'Prazer!' }),
    ])
    expect(t.split('\n')).toEqual([
      '[01/10 09:24] CLIENTE: Somos de Mato Grosso do Sul',
      '[01/10 09:24] LOJA (celular): Avenida Fernando Costa 984',
      '[01/10 09:24] LOJA (Stella): Te aguardo',
      '[01/10 09:24] IA: Prazer!',
    ])
  })

  it('anexo vira marcador e mensagem apagada sai', () => {
    const t = transcrever([
      msg({ conteudo: '', anexos: [{ tipo: 'audio' }] }),
      msg({ conteudo: 'Esta mensagem foi excluída', excluida: true }),
    ])
    expect(t).toBe('[01/10 09:24] CLIENTE: [áudio]')
  })
})

describe('lerResposta', () => {
  it('lê o JSON mesmo com texto em volta e junta interesse e pendência', () => {
    const c = lerResposta('ok: {"resumo":"Quer rolo blackout.","temperatura":"quente","proxima_acao":"Agendar medição","interesse":"rolo blackout","pendencia":"medida"}')
    expect(c).toEqual({
      resumo_conversa: 'Quer rolo blackout.', lead_temperatura: 'QUENTE', lead_proxima_acao: 'Agendar medição',
      status_motivo: 'Interesse: rolo blackout | Falta: medida',
    })
  })

  it('resposta sem resumo ou sem JSON não grava nada', () => {
    expect(lerResposta('{"resumo":""}')).toBeNull()
    expect(lerResposta('não consegui')).toBeNull()
  })

  it('temperatura fora da lista não entra', () => {
    expect(lerResposta('{"resumo":"x","temperatura":"TALVEZ"}')?.lead_temperatura).toBeNull()
  })
})
