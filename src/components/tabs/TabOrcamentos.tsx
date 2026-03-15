import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Orcamento } from '@/lib/supabase'
import { useDebounce } from '@/hooks/useDebounce'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import KPIGrid from '@/components/orcamentos/KPIGrid'
import OrcamentosFechadosCard from '@/components/orcamentos/OrcamentosFechadosCard'
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

export default function TabOrcamentos({ data, loading, toast: _toast }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const saved = loadFilters()
  const [search, setSearch] = useState('')
  const [responsavel, setResponsavel] = useState(searchParams.get('responsavel') ?? saved.responsavel ?? 'todos')
  const [modelo, setModelo] = useState(searchParams.get('modelo') ?? saved.modelo ?? 'todos')
  const [fechadoFilter, setFechadoFilter] = useState(searchParams.get('fechado') ?? saved.fechado ?? 'todos')
  const [periodo, setPeriodo] = useState(searchParams.get('periodo') ?? saved.periodo ?? 'todos')
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? saved.dateFrom ?? '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? saved.dateTo ?? '')

  const debouncedSearch = useDebounce(search, 220)

  // Sync filters to URL query string
  useEffect(() => {
    const params: Record<string, string> = {}
    if (responsavel !== 'todos') params.responsavel = responsavel
    if (modelo !== 'todos') params.modelo = modelo
    if (fechadoFilter !== 'todos') params.fechado = fechadoFilter
    if (periodo !== 'todos') params.periodo = periodo
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo
    setSearchParams(params, { replace: true })
  }, [responsavel, modelo, fechadoFilter, periodo, dateFrom, dateTo, setSearchParams])

  // Keyboard shortcut "/" to focus search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (e.key === '/') {
        e.preventDefault()
        const el = document.getElementById('filter-search-input') as HTMLInputElement | null
        el?.focus()
        el?.select()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function clearFilters() {
    setSearch('')
    setResponsavel('todos')
    setModelo('todos')
    setFechadoFilter('todos')
    setPeriodo('todos')
    setDateFrom('')
    setDateTo('')
  }

  const filtered = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase()
    const byPeriod = filterByPeriod(data, periodo, (o) => o.created_at, dateFrom, dateTo)
    return byPeriod.filter((o) => {
      const matchSearch = !debouncedSearch || [o.cliente, o.responsavel, o.modelo, o.tecido, o.telefone, o.ambiente]
        .some((v) => v?.toLowerCase().includes(searchLower))
      const matchResp = responsavel === 'todos' || o.responsavel === responsavel
      const matchModelo = modelo === 'todos' || o.modelo === modelo
      const matchStatus = fechadoFilter === 'todos'
        || (fechadoFilter === 'fechado' && o.fechado === true)
        || (fechadoFilter === 'aberto' && o.fechado !== true)
        || (fechadoFilter === 'sem-custo' && o.fechado === true && (!o.custo_tecido || o.custo_tecido === 0))
      return matchSearch && matchResp && matchModelo && matchStatus
    })
  }, [data, debouncedSearch, responsavel, modelo, fechadoFilter, periodo, dateFrom, dateTo])

  const responsaveis = useMemo(() => [...new Set(data.map((o) => o.responsavel))].filter(Boolean), [data])
  const modelos = useMemo(() => [...new Set(data.map((o) => o.modelo))].filter(Boolean), [data])

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
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded bg-muted" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <KPIGrid data={filtered} />

      <hr className="border-border/25" />

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
    </div>
  )
}
