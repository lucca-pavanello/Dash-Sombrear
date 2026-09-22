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
  if (periodo === 'mes_passado') {
    return {
      inicio: new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 0, 0, 0, 0),
      fim: new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999),
    }
  }
  if (periodo === '90d') {
    const inicio = new Date(agora)
    inicio.setDate(inicio.getDate() - 90)
    inicio.setHours(0, 0, 0, 0)
    return { inicio, fim }
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
  /**
   * Recorta o período anterior até o MESMO ponto do calendário em que o atual está.
   *
   * Sem isso, no dia 22 de setembro comparamos 22 dias contra os 31 de agosto e o
   * painel anuncia "-68%" — que não é queda nenhuma, é mês incompleto. O número de
   * abertura da aba Análise é exatamente esse, então a mentira sairia em primeiro
   * lugar. Com `prorata`, agosto é cortado no dia 22 e a comparação passa a ser entre
   * trechos iguais. Fica opcional porque o card de Insights do Agente IA já lê o mês
   * civil inteiro há tempos e não deve mudar de comportamento sem pedido.
   */
  prorata = false,
): Intervalo | null {
  const atual = intervaloAtual(periodo, dateFrom, dateTo, agora)
  if (!atual) return null

  if (periodo === 'mes') {
    const inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 0, 0, 0, 0)
    const ultimoDiaDoMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999)
    if (!prorata) return { inicio, fim: ultimoDiaDoMesAnterior }
    // mesmo dia do mês anterior; se ele não existe (31 de março → fevereiro), cai no
    // último dia daquele mês, que é o trecho máximo comparável
    const mesmoDia = new Date(agora.getFullYear(), agora.getMonth() - 1, agora.getDate(), 23, 59, 59, 999)
    const fim = mesmoDia > ultimoDiaDoMesAnterior ? ultimoDiaDoMesAnterior : mesmoDia
    return { inicio, fim }
  }
  if (periodo === 'ano') {
    const inicio = new Date(agora.getFullYear() - 1, 0, 1, 0, 0, 0, 0)
    const fimDoAno = new Date(agora.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
    if (!prorata) return { inicio, fim: fimDoAno }
    return {
      inicio,
      fim: new Date(agora.getFullYear() - 1, agora.getMonth(), agora.getDate(), 23, 59, 59, 999),
    }
  }
  // Mês civil anterior ao anterior: "agosto" quando se olha "mês passado".
  if (periodo === 'mes_passado') {
    return {
      inicio: new Date(agora.getFullYear(), agora.getMonth() - 2, 1, 0, 0, 0, 0),
      fim: new Date(agora.getFullYear(), agora.getMonth() - 1, 0, 23, 59, 59, 999),
    }
  }

  // hoje / semana / custom: mesma duração, imediatamente antes
  const duracao = atual.fim.getTime() - atual.inicio.getTime()
  const fim = new Date(atual.inicio.getTime() - 1)
  return { inicio: new Date(fim.getTime() - duracao), fim }
}

/** Rótulo curto pra mostrar ao lado do delta ("vs mês anterior"). */
export function rotuloAnterior(periodo: string, prorata = false): string {
  if (periodo === 'hoje') return 'vs ontem'
  if (periodo === 'semana') return 'vs semana anterior'
  // com pro-rata o rótulo precisa dizer que a comparação é com um TRECHO, senão o
  // número parece comparado com o mês inteiro e a honestidade se perde no caminho
  if (periodo === 'mes') return prorata ? 'vs mesmo trecho do mês anterior' : 'vs mês anterior'
  if (periodo === 'mes_passado') return 'vs o mês antes dele'
  if (periodo === '90d') return 'vs 90 dias anteriores'
  if (periodo === 'ano') return prorata ? 'vs mesmo trecho do ano anterior' : 'vs ano anterior'
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
