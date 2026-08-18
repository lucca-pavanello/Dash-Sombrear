/**
 * Fechamento — o dinheiro das vendas que a loja efetivou.
 * Entra aqui tudo que for marcado como venda na Planilha (fechado = true),
 * não importa a origem: agente de IA, balcão ou lançamento manual.
 * Mostra o que o cliente pagou, quanto vai para a empresa parceira e o que
 * sobra para a loja — com totais do período para fechar o mês.
 */
import { Fragment, Suspense, useMemo, useState } from 'react'
import { lazyComRecarga } from '@/lib/lazyComRecarga'
import {
  Check, CheckCircle2, ChevronRight, Download, HandCoins, Loader2, PencilLine, Plus, Trash2, Wallet, Wand2, X,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { useOrcamentos } from '@/hooks/useOrcamentos'
import { filterByPeriod } from '@/hooks/usePeriodFilter'
import { CustomSelect } from '@/components/ui/CustomSelect'
import DatePicker from '@/components/ui/DatePicker'
import { useCountUp } from '@/hooks/useCountUp'
import { supabase, type Orcamento } from '@/lib/supabase'
import { Button, EmptyState } from '@/components/ui/primitives'
import { TEMA_TABELA, alinharSecoes, colunasCentro, colunasDireita, faixaMarca, rodapeMarca } from '@/lib/pdfMarca'
import SeloOrigem, { ORIGENS, SEM_ORIGEM, acharOrigem } from '@/components/agente/SeloOrigem'
import JanelaDados from '@/components/orcamentos/JanelaDados'
import ConfirmarExclusaoVenda from '@/components/orcamentos/ConfirmarExclusaoVenda'
import { useProfile } from '@/hooks/useProfile'
import { ADMIN_EMAIL } from '@/lib/constants'

const TabSimulador = lazyComRecarga(() => import('@/components/tabs/TabSimulador'))

const PERIODOS = [
  { value: 'mes', label: 'Este mês' },
  { value: 'semana', label: 'Últimos 7 dias' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'ano', label: 'Este ano' },
  { value: 'todos', label: 'Tudo' },
  { value: 'custom', label: 'Escolher datas' },
]

/** Custo real da loja: nos itens da parceira é o que vai pra ela; nos demais, o custo gravado. */
const custoReal = (o: Orcamento) =>
  Number(o.valor_parceiro) > 0 ? Number(o.valor_parceiro) : Number(o.custo_tecido ?? 0)
const receita = (o: Orcamento) => Number(o.valor_venda ?? 0) + Number(o.instalacao ?? 0)
/** o que o cliente REALMENTE pagou (desconto/acréscimo na mão) — cai no calculado quando não houve ajuste */
const pago = (o: Orcamento) => o.valor_cobrado != null ? Number(o.valor_cobrado) : receita(o)
/** o que REALMENTE foi pago à parceira */
const pagoParceira = (o: Orcamento) =>
  o.valor_parceiro_pago != null ? Number(o.valor_parceiro_pago) : Number(o.valor_parceiro ?? 0)
const ajustado = (calc: number, real: number) => Math.abs(calc - real) >= 0.01
/** acha o "6x" dentro do texto real ("6x de R$ 350" ou "cartão 6x") */
const parcelasDe = (s: string | null | undefined) => s?.match(/(\d+)\s*x/i)?.[1] ?? null

/**
 * Pgto em forma curta, pro PDF: "4x" · "à vista" · "4x / 6x" (calculado / pago).
 * Só números, como a loja pediu — e sem o "−" que a fonte do PDF não tem.
 */
const pgtoCurto = (o: Orcamento): string => {
  const real = parcelasDe(o.forma_pagamento_real)
  const base = o.forma_pagamento === 'a_vista' ? 'à vista'
    : o.forma_pagamento === 'cartao_4x' || o.forma_pagamento === 'outro' ? '4x'   // o preço nasce pra 4x
    : null
  const juros = o.forma_pagamento_real?.match(/\+([\d.,]+)%/)?.[1]
  if (real && base) return `${real}x` === base ? base : `${base} / ${real}x${juros ? ` (+${juros}%)` : ''}`
  if (real) return `${real}x`
  if (o.forma_pagamento === 'outro') {
    // texto livre sem parcelas (ex.: "PIX") ainda aparece; sem nada, traço
    return o.forma_pagamento_real ? o.forma_pagamento_real.slice(0, 18) : '—'
  }
  return base ?? '—'
}

/**
 * Pagamento como REALMENTE saiu, pro PDF do fechamento (áudio da loja,
 * 17/08: "não precisa ficar comparando entre parênteses, aqui é a realidade
 * da venda"). Parcelas: o número real se houver; senão o combinado.
 */
const pgtoReal = (o: Orcamento): { forma: string; parcelas: number | null } => {
  const real = parcelasDe(o.forma_pagamento_real)
  if (real) return { forma: `${real}x no cartão`, parcelas: Number(real) }
  if (o.forma_pagamento === 'a_vista') return { forma: 'à vista', parcelas: null }
  if (o.forma_pagamento === 'cartao_4x') return { forma: '4x no cartão', parcelas: 4 }
  if (o.forma_pagamento === 'outro') {
    return { forma: (o.forma_pagamento_real ?? 'outro').slice(0, 24), parcelas: null }
  }
  return { forma: '—', parcelas: null }
}

/** "R$ 792,50 (R$ 750,00)" — calculado com o realmente pago entre parênteses */
function ValorComReal({ calc, real, classe }: { calc: number; real: number; classe?: string }) {
  if (!ajustado(calc, real)) return <span className={classe}>{formatCurrency(calc)}</span>
  return (
    <span className={classe}>
      <span className="text-muted-foreground/60 line-through decoration-1">{formatCurrency(calc)}</span>{' '}
      <strong>({formatCurrency(real)})</strong>
    </span>
  )
}

function Kpi({ rotulo, valor, hint, destaque, contar }: {
  rotulo: string; valor: number; hint?: string; destaque?: 'primary' | 'emerald' | 'amber'; contar: boolean
}) {
  const anim = useCountUp(valor, 700, contar)
  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 shadow-sm transition-colors',
      destaque === 'primary' ? 'border-primary/25 bg-primary/[0.04]' :
      destaque === 'emerald' ? 'border-emerald-500/25 bg-emerald-500/[0.04]' :
      destaque === 'amber' ? 'border-amber-500/25 bg-amber-500/[0.04]' : 'border-border',
    )}>
      <p className="text-center text-[10px] font-bold uppercase tracking-widest text-foreground/45">{rotulo}</p>
      <p className={cn(
        'text-center font-display text-2xl font-bold tabular-nums',
        destaque === 'primary' ? 'text-primary' :
        destaque === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
        destaque === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
      )}>
        {formatCurrency(anim)}
      </p>
      {hint && <p className="mt-0.5 text-center text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default function TabFechamento() {
  const { data: todos = [], isLoading, refetch } = useOrcamentos()
  // apagar venda é só do admin — o RLS repete a regra, aqui só evita o botão morto
  const { data: profile } = useProfile()
  const isAdmin = profile?.email === ADMIN_EMAIL || profile?.is_admin === true
  const [calculando, setCalculando] = useState(false)
  const [periodo, setPeriodo] = useState('mes')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [baixando, setBaixando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<{ cobrado: string; parceira: string; formaReal: string; parcelasReal: string; origem: string; dataPedido: string; numeroPedido: string }>(
    { cobrado: '', parceira: '', formaReal: '', parcelasReal: '', origem: '', dataPedido: '', numeroPedido: '' })
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)
  const [reconstruindo, setReconstruindo] = useState<string | null>(null)
  // exclusão passa por modal: mexe em faturamento, não pode sair num clique torto
  const [confirmandoExcluir, setConfirmandoExcluir] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)
  const [erroReconstruir, setErroReconstruir] = useState<Record<string, string>>({})

  /**
   * Recalcula a quebra por item de uma venda que entrou sem ela (WhatsApp).
   * O servidor só grava se o número reproduzir o que já estava salvo.
   */
  const reconstruir = async (id: string) => {
    setReconstruindo(id)
    setErroReconstruir(e => ({ ...e, [id]: '' }))
    try {
      const { data, error } = await supabase.functions.invoke('simular', {
        body: { acao: 'detalhar', id },
      })
      if (error) throw error
      if (data?.erro) { setErroReconstruir(e => ({ ...e, [id]: data.erro })); return }
      await refetch()
    } catch (err) {
      setErroReconstruir(e => ({
        ...e, [id]: err instanceof Error ? err.message : 'Não deu para reconstruir agora.',
      }))
    } finally {
      setReconstruindo(null)
    }
  }

  function abrirAjuste(o: Orcamento) {
    if (editando === o.id) { setEditando(null); return }
    setEditando(o.id)
    setRascunho({
      cobrado: String((o.valor_cobrado != null ? Number(o.valor_cobrado) : receita(o)).toFixed(2)),
      parceira: String((o.valor_parceiro_pago != null ? Number(o.valor_parceiro_pago) : Number(o.valor_parceiro ?? 0)).toFixed(2)),
      // texto composto ("6x de R$ … · +x% de juros — nota") volta separado:
      // o número pro campo de parcelas, a nota pro campo livre
      ...(() => {
        const bruto = o.forma_pagamento_real ?? ''
        const composto = bruto.match(/^(\d+)x de [^—]*?(?:— (.*))?$/)
        if (composto) return { parcelasReal: composto[1], formaReal: (composto[2] ?? '').trim() }
        return { parcelasReal: parcelasDe(bruto) ?? '', formaReal: bruto }
      })(),
      origem: acharOrigem(o.origem).id === SEM_ORIGEM.id ? '' : acharOrigem(o.origem).id,
      dataPedido: o.data_pedido ?? '',
      numeroPedido: o.numero_pedido ?? '',
    })
  }

  /** Os três valores são ligados: sobra = cliente − parceira. Mexeu na sobra, o
      preço do cliente acompanha (a parceira é custo, não se negocia por aqui). */
  function mudarSobra(valor: string) {
    const sobraNova = parseFloat(valor.replace(',', '.'))
    const parceira = parseFloat(rascunho.parceira.replace(',', '.')) || 0
    if (!Number.isFinite(sobraNova)) return
    setRascunho(r => ({ ...r, cobrado: (parceira + sobraNova).toFixed(2) }))
  }

  /**
   * Apaga a venda — guardando a linha inteira na lixeira antes.
   * Vale pra registro feito errado; o dado continua recuperável.
   */
  async function excluirVenda(o: Orcamento) {
    setExcluindo(o.id)
    setErroExcluir(null)
    try {
      const { data: perfil } = await supabase.auth.getUser()
      const { error: erroLixeira } = await supabase.from('orcamentos_excluidos').insert({
        orcamento_id: o.id,
        excluido_por: perfil?.user?.email ?? null,
        motivo: 'excluída pelo Fechamento',
        dados: o,
      })
      if (erroLixeira) throw erroLixeira

      const { error } = await supabase.from('orcamentos').delete().eq('id', o.id)
      if (error) throw error

      setConfirmandoExcluir(null)
      setEditando(null)
      await refetch()
    } catch (err) {
      setErroExcluir(err instanceof Error ? err.message : 'Não deu para excluir')
    } finally {
      setExcluindo(null)
    }
  }

  async function salvarAjuste(o: Orcamento) {
    setSalvandoAjuste(true)
    try {
      const numero = (s: string) => {
        const v = parseFloat(s.replace(',', '.'))
        return Number.isFinite(v) && v > 0 ? v : null
      }
      /* mesmo formato que o Simulador grava: "6x de R$ 330,67 · +6,0% de juros"
         — o juro sai da diferença entre o cobrado e o preço calculado */
      const nReal = Math.round(numero(rascunho.parcelasReal) ?? 0)
      const cobradoEf = numero(rascunho.cobrado) ?? pago(o)
      let formaRealFinal = rascunho.formaReal.trim()
      if (nReal >= 2 && cobradoEf > 0) {
        const base = receita(o)
        const juros = base > 0 && cobradoEf > base + 0.009
          ? ` · +${(((cobradoEf - base) / base) * 100).toFixed(1)}% de juros`
          : ''
        const auto = `${nReal}x de ${formatCurrency(cobradoEf / nReal)}${juros}`
        formaRealFinal = formaRealFinal ? `${auto} — ${formaRealFinal}` : auto
      }
      const { error } = await supabase.from('orcamentos').update({
        valor_cobrado: numero(rascunho.cobrado),
        valor_parceiro_pago: numero(rascunho.parceira),
        forma_pagamento_real: formaRealFinal || null,
        origem: rascunho.origem || null,
        data_pedido: rascunho.dataPedido || null,
        numero_pedido: rascunho.numeroPedido.trim() || null,
      }).eq('id', o.id)
      if (error) throw error
      setEditando(null)
      await refetch()
    } finally {
      setSalvandoAjuste(false)
    }
  }

  const vendas = useMemo(() => {
    const fechados = todos.filter(o => o.fechado === true)
    // data do pedido manda quando foi informada; senão, a de criação
    const dataDe = (o: Orcamento) => o.data_pedido ? `${o.data_pedido}T12:00:00` : o.created_at
    return filterByPeriod(fechados, periodo, dataDe, de || undefined, ate || undefined)
      .sort((a, b) => new Date(dataDe(b)).getTime() - new Date(dataDe(a)).getTime())
  }, [todos, periodo, de, ate])

  const totais = useMemo(() => {
    const bruto = vendas.reduce((s, o) => s + pago(o), 0)
    const parceira = vendas.reduce((s, o) => s + pagoParceira(o), 0)
    const custo = vendas.reduce((s, o) => s + (o.valor_parceiro_pago != null ? Number(o.valor_parceiro_pago) : custoReal(o)), 0)
    const ajustes = vendas.filter(o => o.valor_cobrado != null || o.valor_parceiro_pago != null).length
    // o que teria sido sem desconto/acréscimo dado na mão — serve de régua na negociação
    const brutoCalc = vendas.reduce((s, o) => s + receita(o), 0)
    const custoCalc = vendas.reduce((s, o) => s + custoReal(o), 0)
    return {
      bruto, parceira, custo, sobra: bruto - custo, ajustes,
      sobraCalc: brutoCalc - custoCalc,
      pctReal: bruto > 0 ? ((bruto - custo) / bruto) * 100 : 0,
      pctCalc: brutoCalc > 0 ? ((brutoCalc - custoCalc) / brutoCalc) * 100 : 0,
    }
  }, [vendas])

  async function exportarPdf() {
    if (baixando || vendas.length === 0) return
    setBaixando(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'), import('jspdf-autotable'),
      ])
      const doc = new jsPDF({ orientation: 'landscape' })
      const rotuloPeriodo = PERIODOS.find(p => p.value === periodo)?.label ?? ''
      const inicioY = faixaMarca(doc, 'Fechamento de vendas',
        `${rotuloPeriodo}${de || ate ? ` (${de} a ${ate})` : ''} · ${vendas.length} venda(s)`)

      /* A loja pediu (áudio 17/08): só a realidade da venda — quanto o cliente
         pagou, a parcela, a forma, quanto foi pra parceira e quanto sobrou.
         Sem "(orçado em …)", sem "4x / 6x". */
      autoTable(doc, {
        startY: inicioY,
        head: [['Data', 'Pedido', 'Cliente', 'Produto', 'Cliente pagou', 'Parcela', 'Pagamento', 'À parceira', 'Sobra']],
        body: vendas.map(o => {
          const pg = pgtoReal(o)
          const parcela = pg.parcelas && pg.parcelas > 1 ? formatCurrency(pago(o) / pg.parcelas) : '—'
          return [
            formatDate(o.data_pedido ? `${o.data_pedido}T12:00:00` : o.created_at),
            o.numero_pedido ?? '—',
            o.cliente ?? '—',
            [o.modelo, o.tecido].filter(Boolean).join(' · ')
              + (o.largura && o.altura ? `\n${String(o.largura).replace('.', ',')}×${String(o.altura).replace('.', ',')}m` : ''),
            formatCurrency(pago(o)),
            parcela,
            pg.forma,
            formatCurrency(pagoParceira(o)),
            formatCurrency(pago(o) - (o.valor_parceiro_pago != null ? Number(o.valor_parceiro_pago) : custoReal(o))),
          ]
        }),
        foot: [['', '', '', 'TOTAIS',
          formatCurrency(totais.bruto), '', '', formatCurrency(totais.parceira), formatCurrency(totais.sobra)]],
        ...TEMA_TABELA,
        columnStyles: { ...colunasDireita([4, 5, 7, 8]), ...colunasCentro([1, 6]) },
        didParseCell: alinharSecoes({ 1: 'center', 4: 'right', 5: 'right', 6: 'center', 7: 'right', 8: 'right' }),
        margin: { left: 14, right: 14, bottom: 20 },
      })
      rodapeMarca(doc)
      doc.save(`fechamento-sombrear-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setBaixando(false)
    }
  }

  return (
    <>
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col items-center text-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground/40">Dashboard</span>
          <ChevronRight className="h-3 w-3 text-foreground/30" />
          <span className="text-xs font-medium text-primary">Fechamento</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Fechamento</h2>
          <p className="mt-0.5 text-sm text-foreground/50">
            As vendas efetivadas, quanto vai para a parceira e o que sobra para a loja.
          </p>
        </div>
      </div>

      {/* Filtros + ações */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
        <CustomSelect className="w-44 py-2" value={periodo}
          onChange={v => { setPeriodo(v); if (v !== 'custom') { setDe(''); setAte('') } }} options={PERIODOS} />
        <DatePicker value={de} onChange={v => { setDe(v); if (v) setPeriodo('custom') }}
          placeholder="De" triggerClassName="py-2" className="w-36" />
        <DatePicker value={ate} onChange={v => { setAte(v); if (v) setPeriodo('custom') }}
          placeholder="Até" min={de || undefined} triggerClassName="py-2" className="w-36" />
        <Button variant="brand" onClick={() => setCalculando(v => !v)}>
          <Plus className={cn('h-4 w-4 transition-transform duration-200', calculando && 'rotate-45')}
            aria-hidden="true" />
          {calculando ? 'Fechar calculadora' : 'Nova venda'}
        </Button>
        <Button variant="outline" onClick={exportarPdf} loading={baixando}
          disabled={vendas.length === 0}>
          {!baixando && <Download className="h-4 w-4" aria-hidden="true" />}
          PDF
        </Button>
      </div>

      {/* Calculadora — a venda cai direto neste fechamento */}
      {calculando && (
        <div className="mb-4 rounded-xl border border-primary/25 bg-primary/[0.03] p-4 shadow-sm sm:p-5">
          <Suspense fallback={<p className="py-8 text-center text-sm text-muted-foreground">Carregando calculadora…</p>}>
            <TabSimulador modoVenda aoSalvar={() => refetch()} />
          </Suspense>
        </div>
      )}

      {/* Totais */}
      <div className="kpi-cascade mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Vendas no período" valor={totais.bruto} contar={!isLoading}
          hint={`${vendas.length} venda${vendas.length !== 1 ? 's' : ''} fechada${vendas.length !== 1 ? 's' : ''}` +
            (totais.ajustes ? ` · ${totais.ajustes} com ajuste manual` : '')} destaque="primary" />
        <Kpi rotulo="A pagar à parceira" valor={totais.parceira} contar={!isLoading}
          hint="produção das persianas de tecido" destaque="amber" />
        <Kpi rotulo="Custo total" valor={totais.custo} contar={!isLoading}
          hint="inclui itens fora da parceira" />
        <Kpi rotulo="Sobra para a loja" valor={totais.sobra} contar={!isLoading}
          hint={totais.bruto > 0
            ? `${totais.pctReal.toFixed(0)}% do faturamento` +
              (Math.abs(totais.pctReal - totais.pctCalc) >= 0.5 ? ` · sem os ajustes seria ${totais.pctCalc.toFixed(0)}%` : '')
            : undefined}
          destaque="emerald" />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : vendas.length === 0 ? (
          <EmptyState icon={CheckCircle2} titulo="Nenhuma venda fechada neste período"
            dica="Marque o orçamento como venda na Planilha (coluna Fechado) que ele aparece aqui — venha da IA, do balcão ou de lançamento manual."
            className="px-6 py-14" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-center font-bold">Data</th>
                  <th className="px-4 py-3 text-center font-bold">Cliente</th>
                  <th className="px-4 py-3 text-center font-bold">Produto</th>
                  <th className="px-4 py-3 text-center font-bold">Medidas</th>
                  <th className="px-4 py-3 text-center font-bold">Cliente pagou</th>
                  <th className="px-4 py-3 text-center font-bold">À parceira</th>
                  <th className="px-4 py-3 text-center font-bold">Sobra</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {vendas.map(o => {
                  const bruto = receita(o)
                  const parceira = Number(o.valor_parceiro ?? 0)
                  const sobra = pago(o) - (o.valor_parceiro_pago != null ? Number(o.valor_parceiro_pago) : custoReal(o))
                  const emEdicao = editando === o.id
                  const sobraRascunho =
                    (parseFloat(rascunho.cobrado.replace(',', '.')) || 0) -
                    (parseFloat(rascunho.parceira.replace(',', '.')) || 0)
                  return (
                    <Fragment key={o.id}>
                    <tr className={cn('transition-colors hover:bg-primary/[0.03]', emEdicao && 'bg-primary/[0.04]')}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {formatDate(o.data_pedido ? `${o.data_pedido}T12:00:00` : o.created_at)}
                        {o.numero_pedido && <span className="block text-[10px] font-semibold text-foreground/60">Ped. {o.numero_pedido}</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-foreground">
                        <span className="block">{o.cliente ?? '—'}</span>
                        {o.origem && <SeloOrigem origem={o.origem} className="mt-1" />}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="block text-foreground">{o.modelo ?? '—'}</span>
                        {o.tecido && <span className="text-xs">{o.tecido}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-xs text-muted-foreground tabular-nums">
                        {o.largura && o.altura ? `${o.largura}×${o.altura}m` : '—'}
                        {Number(o.quantidade) > 1 && <span className="ml-1">× {o.quantidade}</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums text-foreground">
                        <ValorComReal calc={bruto} real={pago(o)} />
                        {(o.forma_pagamento_real || o.forma_pagamento) && (
                          <span className={cn('mt-0.5 block text-[10px] font-medium',
                            pgtoCurto(o).includes('/') ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}
                            title={o.forma_pagamento_real ?? undefined}>
                            {pgtoCurto(o)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-amber-600 dark:text-amber-400">
                        {parceira > 0 || o.valor_parceiro_pago != null
                          ? <ValorComReal calc={parceira} real={pagoParceira(o)} />
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {(() => {
                          const sobraCalc = bruto - custoReal(o)
                          const pctReal = pago(o) > 0 ? (sobra / pago(o)) * 100 : 0
                          const pctCalc = bruto > 0 ? (sobraCalc / bruto) * 100 : 0
                          const mudou = Math.abs(pctReal - pctCalc) >= 0.5
                          return (
                            <>
                              <span className="block font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(sobra)}</span>
                              <span className={cn('block text-[11px]', mudou ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                                {pctReal.toFixed(0)}%{mudou && <> · seria {pctCalc.toFixed(0)}%</>}
                              </span>
                            </>
                          )
                        })()}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => abrirAjuste(o)}
                            title="Ver o custo item a item e ajustar valores"
                            className={cn('rounded-md p-1.5 transition-colors hover:bg-muted hover:text-foreground',
                              emEdicao ? 'bg-primary/10 text-primary' : 'text-muted-foreground/50')}>
                            <PencilLine className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={() => setConfirmandoExcluir(o.id)}
                              title="Excluir esta venda"
                              className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                    {emEdicao && (
                      <tr>
                        <td colSpan={8} className="bg-muted/20 px-4 py-4">
                          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                            <div className="rounded-lg border border-border bg-card p-3">
                              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-foreground/45">
                                Custo item a item
                              </p>
                              {o.custos_detalhe?.length ? (
                                <div className="overflow-x-auto">
                                <table className="w-full min-w-[420px] text-xs">
                                  <thead>
                                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                      <th className="pb-1 text-center font-bold">Parte</th>
                                      <th className="pb-1 text-center font-bold">Tabela</th>
                                      <th className="pb-1 text-center font-bold">Fator</th>
                                      <th className="pb-1 text-center font-bold">Custo real</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/40">
                                    {o.custos_detalhe.map((p, i) => (
                                      <tr key={i}>
                                        <td className="py-1.5 text-foreground">{p.parte}</td>
                                        <td className="py-1.5 text-center tabular-nums text-muted-foreground">{formatCurrency(p.tabela)}</td>
                                        <td className="py-1.5 text-center tabular-nums text-muted-foreground">{p.fator}</td>
                                        <td className="py-1.5 text-center font-semibold tabular-nums text-foreground">{formatCurrency(p.real)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground">
                                    Essa venda entrou sem a quebra por item. O que temos: produto{' '}
                                    {formatCurrency(Number(o.custo_tecido ?? 0))}
                                    {Number(o.custo_acabamento) > 0 && <> e acabamento {formatCurrency(Number(o.custo_acabamento))}</>}.
                                  </p>
                                  <Button variant="outline" size="sm" loading={reconstruindo === o.id}
                                    onClick={() => reconstruir(o.id)}>
                                    {reconstruindo !== o.id && <Wand2 className="h-3 w-3" aria-hidden="true" />}
                                    Reconstruir pelos dados da venda
                                  </Button>
                                  {erroReconstruir[o.id] && (
                                    <p className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                                      {erroReconstruir[o.id]}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="rounded-lg border border-border bg-card p-3">
                              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-foreground/45">
                                Ajustar valores
                              </p>
                              <div className="space-y-2">
                                <label className="block">
                                  <span className="text-[11px] text-muted-foreground">Cliente pagou</span>
                                  <input className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                                    inputMode="decimal" value={rascunho.cobrado}
                                    onChange={e => setRascunho(r => ({ ...r, cobrado: e.target.value }))} />
                                </label>
                                <label className="block">
                                  <span className="text-[11px] text-muted-foreground">À parceira</span>
                                  <input className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                                    inputMode="decimal" value={rascunho.parceira}
                                    onChange={e => setRascunho(r => ({ ...r, parceira: e.target.value }))} />
                                </label>
                                <label className="block">
                                  <span className="text-[11px] text-muted-foreground">De onde veio este cliente</span>
                                  <select
                                    className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                                    value={rascunho.origem}
                                    onChange={e => setRascunho(r => ({ ...r, origem: e.target.value }))}
                                  >
                                    <option value="">Não informada</option>
                                    {ORIGENS.map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="text-[11px] text-muted-foreground">Em quantas vezes saiu?</span>
                                  <input className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                                    inputMode="numeric" placeholder="4"
                                    value={rascunho.parcelasReal}
                                    onChange={e => setRascunho(r => ({ ...r, parcelasReal: e.target.value }))} />
                                  {(() => {
                                    const n = Math.round(parseFloat(rascunho.parcelasReal) || 0)
                                    const v = parseFloat(rascunho.cobrado.replace(',', '.')) || 0
                                    if (n < 2 || v <= 0) return null
                                    const base = receita(o)
                                    const juros = base > 0 && v > base + 0.009
                                      ? ` · +${(((v - base) / base) * 100).toFixed(1)}% de juros`
                                      : ''
                                    return (
                                      <span className="mt-1 block text-[11px] text-muted-foreground">
                                        Fica registrado: <b className="text-foreground/80">{n}x de {formatCurrency(v / n)}{juros}</b>
                                      </span>
                                    )
                                  })()}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  <label className="block">
                                    <span className="text-[11px] text-muted-foreground">Data do pedido</span>
                                    <DatePicker value={rascunho.dataPedido}
                                      onChange={v => setRascunho(r => ({ ...r, dataPedido: v }))}
                                      placeholder="dd/mm/aaaa" className="mt-0.5 w-full" />
                                  </label>
                                  <label className="block">
                                    <span className="text-[11px] text-muted-foreground">Nº do pedido</span>
                                    <input className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                                      placeholder="ex.: 337" maxLength={20}
                                      value={rascunho.numeroPedido}
                                      onChange={e => setRascunho(r => ({ ...r, numeroPedido: e.target.value }))} />
                                  </label>
                                </div>
                                <label className="block">
                                  <span className="text-[11px] text-muted-foreground">Observação do pagamento (opcional)</span>
                                  <input className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                                    placeholder="ex.: no link, PIX + cartão"
                                    maxLength={120}
                                    value={rascunho.formaReal}
                                    onChange={e => setRascunho(r => ({ ...r, formaReal: e.target.value }))} />
                                </label>
                                <label className="block">
                                  <span className="text-[11px] text-muted-foreground">Sobra da loja (ajusta o valor do cliente)</span>
                                  <input className="mt-0.5 w-full rounded-md border border-emerald-500/40 bg-background px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/15 dark:text-emerald-400"
                                    inputMode="decimal"
                                    value={sobraRascunho.toFixed(2)}
                                    onChange={e => mudarSobra(e.target.value)} />
                                </label>
                              </div>
                              <div className="mt-3 flex gap-2">
                                <Button variant="brand" size="sm" className="flex-1"
                                  loading={salvandoAjuste} onClick={() => salvarAjuste(o)}>
                                  {!salvandoAjuste && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                  Salvar
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setEditando(null)}
                                  aria-label="Cancelar ajuste">
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Total do período
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-foreground">{formatCurrency(totais.bruto)}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(totais.parceira)}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    <span className="block text-emerald-600 dark:text-emerald-400">{formatCurrency(totais.sobra)}</span>
                    <span className={cn('block text-[11px] font-semibold',
                      Math.abs(totais.pctReal - totais.pctCalc) >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                      {totais.pctReal.toFixed(0)}%
                      {Math.abs(totais.pctReal - totais.pctCalc) >= 0.5 && <> · seria {totais.pctCalc.toFixed(0)}%</>}
                    </span>
                  </td>
                  <td className="px-2 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" /> "Cliente pagou" inclui a instalação quando houver.</span>
        <span className="inline-flex items-center gap-1"><PencilLine className="h-3 w-3" /> Deu desconto ou acréscimo na mão? Clique no lápis da linha: o valor calculado fica riscado e o realmente pago aparece entre parênteses — os totais usam o real.</span>
        <span className="inline-flex items-center gap-1"><HandCoins className="h-3 w-3" /> "À parceira" é o custo de produção das persianas de tecido (PV, PH Alumínio e PH 50mm não passam por ela).</span>
      </div>

      <JanelaDados className="mt-4" />

      {(() => {
        // só admin chega aqui, mas a checagem repete: o estado sobrevive a um
        // rebaixamento de permissão no meio da sessão
        const alvo = isAdmin ? vendas.find(v => v.id === confirmandoExcluir) : undefined
        if (!alvo) return null
        return (
          <ConfirmarExclusaoVenda
            cliente={alvo.cliente}
            valor={pago(alvo)}
            data={alvo.created_at}
            excluindo={excluindo === alvo.id}
            erro={erroExcluir}
            onConfirmar={() => excluirVenda(alvo)}
            onCancelar={() => { setConfirmandoExcluir(null); setErroExcluir(null) }}
          />
        )
      })()}
    </>
  )
}
