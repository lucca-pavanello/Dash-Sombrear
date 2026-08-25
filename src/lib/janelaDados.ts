/**
 * Janela de dados do dash.
 *
 * O dash carregava TODOS os orçamentos a cada 30 segundos, em todas as abas.
 * Com algumas centenas de linhas isso é invisível; no ritmo atual da loja
 * (~100 orçamentos/mês) vira milhares, e aí trava no celular sem dar erro —
 * só fica lento. Então a busca passa a ser limitada por período no servidor.
 *
 * A janela é uma preferência única, compartilhada por todas as abas: se a
 * pessoa pedir o histórico completo em Semanário, o resto do dash acompanha.
 * Fica guardada no navegador, então a escolha sobrevive ao recarregar.
 */
import { useSyncExternalStore } from 'react'

const CHAVE = 'sombrear-janela-meses'

/** 12 meses cobre o ano corrente e as comparações mês a mês do dash */
export const JANELA_PADRAO = 12
/** 0 = sem limite (histórico completo) */
export const JANELA_TUDO = 0

let ouvintes: (() => void)[] = []

function lerDoNavegador(): number {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto == null) return JANELA_PADRAO
    const n = Number(bruto)
    return Number.isFinite(n) && n >= 0 ? n : JANELA_PADRAO
  } catch {
    return JANELA_PADRAO
  }
}

let valor = lerDoNavegador()

function inscrever(aviso: () => void) {
  ouvintes.push(aviso)
  return () => { ouvintes = ouvintes.filter((x) => x !== aviso) }
}

/** Janela atual em meses (0 = tudo). Re-renderiza quem estiver ouvindo. */
export function useJanela(): number {
  return useSyncExternalStore(inscrever, () => valor, () => JANELA_PADRAO)
}

export function definirJanela(meses: number) {
  if (meses === valor) return
  valor = meses
  try { localStorage.setItem(CHAVE, String(meses)) } catch { /* navegação privada */ }
  for (const aviso of [...ouvintes]) aviso()
}

/**
 * Data de corte da janela, em ISO — ou null quando é "tudo".
 * Calculada na hora da busca (e não no import) pra não congelar a virada do mês
 * quando o dash fica aberto por horas.
 */
export function inicioDaJanela(meses: number): string | null {
  if (!meses) return null
  const d = new Date()
  d.setMonth(d.getMonth() - meses)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function rotuloDaJanela(meses: number): string {
  if (!meses) return 'todo o histórico'
  if (meses === 12) return 'os últimos 12 meses'
  return `os últimos ${meses} meses`
}
