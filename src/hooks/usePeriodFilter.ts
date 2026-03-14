import { useMemo } from 'react';

export type Periodo = 'semana' | 'mes' | 'ano' | 'tudo';

export function filterByPeriod<T>(
  items: T[],
  periodo: string,
  getDate: (item: T) => string | null | undefined,
  dateFrom?: string,
  dateTo?: string
): T[] {
  if (periodo === 'todos' || periodo === 'tudo') return items;
  const now = new Date();
  return items.filter(item => {
    const raw = getDate(item);
    if (!raw) return false;
    const d = new Date(raw);
    if (periodo === 'hoje') return d.toDateString() === now.toDateString();
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
    if (periodo === 'custom') {
      let match = true;
      if (dateFrom) match = d >= new Date(dateFrom);
      if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); match = match && d <= end; }
      return match;
    }
    return true;
  });
}

export function usePeriodFilter<T>(
  items: T[],
  periodo: string,
  getDate: (item: T) => string | null | undefined,
  dateFrom?: string,
  dateTo?: string
): T[] {
  return useMemo(
    () => filterByPeriod(items, periodo, getDate, dateFrom, dateTo),
    [items, periodo, getDate, dateFrom, dateTo]
  );
}
