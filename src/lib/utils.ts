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
