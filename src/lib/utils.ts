import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

export function calcularMargem(receita: number, custo: number): number | null {
  if (!receita || receita <= 0) return null
  return ((receita - custo) / receita) * 100
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `R$\u00A0${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$\u00A0${(value / 1_000).toFixed(1)}k`
  return formatCurrency(value)
}

/**
 * "a partir de R$ 429,90" → 429.9. Converte valor em texto livre (formato BR, com ponto
 * de milhar e vírgula decimal) para número.
 *
 * Existe porque o CRM guarda o último valor cotado como TEXTO, do jeito que o agente
 * escreveu. Comparar isso como string desordena dinheiro em silêncio: "R$ 1.100,00"
 * viria antes de "R$ 900,00" e a lista continuaria parecendo ordenada.
 *
 * Devolve NaN quando não há número — quem chama decide o que fazer com a ausência.
 */
export function valorNumerico(texto: string | null | undefined): number {
  if (!texto) return NaN
  const n = parseFloat(String(texto).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
