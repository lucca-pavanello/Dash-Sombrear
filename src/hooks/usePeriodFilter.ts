export type Periodo =
  | 'hoje'
  | 'semana'
  | 'mes'
  | 'mes_passado'
  | '90d'
  | 'ano'
  | 'tudo'
  | 'todos'
  | 'custom';

/**
 * Converte "2026-09-01" em data LOCAL, não UTC.
 *
 * `new Date('2026-09-01')` é meia-noite UTC — 21h do dia 31/08 no Brasil. Comparado
 * direto contra `created_at`, o intervalo escorrega um dia pra trás e inclui registro
 * do dia anterior. Mesmo motivo (e mesma solução) de `dataLocal` em src/lib/periodos.ts.
 */
function dataLocal(iso: string, fimDoDia = false): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return fimDoDia
    ? new Date(ano, (mes ?? 1) - 1, dia ?? 1, 23, 59, 59, 999)
    : new Date(ano, (mes ?? 1) - 1, dia ?? 1, 0, 0, 0, 0);
}

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
    if (Number.isNaN(d.getTime())) return false;
    if (periodo === 'hoje') return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth()    === now.getMonth()    &&
      d.getDate()     === now.getDate()
    );
    if (periodo === 'semana') {
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }
    if (periodo === 'mes') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    // Mês civil anterior — "agosto", não "os últimos 30 dias". É assim que a loja pensa.
    if (periodo === 'mes_passado') {
      const anterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === anterior.getMonth() && d.getFullYear() === anterior.getFullYear();
    }
    if (periodo === '90d') {
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 90;
    }
    if (periodo === 'ano') {
      return d.getFullYear() === now.getFullYear();
    }
    if (periodo === 'custom') {
      let match = true;
      if (dateFrom) match = d >= dataLocal(dateFrom);
      if (dateTo) match = match && d <= dataLocal(dateTo, true);
      return match;
    }
    return true;
  });
}
