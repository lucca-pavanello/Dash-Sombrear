import { Search, ChevronDown, X, SlidersHorizontal } from 'lucide-react'

interface Props {
  search: string; onSearchChange: (v: string) => void
  responsavel: string; onResponsavelChange: (v: string) => void
  modelo: string; onModeloChange: (v: string) => void
  fechado: string; onFechadoChange: (v: string) => void
  periodo: string; onPeriodoChange: (v: string) => void
  dateFrom: string; onDateFromChange: (v: string) => void
  dateTo: string; onDateToChange: (v: string) => void
  responsaveis: string[]
  modelos: string[]
  onClearFilters: () => void
}

const selectClass = 'w-full rounded-lg border bg-card pl-3 pr-8 py-2.5 text-sm outline-none ring-ring focus:ring-2 cursor-pointer appearance-none'
const dateClass = 'flex-1 min-w-[130px] rounded-lg border bg-card px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2'

const PERIODOS = [
  { value: 'todos', label: 'Tudo' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'custom', label: 'Período' },
]

const FECHADO_LABELS: Record<string, string> = {
  fechado: 'Fechados',
  aberto: 'Em aberto',
  'sem-custo': 'Sem custo',
}

function Select({ value, onChange, children, title }: { value: string; onChange: (v: string) => void; children: React.ReactNode; title?: string }) {
  return (
    <div className="relative flex-1 min-w-[140px]">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass} title={title}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    </div>
  )
}

export default function FiltersBar({
  search, onSearchChange,
  responsavel, onResponsavelChange,
  modelo, onModeloChange,
  fechado, onFechadoChange,
  periodo, onPeriodoChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  responsaveis, modelos,
  onClearFilters,
}: Props) {
  const chips = [
    search ? {
      label: search.length > 18 ? `"${search.slice(0, 18)}…"` : `"${search}"`,
      onRemove: () => onSearchChange(''),
    } : null,
    responsavel !== 'todos' ? {
      label: responsavel,
      onRemove: () => onResponsavelChange('todos'),
    } : null,
    modelo !== 'todos' ? {
      label: modelo,
      onRemove: () => onModeloChange('todos'),
    } : null,
    fechado !== 'todos' ? {
      label: FECHADO_LABELS[fechado] ?? fechado,
      onRemove: () => onFechadoChange('todos'),
    } : null,
    periodo !== 'todos' ? {
      label: periodo === 'custom'
        ? `${dateFrom || '?'} → ${dateTo || '?'}`
        : PERIODOS.find((p) => p.value === periodo)?.label ?? periodo,
      onRemove: () => { onPeriodoChange('todos'); onDateFromChange(''); onDateToChange('') },
    } : null,
  ].filter(Boolean) as { label: string; onRemove: () => void }[]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-2">
        <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filtros</span>
      </div>
      {/* TAREFA D: id para foco via atalho "/" + hint de teclado */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="filter-search-input"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar cliente, responsável, telefone..."
          className={`w-full rounded-lg border bg-card py-2.5 pl-9 text-sm outline-none ring-ring focus:ring-2 ${search ? 'pr-8' : 'pr-10'}`}
        />
        {search ? (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            /
          </kbd>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
          {PERIODOS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onPeriodoChange(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 ${
                periodo === value
                  ? 'bg-card text-primary shadow-sm scale-[1.04]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Select value={responsavel} onChange={onResponsavelChange}>
          <option value="todos">Todos responsáveis</option>
          {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select value={modelo} onChange={onModeloChange}>
          <option value="todos">Todos modelos</option>
          {modelos.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select value={fechado} onChange={onFechadoChange} title="Inclui filtro de qualidade de dados">
          <option value="todos">Todos</option>
          <option value="fechado">Fechados</option>
          <option value="aberto">Em aberto</option>
          <option value="sem-custo">⚠️ Fechados sem custo</option>
        </Select>
      </div>

      {periodo === 'custom' && (
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground shrink-0">De</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={dateClass}
          />
          <span className="text-xs text-muted-foreground shrink-0">até</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className={dateClass}
          />
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">Filtros ativos:</span>
          {chips.map((chip, i) => (
            <span
              key={`${chip.label}-${i}`}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="hover:text-primary/60 transition-colors"
                aria-label={`Remover filtro ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={onClearFilters}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2 ml-1"
          >
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  )
}
