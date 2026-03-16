import { useState, useEffect, useRef, useMemo } from 'react'
import { Download, ChevronUp, ChevronDown, ChevronsUpDown, StickyNote, Square, CheckSquare, FileDown, ChevronLeft, ChevronRight, FileX, Copy, Check } from 'lucide-react'
import AvatarInitials from '@/components/shared/AvatarInitials'
import EmptyState from '@/components/shared/EmptyState'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Orcamento } from '@/lib/supabase'
import { formatCurrency, cn, calcularMargem, formatDate } from '@/lib/utils'
import EditOrcamentoForm from './EditOrcamentoForm'
import { useUpdateOrcamento } from '@/hooks/useOrcamentos'
import { PAGE_SIZE } from '@/lib/constants'
import type { ToastType } from '@/hooks/useToast'

type ToastFn = (type: ToastType, message: string, opts?: { duration?: number; undoAction?: () => void }) => void


function FechadoCheckbox({ orcamento, toast }: { orcamento: Orcamento; toast: ToastFn }) {
  const { mutate: update, isPending } = useUpdateOrcamento()

  function handleClick() {
    const wasFechado = !!orcamento.fechado
    const novoEstado = !wasFechado
    update({ id: orcamento.id, fechado: novoEstado }, {
      onSuccess: () => {
        if (novoEstado) {
          toast('success', `${orcamento.cliente ?? orcamento.responsavel} — marcado como fechado`, {
            duration: 5000,
            undoAction: () => update({ id: orcamento.id, fechado: false }),
          })
        }
      },
    })
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-semibold transition-all duration-200',
          orcamento.fechado
            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
            : 'bg-muted text-muted-foreground hover:bg-muted/60',
          isPending && 'opacity-50'
        )}
      >
        {orcamento.fechado ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        {orcamento.fechado ? 'Fechado' : 'Em aberto'}
      </button>
    </div>
  )
}


function Highlight({ text, query }: { text: string | null | undefined; query: string }) {
  const safe = text ?? '—'
  if (!query || !text) return <>{safe}</>
  const idx = safe.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{safe}</>
  return (
    <>
      {safe.slice(0, idx)}
      <mark className="rounded bg-primary/20 px-0.5 text-primary not-italic">{safe.slice(idx, idx + query.length)}</mark>
      {safe.slice(idx + query.length)}
    </>
  )
}

function exportCSV(data: Orcamento[]) {
  const headers = ['#', 'Data', 'Cliente', 'Telefone', 'Responsável', 'Ambiente', 'Modelo', 'Tecido', 'Qtd', 'Valor', 'Instalação', 'Custo (R$)', 'Margem (%)', 'Fechado']
  const rows = data.map((o, i) => {
    const m = calcMargem(o)
    return [
      i + 1,
      formatDate(o.created_at),
      o.cliente ?? '',
      o.telefone ?? '',
      o.responsavel,
      o.ambiente ?? '',
      o.modelo,
      o.tecido,
      o.quantidade,
      o.valor_venda ?? '',
      o.instacao ?? '',
      o.custo_tecido ?? '',
      m != null ? m.toFixed(1) : '',
      o.fechado ? 'Sim' : 'Não',
    ]
  })
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orcamentos-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function exportXLSX(data: Orcamento[]) {
  const rows = data.map((o, i) => ({
    '#': i + 1,
    Data: formatDate(o.created_at),
    Cliente: o.cliente ?? '',
    Telefone: o.telefone ?? '',
    Responsável: o.responsavel,
    Ambiente: o.ambiente ?? '',
    Modelo: o.modelo,
    Tecido: o.tecido,
    Quantidade: o.quantidade,
    'Valor Venda': o.valor_venda ?? '',
    'Valor Instalação': o.instacao ?? '',
    'Custo (R$)': o.custo_tecido ?? '',
    'Margem (%)': calcMargem(o) != null ? (calcMargem(o) as number).toFixed(1) : '',
    Fechado: o.fechado ? 'Sim' : 'Não',
    Observações: o.observacoes ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Orçamentos')
  XLSX.writeFile(wb, `orcamentos-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function exportPDF(data: Orcamento[], isFiltered: boolean) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const now = new Date()
  const orange: [number, number, number] = [232, 112, 26]

  doc.setFillColor(...orange)
  doc.rect(0, 0, 297, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('Sombrear — Orçamentos', 10, 10)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${isFiltered ? 'Com filtros aplicados · ' : ''}${data.length} registro${data.length !== 1 ? 's' : ''} · ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    10, 17
  )

  const totalVenda = data.reduce((s, o) => s + (o.valor_venda ?? 0), 0)
  const totalInst = data.reduce((s, o) => s + (o.instacao ?? 0), 0)
  const totalGeral = totalVenda + totalInst
  const fechados = data.filter((o) => o.fechado === true).length

  autoTable(doc, {
    startY: 26,
    head: [['#', 'Data', 'Cliente', 'Responsável', 'Ambiente', 'Modelo', 'Tecido', 'Qtd', 'Valor Venda', 'Instalação', 'Total', 'Custo', 'Margem', 'Fechado']],
    body: data.map((o, i) => {
      const m = calcMargem(o)
      return [
        `#${i + 1}`,
        formatDate(o.created_at),
        o.cliente ?? '—',
        o.responsavel,
        o.ambiente ?? '—',
        o.modelo,
        o.tecido,
        String(o.quantidade),
        o.valor_venda ? formatCurrency(o.valor_venda) : '—',
        o.instacao ? formatCurrency(o.instacao) : '—',
        formatCurrency((o.valor_venda ?? 0) + (o.instacao ?? 0)),
        o.custo_tecido ? formatCurrency(o.custo_tecido) : '—',
        m != null ? m.toFixed(1) + '%' : '—',
        o.fechado ? 'Sim' : 'Não',
      ]
    }),
    foot: [['', '', '', '', '', '', `${fechados} fechados`, '', formatCurrency(totalVenda), formatCurrency(totalInst), formatCurrency(totalGeral), '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: orange, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    footStyles: { fontStyle: 'bold', fillColor: [245, 245, 245] as [number, number, number], textColor: [40, 40, 40] as [number, number, number], fontSize: 8 },
    columnStyles: { 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right', fontStyle: 'bold' }, 11: { halign: 'right' }, 12: { halign: 'right' } },
    margin: { left: 8, right: 8 },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text(`Sombrear · Página ${i} de ${pageCount}`, 148, 205, { align: 'center' })
  }

  doc.save(`orcamentos-${now.toISOString().slice(0, 10)}.pdf`)
}

function calcMargem(o: Orcamento) {
  if (o.margem != null) return o.margem
  const receita = (o.valor_venda ?? 0) + (o.instacao ?? 0)
  return o.custo_tecido && o.custo_tecido > 0
    ? calcularMargem(receita, o.custo_tecido)
    : null
}

type SortKey = 'created_at' | 'cliente' | 'responsavel' | 'valor_venda' | 'margem'

interface Props {
  data: Orcamento[]
  toast: ToastFn
  isFiltered?: boolean
  search?: string
  onClearFilters?: () => void
  filterKey?: string
}

export default function OrcamentosTable({ data, toast, isFiltered, search = '', onClearFilters, filterKey }: Props) {
  const [editing, setEditing] = useState<Orcamento | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'created_at', dir: 'desc' })
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)

  function copyPhone(e: React.MouseEvent, phone: string) {
    e.stopPropagation()
    navigator.clipboard.writeText(phone)
      .then(() => {
        setCopiedPhone(phone)
        setTimeout(() => setCopiedPhone((prev) => prev === phone ? null : prev), 2000)
      })
      .catch(() => { toast('error', 'Falha ao copiar telefone.') })
  }
  const [page, setPage] = useState(1)
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  const prevFechadoMap = useRef<Map<string, boolean>>(new Map())
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => { setPage(1) }, [filterKey])
  useEffect(() => { setPage(1) }, [sort])

  useEffect(() => {
    const newFlash = new Set<string>()
    data.forEach((o) => {
      const prev = prevFechadoMap.current.get(o.id)
      if (o.fechado && prev === false) newFlash.add(o.id)
      prevFechadoMap.current.set(o.id, !!o.fechado)
    })
    if (newFlash.size > 0) {
      setFlashIds((prev) => new Set([...prev, ...newFlash]))
      newFlash.forEach((id) => {
        if (flashTimers.current.has(id)) clearTimeout(flashTimers.current.get(id)!)
        const timer = setTimeout(() => {
          setFlashIds((prev) => { const next = new Set(prev); next.delete(id); return next })
          flashTimers.current.delete(id)
        }, 700)
        flashTimers.current.set(id, timer)
      })
    }
  }, [data])

  // Limpa timers apenas na desmontagem — não a cada update de data
  useEffect(() => {
    return () => {
      flashTimers.current.forEach((t) => clearTimeout(t))
      flashTimers.current.clear()
    }
  }, [])

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const sorted = useMemo(() => [...data].sort((a, b) => {
    let av: string | number, bv: string | number
    if (sort.key === 'created_at') { av = a.created_at; bv = b.created_at }
    else if (sort.key === 'cliente') { av = a.cliente ?? ''; bv = b.cliente ?? '' }
    else if (sort.key === 'responsavel') { av = a.responsavel; bv = b.responsavel }
    else if (sort.key === 'margem') {
      const ma = calcMargem(a); const mb = calcMargem(b)
      if (ma === null && mb === null) return 0
      if (ma === null) return 1
      if (mb === null) return -1
      av = ma; bv = mb
    }
    else { av = a.valor_venda ?? -1; bv = b.valor_venda ?? -1 }
    if (av < bv) return sort.dir === 'asc' ? -1 : 1
    if (av > bv) return sort.dir === 'asc' ? 1 : -1
    return 0
  }), [data, sort])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <ChevronsUpDown className="h-3 w-3 opacity-40" />
    return sort.dir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />
  }

  const COLS: { label: string; key?: SortKey }[] = [
    { label: '#' },
    { label: 'Data', key: 'created_at' },
    { label: 'Cliente', key: 'cliente' },
    { label: 'Responsável', key: 'responsavel' },
    { label: 'Ambiente' },
    { label: 'Modelo' },
    { label: 'Tecido' },
    { label: 'Qtd' },
    { label: 'Valor', key: 'valor_venda' },
    { label: 'Margem', key: 'margem' },
    { label: 'Status' },
  ]

  const now = Date.now()

  return (
    <>
      <div className="rounded-xl border-2 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-display text-sm font-medium tracking-wide">Todos os Orçamentos</h2>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => exportCSV(sorted)}
              disabled={data.length === 0}
              title={`Exportar ${sorted.length} registros como CSV`}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              onClick={() => exportXLSX(sorted)}
              disabled={data.length === 0}
              title={`Exportar ${sorted.length} registros como XLSX`}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Download className="h-3.5 w-3.5" />
              XLSX
            </button>
            <button
              onClick={() => exportPDF(sorted, !!isFiltered)}
              disabled={data.length === 0}
              title={`Exportar ${sorted.length} registros como PDF`}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </button>
          </div>
        </div>

        {data.length === 0 ? (
          <EmptyState
            icon={FileX}
            title={isFiltered ? 'Nenhum resultado encontrado' : 'Nenhum orçamento ainda'}
            description={isFiltered ? 'Tente ajustar ou limpar os filtros' : 'Clique em "+ Novo Orçamento" para começar'}
            action={isFiltered && onClearFilters ? { label: 'Limpar todos os filtros', onClick: onClearFilters } : undefined}
          />
        ) : (
          <>
            <div className="hidden md:block overflow-auto max-h-[70vh]">
              <table className="w-full text-sm" style={{ minWidth: '920px' }}>
                <thead>
                  <tr>
                    {COLS.map(({ label, key }) => (
                      <th
                        key={label}
                        onClick={() => key && toggleSort(key)}
                        aria-label={key ? `Ordenar por ${label}` : undefined}
                        className={cn(
                          'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 select-none border-y border-border/80',
                          label === '#' ? 'w-10 text-center' : '',
                          key && 'cursor-pointer hover:text-foreground transition-colors'
                        )}
                        style={{
                          position: 'sticky',
                          top: 0,
                          backgroundColor: 'hsl(var(--muted))',
                          zIndex: label === '#' ? 30 : label === 'Status' ? 30 : 10,
                          ...(label === '#' ? { left: 0, boxShadow: '4px 0 6px -1px rgba(0,0,0,0.12)' } : {}),
                          ...(label === 'Status' ? { right: 0, boxShadow: '-4px 0 6px -1px rgba(0,0,0,0.12)' } : {}),
                        }}
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {key && <SortIcon k={key} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((o, i) => {
                    const diasAberto = !o.fechado ? Math.floor((now - new Date(o.created_at).getTime()) / 86400000) : 0
                    const receita = (o.valor_venda ?? 0) + (o.instacao ?? 0)
                    const margem = calcMargem(o)
                    const semCusto = receita > 0 && (!o.custo_tecido || o.custo_tecido === 0)
                    const temCustoSemReceita = (!o.valor_venda) && o.custo_tecido && o.custo_tecido > 0
                    const globalIndex = (page - 1) * PAGE_SIZE + i + 1
                    const hasFlash = flashIds.has(o.id)
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setEditing(o)}
                        className={cn(
                          'border-b last:border-0 transition-colors duration-150 cursor-pointer group',
                          o.fechado && !hasFlash && 'row-fechado',
                          hasFlash && 'animate-row-close'
                        )}
                      >
                        {/* sticky left */}
                        <td className="px-2 py-3 text-center w-10" style={{ position: 'sticky', left: 0, zIndex: 20, backgroundColor: 'hsl(var(--card))', boxShadow: '4px 0 6px -2px rgba(0,0,0,0.12)' }}>
                          <span className="inline-flex items-center justify-center h-5 min-w-[1.4rem] rounded-md px-1.5 text-[10px] font-bold tabular-nums bg-primary/10 dark:bg-primary/25 text-primary">
                            {globalIndex}
                          </span>
                        </td>
                        <td className={cn('px-4 py-3 text-muted-foreground text-xs', i % 2 === 1 ? 'bg-muted/[0.15]' : '', 'group-hover:bg-primary/[0.04]')}>
                          <span className="flex flex-col leading-tight gap-0.5">
                            <span>{formatDate(o.created_at)}</span>
                            {diasAberto > 0 && (
                              <span className={cn('font-medium', diasAberto > 7 ? 'text-primary' : 'text-muted-foreground/60')}>
                                {diasAberto}d aberto
                              </span>
                            )}
                          </span>
                        </td>
                        <td className={cn('px-4 py-3 font-medium', i % 2 === 1 ? 'bg-muted/[0.15]' : '', 'group-hover:bg-primary/[0.04]')}>
                          <span className="flex items-center gap-1.5">
                            <span className="flex flex-col">
                              <Highlight text={o.cliente} query={search} />
                              {o.telefone && (
                                <button
                                  onClick={(e) => copyPhone(e, o.telefone!)}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                                  title="Copiar telefone"
                                >
                                  {copiedPhone === o.telefone ? (
                                    <><Check className="h-2.5 w-2.5 text-emerald-500" /><span className="text-emerald-500 font-medium">Copiado!</span></>
                                  ) : (
                                    <><Copy className="h-2.5 w-2.5 opacity-50" />{o.telefone}</>
                                  )}
                                </button>
                              )}
                            </span>
                            {o.observacoes && <span title={o.observacoes}><StickyNote className="h-3 w-3 shrink-0 text-muted-foreground" /></span>}
                          </span>
                        </td>
                        <td className={cn('px-4 py-3', i % 2 === 1 ? 'bg-muted/[0.15]' : '', 'group-hover:bg-primary/[0.04]')}>
                          <span className="flex items-center gap-2">
                            <AvatarInitials name={o.responsavel} />
                            <Highlight text={o.responsavel} query={search} />
                          </span>
                        </td>
                        <td className={cn('px-4 py-3', i % 2 === 1 ? 'bg-muted/[0.15]' : '', 'group-hover:bg-primary/[0.04]')}>
                          {o.ambiente
                            ? <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{o.ambiente}</span>
                            : <span className="text-muted-foreground/30 text-xs">—</span>
                          }
                        </td>
                        <td className={cn('px-4 py-3', i % 2 === 1 ? 'bg-muted/[0.15]' : '', 'group-hover:bg-primary/[0.04]')}>{o.modelo}</td>
                        <td className={cn('px-4 py-3', i % 2 === 1 ? 'bg-muted/[0.15]' : '', 'group-hover:bg-primary/[0.04]')}>{o.tecido}</td>
                        <td className={cn('px-4 py-3 text-center', i % 2 === 1 ? 'bg-muted/[0.15]' : '', 'group-hover:bg-primary/[0.04]')}>{o.quantidade}</td>
                        <td className={cn('px-4 py-3', i % 2 === 1 ? 'bg-muted/[0.15]' : '', 'group-hover:bg-primary/[0.04]')}>
                          <span className="flex flex-col leading-tight">
                            <span>{o.valor_venda ? formatCurrency(o.valor_venda) : '—'}</span>
                            {o.instacao ? (
                              <span className="text-xs text-primary/70">+{formatCurrency(o.instacao)} inst.</span>
                            ) : null}
                          </span>
                        </td>
                        <td className={cn('px-4 py-3', i % 2 === 1 ? 'bg-muted/[0.15]' : '', 'group-hover:bg-primary/[0.04]')}>
                          {margem !== null ? (
                            <span className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                              margem >= 30 ? 'bg-primary/10 text-primary'
                                : margem >= 15 ? 'bg-muted text-foreground'
                                : 'bg-destructive/10 text-destructive'
                            )}>
                              {margem.toFixed(1)}%
                            </span>
                          ) : semCusto ? (
                            <span className="text-xs text-muted-foreground/50 italic">sem custo</span>
                          ) : temCustoSemReceita ? (
                            <span className="text-xs text-muted-foreground/60 italic" title="Informe o valor de venda para calcular a margem">
                              custo {formatCurrency(o.custo_tecido || 0)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/30">—</span>
                          )}
                        </td>
                        {/* sticky right */}
                        <td className="px-4 py-3" style={{ position: 'sticky', right: 0, zIndex: 20, backgroundColor: 'hsl(var(--card))', boxShadow: '-4px 0 6px -2px rgba(0,0,0,0.12)' }}><FechadoCheckbox orcamento={o} toast={toast} /></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/60">
                    <td colSpan={8} className="px-4 py-2.5 text-xs text-muted-foreground">
                      {sorted.length} orçamento{sorted.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-bold text-primary">
                      {formatCurrency(sorted.reduce((s, o) => s + (o.valor_venda ?? 0) + (o.instacao ?? 0), 0))}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y">
              {paginated.map((o, i) => {
                const diasAberto = !o.fechado ? Math.floor((now - new Date(o.created_at).getTime()) / 86400000) : 0
                const globalIndex = (page - 1) * PAGE_SIZE + i + 1
                const hasFlash = flashIds.has(o.id)
                return (
                  <div
                    key={o.id}
                    onClick={() => setEditing(o)}
                    className={cn(
                      'px-4 py-4 cursor-pointer hover:bg-muted/20 transition-colors',
                      o.fechado && !hasFlash && 'row-fechado',
                      hasFlash && 'animate-row-close'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <AvatarInitials name={o.responsavel} />
                          <span className="text-xs font-mono text-muted-foreground">#{globalIndex}</span>
                          <p className="font-semibold text-sm truncate">
                            <Highlight text={o.cliente ?? 'Sem cliente'} query={search} />
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 pl-8">
                          <Highlight text={o.responsavel} query={search} /> · {formatDate(o.created_at)}
                          {diasAberto > 0 && (
                            <span className={cn('ml-1.5 font-medium', diasAberto > 7 ? 'text-primary' : '')}>
                              · {diasAberto}d aberto
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="ml-2 shrink-0">
                                        <FechadoCheckbox orcamento={o} toast={toast} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pl-8">
                      <span className="text-xs text-muted-foreground">
                        {o.ambiente && <span className="mr-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{o.ambiente}</span>}
                        {o.modelo} · {o.tecido}
                      </span>
                      <div className="flex flex-col items-end">
                        {o.valor_venda
                          ? <span className="text-sm font-bold text-primary">{formatCurrency(o.valor_venda)}</span>
                          : <span className="text-xs text-muted-foreground">Sem valor</span>
                        }
                        {(() => {
                          const m = calcMargem(o)
                          if (m == null) return null
                          return (
                            <span className={cn(
                              'text-[10px] font-semibold',
                              m >= 30 ? 'text-primary' : m >= 15 ? 'text-muted-foreground' : 'text-destructive'
                            )}>
                              {m.toFixed(1)}%
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-5 py-3">
                <span className="text-xs text-muted-foreground">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} de {sorted.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                    className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 text-xs font-medium tabular-nums">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === totalPages}
                    className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editing && (
        <EditOrcamentoForm
          orcamento={editing}
          onClose={() => setEditing(null)}
          toast={toast}
        />
      )}
    </>
  )
}
