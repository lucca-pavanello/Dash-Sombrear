/**
 * Relatório por período — a parte que pensa.
 *
 * Portado do workflow n8n `Dash | Relatorios por periodo (IA)` (JpZHo2U2y3eY4cjj),
 * nós `code_decidir | qual periodo`, `code_kpis | calcular` e
 * `code_montar | texto final`. Aqui é função pura: entra linha do banco, sai
 * número. O LLM só escreve texto por cima — os números nunca passam por ele.
 *
 * Sem import de nada: este arquivo também é carregado pela Edge Function, onde
 * o alias `@/` não existe. Os tipos abaixo são estruturais de propósito — só os
 * campos que o cálculo usa, não o schema inteiro.
 *
 * VENDA E RECEITA VÊM DE `orcamentos`, NÃO DO CRM
 * Até 26/09 estes dois números saíam de `desfecho`/`desfecho_valor` do CRM,
 * colunas com 3 linhas no banco inteiro. O resultado é que o relatório disse
 * "0 vendas, R$ 0" por seis semanas seguidas, inclusive em agosto/2026, mês em
 * que a loja fechou 13 pedidos e R$ 49.378,95.
 *
 * Agora a fonte é `orcamentos`, com a MESMA definição da aba Análise —
 * importada de `../analises/venda.ts`, não copiada: `fechado = true`,
 * `valor_cobrado ?? valor_venda + instalacao`, itens do mesmo pedido contam
 * como uma venda só, e as linhas do harness de QA ficam de fora.
 *
 * `perdidos_ou_sumiram` continua vindo do CRM: isso é desfecho de conversa,
 * não de venda, e é o lugar certo dele.
 */

import {
  chavePedido, dataVenda, ehTeste, ehVenda, receita, type VendaMinima,
} from '../analises/venda.ts'

export type { VendaMinima }

export type LinhaCrm = {
  id?: string | null
  created_at?: string | null
  origem?: string | null
  lead_temperatura?: string | null
  status_lead?: string | null
  ultimo_valor_cotado?: string | null
  precisa_humano?: string | null
  avisado_fechamento_em?: string | null
  primeira_resposta_humana_em?: string | null
  desfecho?: string | null
  desfecho_em?: string | null
  desfecho_valor?: string | null
  objecoes?: string | null
}

export type PedidoRelatorio = { id: string; periodo_inicio: string; periodo_fim: string; status: string }
export type RelatorioPronto = { tipo: string; periodo_inicio: string; periodo_fim: string }

export type TipoPeriodo = 'custom' | 'semanal' | 'mensal' | 'anual'
export type Periodo = { tipo: TipoPeriodo; inicio: string; fim: string; pedido_id?: string }

/** antes disso não havia coleta — relatório de período vazio não serve a ninguém */
export const DATA_INICIO = '2026-08-10'

const doisDig = (n: number) => (n < 10 ? '0' + n : String(n))
const emData = (d: Date) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`

/**
 * Qual resumo gerar nesta rodada, um por vez e nesta ordem:
 * pedido do usuário > semanal > mensal > anual. `null` = nada a fazer.
 */
export function decidirPeriodo(
  pedidos: PedidoRelatorio[],
  prontos: RelatorioPronto[],
  hoje = new Date(),
): Periodo | null {
  const pendente = pedidos.find((p) => p && p.id && p.status === 'pendente')
  if (pendente) {
    return {
      tipo: 'custom',
      inicio: String(pendente.periodo_inicio),
      fim: String(pendente.periodo_fim),
      pedido_id: pendente.id,
    }
  }

  const jaTem = (tipo: string, ini: string, fim: string) =>
    prontos.some((r) => r.tipo === tipo && String(r.periodo_inicio) === ini && String(r.periodo_fim) === fim)

  // semanal: a última semana completa, segunda a domingo
  const diaDaSemana = (hoje.getDay() + 6) % 7 // 0 = segunda
  const segundaAtual = new Date(hoje)
  segundaAtual.setDate(hoje.getDate() - diaDaSemana)
  segundaAtual.setHours(0, 0, 0, 0)
  const segundaPassada = new Date(segundaAtual)
  segundaPassada.setDate(segundaAtual.getDate() - 7)
  const domingoPassado = new Date(segundaAtual)
  domingoPassado.setDate(segundaAtual.getDate() - 1)
  const sIni = emData(segundaPassada)
  const sFim = emData(domingoPassado)
  if (sFim >= DATA_INICIO && !jaTem('semanal', sIni, sFim)) return { tipo: 'semanal', inicio: sIni, fim: sFim }

  // mensal: o último mês completo
  const mIni = emData(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))
  const mFim = emData(new Date(hoje.getFullYear(), hoje.getMonth(), 0))
  if (mFim >= DATA_INICIO && !jaTem('mensal', mIni, mFim)) return { tipo: 'mensal', inicio: mIni, fim: mFim }

  // anual: o último ano completo
  const aIni = `${hoje.getFullYear() - 1}-01-01`
  const aFim = `${hoje.getFullYear() - 1}-12-31`
  if (aFim >= DATA_INICIO && !jaTem('anual', aIni, aFim)) return { tipo: 'anual', inicio: aIni, fim: aFim }

  return null
}

export type Kpis = {
  periodo: { tipo: string; inicio: string; fim: string }
  leads_novos: number
  por_origem: Record<string, number>
  por_temperatura: Record<string, number>
  cotados: number
  passados_pro_humano: number
  fechados: number
  receita_fechada: number
  perdidos_ou_sumiram: number
  objecoes_top: string[]
  sla_medio_horas: number | null
  aguardando_atendente_agora: number
}

export function calcularKpis(
  linhas: LinhaCrm[],
  periodo: Periodo,
  orcamentos: VendaMinima[] = [],
): Kpis {
  // -03:00 fixo, como no n8n. A loja é toda em São Paulo e o horário de verão
  // não existe mais no Brasil desde 2019.
  const ini = new Date(`${periodo.inicio}T00:00:00-03:00`).getTime()
  const fim = new Date(`${periodo.fim}T23:59:59-03:00`).getTime()
  const dentro = (x: string | null | undefined) => {
    if (!x) return false
    const t = new Date(x).getTime()
    return t >= ini && t <= fim
  }
  const txt = (r: LinhaCrm, k: keyof LinhaCrm) => String(r[k] ?? '').trim()

  const rows = linhas.filter((r) => r && r.id)
  const novos = rows.filter((r) => dentro(r.created_at))

  const porOrigem: Record<string, number> = {}
  const porTemperatura: Record<string, number> = {}
  for (const r of novos) {
    const o = txt(r, 'origem') || 'sem origem'
    porOrigem[o] = (porOrigem[o] ?? 0) + 1
    const t = txt(r, 'lead_temperatura') || 'sem nota'
    porTemperatura[t] = (porTemperatura[t] ?? 0) + 1
  }

  const cotados = novos.filter(
    (r) => parseInt(txt(r, 'status_lead'), 10) >= 3 || txt(r, 'ultimo_valor_cotado') !== '',
  ).length
  const handoff = novos.filter(
    (r) => txt(r, 'precisa_humano').toLowerCase() === 'sim' || !!r.avisado_fechamento_em,
  ).length

  // venda de verdade: a linha de `orcamentos` com a flag `fechado`, na data do
  // pedido. Itens do mesmo pedido são uma venda só.
  const vendas = orcamentos.filter((o) => ehVenda(o) && !ehTeste(o) && dentro(dataVenda(o)))
  const pedidosFechados = new Set(vendas.map(chavePedido))
  const receitaFechada = vendas.reduce((s, o) => s + receita(o), 0)

  const perdidos = rows.filter(
    (r) => ['perdeu', 'sumiu'].includes(txt(r, 'desfecho')) && dentro(r.desfecho_em),
  ).length

  const objecoes: Record<string, number> = {}
  for (const r of novos) {
    for (const o of txt(r, 'objecoes').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) {
      objecoes[o] = (objecoes[o] ?? 0) + 1
    }
  }
  const topObjecoes = Object.keys(objecoes)
    .sort((a, b) => objecoes[b] - objecoes[a])
    .slice(0, 3)
    .map((k) => `${k} (${objecoes[k]})`)

  // SLA: horas entre o aviso de fechamento e a primeira resposta humana.
  // Descarta negativo e acima de 14 dias — isso é dado sujo, não atendimento lento.
  const slas = rows
    .filter((r) => r.avisado_fechamento_em && r.primeira_resposta_humana_em && dentro(r.avisado_fechamento_em))
    .map(
      (r) =>
        (new Date(r.primeira_resposta_humana_em as string).getTime() -
          new Date(r.avisado_fechamento_em as string).getTime()) /
        3_600_000,
    )
    .filter((h) => h >= 0 && h < 24 * 14)
  const slaMedio = slas.length ? Math.round((slas.reduce((a, b) => a + b, 0) / slas.length) * 10) / 10 : null

  return {
    periodo: { tipo: periodo.tipo, inicio: periodo.inicio, fim: periodo.fim },
    leads_novos: novos.length,
    por_origem: porOrigem,
    por_temperatura: porTemperatura,
    cotados,
    passados_pro_humano: handoff,
    fechados: pedidosFechados.size,
    receita_fechada: Math.round(receitaFechada * 100) / 100,
    perdidos_ou_sumiram: perdidos,
    objecoes_top: topObjecoes,
    sla_medio_horas: slaMedio,
    aguardando_atendente_agora: rows.filter((r) => txt(r, 'desfecho') === 'aguardando_atendente').length,
  }
}

export function montarPrompt(kpis: Kpis): string {
  return [
    'Voce escreve o resumo executivo do atendimento da Sombrear (loja de persianas) para o dono ler no celular.',
    'REGRA ABSOLUTA: use APENAS os numeros do JSON abaixo. Nao invente, nao estime, nao complete.',
    'Numero zero ou nulo: diga com naturalidade que nao houve, ou omita — nunca finja que ha dado.',
    'Tom direto e humano, sem corporatives. Maximo 8 linhas. Sem titulo, sem markdown, sem emoji.',
    'Termine com UMA recomendacao pratica tirada dos numeros (canal a reforcar, leads esperando resposta, objecao a atacar).',
    'IMPORTANTE: responda em TEXTO CORRIDO, nunca em JSON. NAO envolva a resposta em chaves {} nem em aspas, NAO escreva a palavra "resumo:" no inicio -- so o texto do resumo, pronto pra ler.',
    '',
    `Periodo: ${kpis.periodo.tipo} de ${kpis.periodo.inicio} a ${kpis.periodo.fim}`,
    `Dados do periodo (para voce usar, NAO para copiar o formato): ${JSON.stringify(kpis)}`,
  ].join('\n')
}

/**
 * Tira as manias do LLM: aspas em volta, resposta embrulhada em JSON
 * (`{"resumo": "..."}`) e `\n` literal de duas letras em vez de quebra de
 * linha. As três já apareceram em produção — a do JSON tem data, 27/08.
 */
export function limparTextoLlm(bruto: string): string {
  let texto = String(bruto ?? '').trim()
  while (texto.length > 1 && texto.startsWith('"') && texto.endsWith('"')) texto = texto.slice(1, -1).trim()
  if (texto.startsWith('{') && texto.endsWith('}')) {
    try {
      const obj = JSON.parse(texto) as Record<string, unknown>
      const achado = obj.resumo ?? obj.texto ?? obj.resposta
      if (achado) texto = String(achado).trim()
    } catch {
      /* não era JSON de verdade; segue com o texto como veio */
    }
  }
  return texto.split('\\n').join('\n')
}

/** Se o LLM falhar, o relatório sai assim mesmo — nunca deixa de sair. */
export function textoDeReserva(k: Kpis): string {
  const linhas = [
    `Resumo ${k.periodo.tipo} (${k.periodo.inicio} a ${k.periodo.fim}):`,
    `${k.leads_novos} leads novos; ${k.cotados} receberam orcamento; ${k.fechados} fecharam (R$ ${k.receita_fechada}).`,
    `${k.passados_pro_humano} passaram pro time; ${k.aguardando_atendente_agora} aguardando atendente agora.`,
  ]
  if (k.objecoes_top.length) linhas.push(`Objecoes mais comuns: ${k.objecoes_top.join(', ')}.`)
  return linhas.join('\n')
}
