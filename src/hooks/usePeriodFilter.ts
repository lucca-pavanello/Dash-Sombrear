import { useMemo } from 'react';

export type Periodo = 'semana' | 'mes' | 'ano' | 'tudo';

export function filterByPeriod<T extends { created_at?: string; fechado_em?: string }>(
  items: T[],
  periodo: Periodo,
  dateField: keyof T = 'created_at' as keyof T
): T[] {
  if (periodo === 'tudo') return items;
  const now = new Date();
  return items.filter(item => {
    const raw = item[dateField] as string | undefined;
    if (!raw) return false;
    const d = new Date(raw);
    if (periodo === 'semana') {
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }
    if (periodo === 'mes') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (periodo === 'ano') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  });
}

export function usePeriodFilter<T extends { created_at?: string }>(
  items: T[],
  periodo: Periodo,
  dateField?: keyof T
): T[] {
  return useMemo(() => filterByPeriod(items, periodo, dateField), [items, periodo, dateField]);
}
