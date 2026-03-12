import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { Orcamento } from '@/lib/supabase'
import { useDebounce } from '@/hooks/useDebounce'
import KPIGrid from '@/components/orcamentos/KPIGrid'
import OrcamentosFechadosCard from '@/components/orcamentos/OrcamentosFechadosCard'
import OrcamentosTable from '@/components/orcamentos/OrcamentosTable'
import NovoOrcamentoForm from '@/components/orcamentos/NovoOrcamentoForm'
import FiltersBar from '@/components/orcamentos/FiltersBar'
import ResponsavelChart from '@/components/charts/ResponsavelChart'
import ModelosChart from '@/components/charts/ModelosChart'
import RankingResponsavel from '@/components/orcamentos/RankingResponsavel'
import SkeletonCard from '@/components/shared/SkeletonCard'

const FILTER_KEY = 'sombrear-orcamentos-filters'

function loadFilters() {
  try {
    const s = localStorage.getItem(FILTER_KEY)
    return s ? JSON.parse(s) : {}
  } catch { return {} }
}

interface Props {
  data: Orcamento[]
  loading: boolean
  toast: (type: 'success' | 'error', message: string) => void
}

export default function TabOrcamentos({ data, loading, toast }: Props) {
  const saved = loadFilters()
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [responsavel, setResponsavel] = useState(saved.responsavel ?? 'todos')
  const [modelo, setModelo] = useState(saved.modelo ?? 'todos')
  const [fechadoFilter, setFechadoFilter] = useState(saved.fechado ?? 'todos')
  const [periodo, setPeriodo] = useState(saved.periodo ?? 'todos')
  const [dateFrom, setDateFrom] = useState(saved.dateFrom ?? '')
  const [dateTo, setDateTo] = useState(saved.dateTo ?? '')

  const debouncedSearch = useDebounce(search, 220)

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify({ responsavel, modelo, fechado: fechadoFilter, periodo, dateFrom, dateTo }))
  }, [responsavel, modelo, fechadoFilter, periodo, dateFrom, dateTo])

  function clearFilters() {
    setSearch('')
    setResponsavel('todos')
    setModelo('todos')
    setFechadoFilter('todos')
    setPeriodo('todos')
    setDateFrom('')
    setDateTo('')
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const active = document.activeElement
      const inField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')
      // Atalho "n" para novo orçamento
      if ((e.key === 'n' || e.key === 'N') && !inField) {
        setFormOpen(true)
        return
      }
      // TAREFA D: atalho "/" para focar busca
      if (e.key === '/' && !inField) {
        e.preventDefault()
        document.getElementById('filter-search-input')?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const filtered = data.filter((o) => {
    const matchSearch = !debouncedSearch || [o.cliente, o.responsavel, o.modelo, o.tecido, o.telefone, o.ambiente]
      .some((v) => v?.toLowerCase().includes(debouncedSearch.toLowerCase()))
    const matchResp = responsavel === 'todos' || o.responsavel === responsavel
    const matchModelo = modelo === 'todos' || o.modelo === modelo
    const matchStatus = fechadoFilter === 'todos'
      || (fechadoFilter === 'fechado' ? o.fechado === true : false)
      || (fechadoFilter === 'aberto' ? o.fechado !== true : false)
      || (fechadoFilter === 'sem-custo' ? o.fechado === true && (!o.custo_tecido || o.custo_tecido === 0) : false)

    let matchPeriodo = true
    if (periodo !== 'todos' && o.created_at) {
      const created = new Date(o.created_at)
      const now = new Date()
      if (periodo === 'hoje') {
        matchPeriodo = created.toDateString() === now.toDateString()
      } else if (periodo === 'semana') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        matchPeriodo = created >= weekAgo
      } else if (periodo === 'mes') {
        matchPeriodo = created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
      } else if (periodo === 'custom') {
        if (dateFrom) matchPeriodo = created >= new Date(dateFrom)
        if (dateTo) {
          const end = new Date(dateTo); end.setHours(23, 59, 59, 999)
          matchPeriodo = matchPeriodo && created <= end
        }
      }
    }

    return matchSearch && matchResp && matchModelo && matchStatus && matchPeriodo
  })

  const responsaveis = [...new Set(data.map((o) => o.responsavel))].filter(Boolean)
  const modelos = [...new Set(data.map((o) => o.modelo))].filter(Boolean)
  const isFiltered =
    !!debouncedSearch ||
    responsavel !== 'todos' ||
    modelo !== 'todos' ||
    fechadoFilter !== 'todos' ||
    periodo !== 'todos' ||
    !!dateFrom ||
    !!dateTo

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <div className="rounded-xl border bg-card shadow-sm animate-pulse">
          <div className="border-b px-5 py-4"><div className="h-5 w-48 rounded bg-muted" /></div>
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-muted" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-5">
        <KPIGrid data={filtered} />

        <hr className="border-border/25" />

        {/* Desktop button */}
        <div className="hidden md:flex justify-end">
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand hover:opacity-90 hover:scale-105 active:scale-95 transition-all duration-150"
          >
            <Plus className="h-4 w-4" />
            Novo Orçamento
            <kbd className="hidden lg:inline-flex items-center justify-center rounded border border-white/30 bg-white/15 px-1.5 py-0.5 text-[10px] font-mono font-normal leading-none">
              N
            </kbd>
          </button>
        </div>

        <FiltersBar
          search={search} onSearchChange={setSearch}
          responsavel={responsavel} onResponsavelChange={setResponsavel}
          modelo={modelo} onModeloChange={setModelo}
          fechado={fechadoFilter} onFechadoChange={setFechadoFilter}
          periodo={periodo} onPeriodoChange={setPeriodo}
          dateFrom={dateFrom} onDateFromChange={setDateFrom}
          dateTo={dateTo} onDateToChange={setDateTo}
          responsaveis={responsaveis}
          modelos={modelos}
          onClearFilters={clearFilters}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <RankingResponsavel data={filtered} />
          <ResponsavelChart data={filtered} />
          <ModelosChart data={filtered} />
        </div>

        <hr className="border-border/25" />

        <OrcamentosFechadosCard data={filtered} />
        {/* TAREFA F: passa responsaveis */}
        <OrcamentosTable
          data={filtered}
          toast={toast}
          isFiltered={isFiltered}
          search={debouncedSearch}
          onClearFilters={clearFilters}
          responsaveis={responsaveis}
        />
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setFormOpen(true)}
        className="fixed bottom-6 right-4 z-40 md:hidden flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white hover:scale-110 active:scale-90 transition-all duration-200 fab-pulse"
        aria-label="Novo Orçamento"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* TAREFA F: passa responsaveis */}
      <NovoOrcamentoForm toast={toast} open={formOpen} onClose={() => setFormOpen(false)} responsaveis={responsaveis} />
    </>
  )
}
