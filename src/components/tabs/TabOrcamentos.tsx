import { useState, useEffect } from 'react'
import type { Orcamento } from '@/lib/supabase'
import { useDebounce } from '@/hooks/useDebounce'
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
  const saved = loadFilters()
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
      if (periodo === 'hoje') matchPeriodo = created.toDateString() === now.toDateString()
      else if (periodo === 'semana') matchPeriodo = created >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      else if (periodo === 'mes') matchPeriodo = created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
      else if (periodo === 'custom') {
        if (dateFrom) matchPeriodo = created >= new Date(dateFrom)
        if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); matchPeriodo = matchPeriodo && created <= end }
      }
    }
    return matchSearch && matchResp && matchModelo && matchStatus && matchPeriodo
  })

  const responsaveis = [...new Set(data.map((o) => o.responsavel))].filter(Boolean)
  const modelos = [...new Set(data.map((o) => o.modelo))].filter(Boolean)

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
