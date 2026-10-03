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

/**
 * Para onde a venda foi parar quando ela some da lista depois de salva.
 *
 * O Semanário se filtra pela `data_pedido` (ou, na falta dela, pela `created_at`).
 * Ajustar uma venda lançada hoje para a data real do pedido — digamos 11/09 — a joga
 * para setembro, e ela desaparece da tela de outubro sem uma palavra. Quem está
 * fechando lê "sumiu" como "não salvou" e lança de novo: foi assim que o pedido 175
 * entrou SEIS vezes no banco na tarde de 02/10/2026.
 *
 * Devolve `null` enquanto a venda continua visível. Quando não continua, devolve o mês
 * civil da data, pronto para virar um período `custom` que a traz de volta à tela.
 *
 * Usa de propósito o mesmo `filterByPeriod` da lista: se a regra de visibilidade mudar,
 * o aviso muda junto, em vez de virar uma segunda verdade.
 */
export function ondeAVendaFoiParar(
  dataEfetiva: string | null | undefined,
  periodo: string,
  dateFrom?: string,
  dateTo?: string
): { de: string; ate: string; mes: string } | null {
  if (!dataEfetiva) return null;
  const d = new Date(dataEfetiva);
  if (Number.isNaN(d.getTime())) return null;
  if (filterByPeriod([dataEfetiva], periodo, x => x, dateFrom, dateTo).length > 0) return null;

  const iso = (dia: Date) =>
    `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
  return {
    de: iso(new Date(d.getFullYear(), d.getMonth(), 1)),
    ate: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    mes: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  };
}
