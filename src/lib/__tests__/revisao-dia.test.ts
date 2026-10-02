/**
 * Revisão diária: as contas que decidem o que o dono lê à noite.
 *
 * As mensagens aqui são escritas à mão, não tiradas de produção, porque o que está sob
 * teste é a REGRA (quem entra, quem fica de fora, quando o silêncio conta) e um caso
 * inventado diz isso em três linhas, sem levar conversa de cliente real para dentro do
 * repositório. A prova contra produção é a revisão rodando sobre um dia de verdade.
 */
import { describe, it, expect } from 'vitest'
import {
  conversasDoDia, diaNaCasa, horaNaCasa, lerRevisao, montarRevisao, semRespostaDaIA,
  type MensagemRevisao,
} from '@/lib/revisao/dia'

let proximoId = 1

/** `hora` é hora da casa (UTC-3); a coluna guarda UTC, como no banco */
function msg(
  conversa: number,
  autor: MensagemRevisao['autor'],
  hora: string,
  conteudo: string,
  extra: Partial<MensagemRevisao> = {},
): MensagemRevisao {
  const [h, m] = hora.split(':').map(Number)
  const dia = extra.enviada_em ?? '2026-09-29'
  return {
    id: proximoId++,
    conversa_id: conversa,
    lead_id: `lead-${conversa}`,
    autor,
    autor_nome: autor === 'equipe' ? 'Stella' : null,
    canal_envio: autor === 'equipe' ? 'chatwoot' : null,
    conteudo,
    anexos: null,
    excluida: false,
    privada: false,
    ...extra,
    enviada_em: new Date(Date.UTC(2026, 8, Number(dia.slice(8, 10)), h + 3, m)).toISOString(),
  }
}

const DIA = '2026-09-29'
const FIM_DO_DIA = Date.parse(`${DIA}T23:59:59-03:00`)

describe('o dia e a hora da casa', () => {
  it('23h de Rio Preto ainda é o mesmo dia, mesmo já sendo outro em UTC', () => {
    // 2026-09-29 23:30 em Rio Preto = 2026-09-30 02:30 UTC
    expect(diaNaCasa('2026-09-30T02:30:00.000Z')).toBe('2026-09-29')
    expect(horaNaCasa('2026-09-30T02:30:00.000Z')).toBe('23:30')
  })
})

describe('quais conversas entram', () => {
  const mensagens = [
    msg(1, 'cliente', '09:00', 'bom dia, quanto fica um rolô de 1,20 x 1,50?'),
    msg(1, 'ia', '09:01', 'bom dia! o rolô blackout nessa medida fica R$ 480,00'),
    msg(2, 'cliente', '10:00', 'preciso de orçamento'),
    msg(2, 'equipe', '10:05', 'claro, me manda a medida'),
    msg(3, 'ia', '08:00', 'bom dia! passando para lembrar da sua medição'),
  ]

  it('entra a que a Amanda respondeu; fica de fora a que só a equipe tocou', () => {
    const c = conversasDoDia({ dia: DIA, mensagens })
    expect(c.map(x => x.conversa_id)).toEqual([1])
  })

  it('conversa só com fala da IA não entra: não há o outro lado para julgar', () => {
    const c = conversasDoDia({ dia: DIA, mensagens: [mensagens[4]] })
    expect(c).toEqual([])
  })

  it('mensagem apagada ou privada não conta como fala', () => {
    const c = conversasDoDia({
      dia: DIA,
      mensagens: [
        msg(9, 'cliente', '09:00', 'oi'),
        msg(9, 'ia', '09:01', 'nota interna', { privada: true }),
        msg(9, 'ia', '09:02', 'mensagem apagada', { excluida: true }),
      ],
    })
    expect(c).toEqual([])
  })

  it('o rótulo é por posição e o nome do lead vem de fora, nunca o telefone', () => {
    const c = conversasDoDia({ dia: DIA, mensagens, leads: [{ id: 'lead-1', nome: 'Vitoria' }] })
    expect(c[0].rotulo).toBe('Conversa 1')
    expect(c[0].nome).toBe('Vitoria')
    expect(JSON.stringify(c[0])).not.toContain('@')
  })

  it('mensagem de outro dia não entra na revisão do dia', () => {
    const c = conversasDoDia({
      dia: DIA,
      mensagens: [
        msg(1, 'cliente', '09:00', 'ontem', { enviada_em: '2026-09-28' }),
        msg(1, 'ia', '09:01', 'ontem também', { enviada_em: '2026-09-28' }),
      ],
    })
    expect(c).toEqual([])
  })
})

describe('sem resposta da Amanda', () => {
  it('conta o cliente que ficou sem resposta nenhuma', () => {
    const conversas = conversasDoDia({
      dia: DIA,
      mensagens: [
        msg(1, 'cliente', '09:00', 'quanto fica?'),
        msg(1, 'ia', '09:01', 'fica R$ 480,00'),
        msg(1, 'cliente', '09:10', 'e com instalação?'),
      ],
    })
    const sem = semRespostaDaIA(conversas, FIM_DO_DIA)
    expect(sem).toHaveLength(1)
    expect(sem[0]).toMatchObject({ hora: '09:10', respondeu: null, espera_min: null })
  })

  it('diz quando a equipe cobriu, e em quantos minutos', () => {
    const conversas = conversasDoDia({
      dia: DIA,
      mensagens: [
        msg(1, 'cliente', '09:00', 'quanto fica?'),
        msg(1, 'ia', '09:01', 'fica R$ 480,00'),
        msg(1, 'cliente', '09:10', 'e com instalação?'),
        msg(1, 'equipe', '09:25', 'a instalação fica R$ 120,00'),
      ],
    })
    expect(semRespostaDaIA(conversas, FIM_DO_DIA)[0]).toMatchObject({
      respondeu: 'equipe', espera_min: 15,
    })
  })

  it('depois que uma pessoa entra na conversa, o silêncio da IA é o combinado', () => {
    // o handoff é a regra da casa: cobrar a Amanda aqui encheria a seção de atendimento
    // humano, que é a maior parte do dia na Sombrear
    const conversas = conversasDoDia({
      dia: DIA,
      mensagens: [
        msg(1, 'cliente', '09:00', 'quanto fica?'),
        msg(1, 'ia', '09:01', 'fica R$ 480,00'),
        msg(1, 'equipe', '09:05', 'oi, aqui é a Stella, vou te atender'),
        msg(1, 'cliente', '09:30', 'consigo parcelar?'),
        msg(1, 'cliente', '10:00', 'e o prazo?'),
      ],
    })
    expect(semRespostaDaIA(conversas, FIM_DO_DIA)).toEqual([])
  })

  it('depois que a Amanda avisa que passou pra equipe, o silêncio dela é o combinado', () => {
    // caso real da primeira revisão (02/10): a cliente mandou medida e nome DEPOIS do
    // aviso de handoff, e a equipe respondeu em 1 minuto. Era o fluxo funcionando
    const conversas = conversasDoDia({
      dia: DIA,
      mensagens: [
        msg(1, 'cliente', '10:20', 'preciso de cortina blackout 3,00x2,56'),
        msg(1, 'ia', '10:21', 'Perfeito, obrigada! Já passei pra equipe de cortinas, eles seguem com você daqui.'),
        msg(1, 'cliente', '10:22', 'Largura 3,00m Altura 2,56m'),
        msg(1, 'cliente', '10:22', 'Meu nome é Regina'),
        msg(1, 'equipe', '10:23', 'Olá'),
      ],
    })
    expect(semRespostaDaIA(conversas, FIM_DO_DIA)).toEqual([])
  })

  it('"ok" e "obrigada" não esperam resposta', () => {
    const conversas = conversasDoDia({
      dia: DIA,
      mensagens: [
        msg(1, 'cliente', '09:00', 'quanto fica?'),
        msg(1, 'ia', '09:01', 'fica R$ 480,00'),
        msg(1, 'cliente', '09:02', 'obrigada!'),
        msg(1, 'cliente', '09:03', '👍'),
      ],
    })
    expect(semRespostaDaIA(conversas, FIM_DO_DIA)).toEqual([])
  })

  it('quem escreveu agora ainda pode ser respondido: não entra', () => {
    const conversas = conversasDoDia({
      dia: DIA,
      mensagens: [
        msg(1, 'cliente', '09:00', 'quanto fica?'),
        msg(1, 'ia', '09:01', 'fica R$ 480,00'),
        msg(1, 'cliente', '20:58', 'consigo parcelar?'),
      ],
    })
    const agora = Date.parse(`${DIA}T21:00:00-03:00`)
    expect(semRespostaDaIA(conversas, agora)).toEqual([])
    expect(semRespostaDaIA(conversas, agora + 15 * 60_000)).toHaveLength(1)
  })
})

describe('o pedido que vai para o modelo', () => {
  const base = montarRevisao({
    dia: DIA,
    mensagens: [
      msg(1, 'cliente', '09:00', 'quanto fica um rolô de 1,20 x 1,50?'),
      msg(1, 'ia', '09:01', 'fica R$ 480,00'),
      msg(1, 'equipe', '09:30', 'posso te mandar a foto do tecido'),
      msg(1, 'cliente', '09:40', 'pode sim'),
    ],
    leads: [{ id: 'lead-1', nome: 'Vitoria' }],
  })

  it('traz a transcrição com hora e quem falou, separando Amanda de equipe', () => {
    expect(base.pedido).toContain('AMANDA (09:01): fica R$ 480,00')
    expect(base.pedido).toContain('EQUIPE (Stella) (09:30)')
    expect(base.pedido).toContain('CLIENTE (09:00)')
  })

  it('não leva nome de cliente nem id para o modelo: a conversa é citada pelo rótulo', () => {
    expect(base.pedido).toContain('### Conversa 1')
    expect(base.pedido).not.toContain('Vitoria')
    expect(base.pedido).not.toContain('lead-1')
  })

  it('diz que fala de equipe não vira melhoria da IA', () => {
    expect(base.pedido).toContain('nada que a EQUIPE disse vira melhoria da IA')
  })

  it('dia sem conversa da Amanda gera pedido honesto em vez de transcrição vazia', () => {
    const vazio = montarRevisao({ dia: DIA, mensagens: [] })
    expect(vazio.conversas).toEqual([])
    expect(vazio.pedido).toContain('a Amanda não respondeu nenhuma conversa neste dia')
  })
})

describe('a leitura da resposta do modelo', () => {
  const rotulos = ['Conversa 1', 'Conversa 2']

  it('aceita o JSON dentro de cerca de código', () => {
    const r = lerRevisao('```json\n{"resumo":"dia tranquilo","melhorias":[]}\n```', rotulos)
    expect(r).toEqual({ resumo: 'dia tranquilo', melhorias: [] })
  })

  it('descarta melhoria que cita conversa que não existe', () => {
    // o rótulo vira link para a conversa no Chatwoot: um inventado levaria a lugar nenhum
    const r = lerRevisao(JSON.stringify({
      resumo: 'ok',
      melhorias: [
        { conversa: 'Conversa 7', o_que_aconteceu: 'inventada', gravidade: 'alta' },
        { conversa: 'Conversa 2', o_que_aconteceu: 'repetiu a pergunta da medida', gravidade: 'alta' },
      ],
    }), rotulos)
    expect(r?.melhorias.map(m => m.conversa)).toEqual(['Conversa 2'])
  })

  it('gravidade fora da lista vira "media" em vez de derrubar a revisão', () => {
    const r = lerRevisao(JSON.stringify({
      resumo: 'ok',
      melhorias: [{ conversa: 'Conversa 1', o_que_aconteceu: 'x', gravidade: 'urgentíssima' }],
    }), rotulos)
    expect(r?.melhorias[0].gravidade).toBe('media')
  })

  it('corta em 8 melhorias', () => {
    const r = lerRevisao(JSON.stringify({
      resumo: 'ok',
      melhorias: Array.from({ length: 12 }, () => ({ conversa: 'Conversa 1', o_que_aconteceu: 'x' })),
    }), rotulos)
    expect(r?.melhorias).toHaveLength(8)
  })

  it('sem resumo não há revisão: null, e quem chama marca erro', () => {
    expect(lerRevisao('{"melhorias":[]}', rotulos)).toBeNull()
    expect(lerRevisao('não consegui responder', rotulos)).toBeNull()
  })
})
