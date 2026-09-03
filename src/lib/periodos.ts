/**
 * Período anterior e variação — o que faltava pra responder "subiu ou caiu?".
 *
 * O dash já compara mês atual vs mês anterior em três lugares (useMonthlyComparison,
 * TabAnalises, KPIGrid), mas sempre reescrevendo `((a-b)/b)*100` inline e sempre
 * cravado em MÊS. Para o card de Insights a pergunta é outra: dado o período que a
 * pessoa escolheu (hoje, semana, mês, ano, custom), qual é o período IMEDIATAMENTE
 * anterior de mesmo tamanho? Sem isso, "essa objeção está crescendo" é achismo.
 *
 * Trabalha com o mesmo vocabulário de `usePeriodFilter.ts` para não criar um segundo
 * conceito de período no projeto.
 */

export type Intervalo = { inicio: Date; fim: Date }

/**
 * Converte "2026-09-01" em data LOCAL, não UTC.
 *
 * `new Date('2026-09-01')` é parseado como meia-noite UTC — que no Brasil (UTC-3) cai às
 * 21h do dia 31/08. Somado a um `setHours(0,0,0,0)` depois, o intervalo inteiro escorrega
 * um dia pra trás e passa a incluir conversa do dia anterior. Construir com (ano, mês,
 * dia) evita isso porque esse construtor já é local.
 */
function dataLocal(iso: string, fimDoDia = false): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return fimDoDia
    ? new Date(ano, (mes ?? 1) - 1, dia ?? 1, 23, 59, 59, 999)
    : new Date(ano, (mes ?? 1) - 1, dia ?? 1, 0, 0, 0, 0)
}

/**
 * O intervalo que o período selecionado representa AGORA.
 * `todos`/`tudo` devolve null — "desde sempre" não tem período anterior com que comparar.
 */
export function intervaloAtual(
  periodo: string,
  dateFrom?: string,
  dateTo?: string,
  agora: Date = new Date(),
): Intervalo | null {
  const fim = new Date(agora)
  fim.setHours(23, 59, 59, 999)

  if (periodo === 'hoje') {
    const inicio = new Date(agora)
    inicio.setHours(0, 0, 0, 0)
    return { inicio, fim }
  }
  if (periodo === 'semana') {
    const inicio = new Date(agora)
    inicio.setDate(inicio.getDate() - 7)
    inicio.setHours(0, 0, 0, 0)
    return { inicio, fim }
  }
  if (periodo === 'mes') {
    return { inicio: new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0), fim }
  }
  if (periodo === 'ano') {
    return { inicio: new Date(agora.getFullYear(), 0, 1, 0, 0, 0, 0), fim }
  }
  if (periodo === 'custom' && dateFrom && dateTo) {
    return { inicio: dataLocal(dateFrom), fim: dataLocal(dateTo, true) }
  }
  return null
}

/**
 * O período anterior de mesmo tamanho, colado no atual. Para "mês" e "ano" usa o mês/ano
 * civil anterior (e não "os últimos 30 dias antes"), porque é assim que a loja pensa —
 * "agosto vs julho", não "30 dias contra 30 dias".
 */
export function periodoAnterior(
  periodo: string,
  dateFrom?: string,
  dateTo?: string,
  agora: Date = new Date(),
): Intervalo | null {
  const atual = intervaloAtual(periodo, dateFrom, dateTo, agora)
  if (!atual) return null

  if (periodo === 'mes') {
    const inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 0, 0, 0, 0)
    const fim = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999)
    return { inicio, fim }
  }
  if (periodo === 'ano') {
    return {
      inicio: new Date(agora.getFullYear() - 1, 0, 1, 0, 0, 0, 0),
      fim: new Date(agora.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
    }
  }

  // hoje / semana / custom: mesma duração, imediatamente antes
  const duracao = atual.fim.getTime() - atual.inicio.getTime()
  const fim = new Date(atual.inicio.getTime() - 1)
  return { inicio: new Date(fim.getTime() - duracao), fim }
}

/** Rótulo curto pra mostrar ao lado do delta ("vs mês anterior"). */
export function rotuloAnterior(periodo: string): string {
  if (periodo === 'hoje') return 'vs ontem'
  if (periodo === 'semana') return 'vs semana anterior'
  if (periodo === 'mes') return 'vs mês anterior'
  if (periodo === 'ano') return 'vs ano anterior'
  if (periodo === 'custom') return 'vs período anterior'
  return ''
}

export function dentroDe(iso: string | null | undefined, faixa: Intervalo | null): boolean {
  if (!iso || !faixa) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t >= faixa.inicio.getTime() && t <= faixa.fim.getTime()
}

/**
 * Variação percentual. Devolve null quando não há base de comparação — 0 → 3 não é
 * "aumento de 300%", é "apareceu agora", e mostrar um número inventado aí seria pior
 * que não mostrar nada.
 */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null
  if (anterior <= 0) return null
  return ((atual - anterior) / anterior) * 100
}
