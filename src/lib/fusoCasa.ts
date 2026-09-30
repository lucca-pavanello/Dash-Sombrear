/**
 * O relógio da loja. A Sombrear é toda em São Paulo, e dia e mês de venda ou de
 * conversa precisam ser os de lá, não os de quem abriu a tela nem os do servidor
 * (que roda em UTC). Mesmo padrão da TECPAV (`crm/src/lib/fusoCasa.ts`).
 */

export const FUSO_CASA = 'America/Sao_Paulo'

// en-CA formata como AAAA-MM-DD, que é o que a comparação por texto precisa
const DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_CASA, year: 'numeric', month: '2-digit', day: '2-digit',
})

/** "2026-09-01" no calendário de São Paulo; null se a data não existe */
export function diaDaCasa(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = new Date(iso)
  if (!Number.isFinite(t.getTime())) return null
  return DIA.format(t)
}

/** "2026-09" no calendário de São Paulo */
export function mesDaCasa(iso: string | null | undefined): string | null {
  return diaDaCasa(iso)?.slice(0, 7) ?? null
}

/** Os últimos `n` meses do calendário até `agora`, do mais antigo ao atual ("2026-04" … "2026-09"). */
export function ultimosMeses(n: number, agora: Date = new Date()): string[] {
  const atual = DIA.format(agora)
  let ano = Number(atual.slice(0, 4))
  let mes = Number(atual.slice(5, 7))
  const saida: string[] = []
  for (let i = 0; i < n; i++) {
    saida.unshift(`${ano}-${String(mes).padStart(2, '0')}`)
    mes--
    if (mes === 0) { mes = 12; ano-- }
  }
  return saida
}
