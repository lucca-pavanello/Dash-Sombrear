/**
 * Simulador de balcão — atendente da loja com o cliente na frente.
 * O cálculo roda no SERVIDOR (edge function `simular`, mesmo motor dos agentes);
 * a atendente vê só o valor de venda. Custo e margem só aparecem para admin.
 * Fluxo de visita: dados do cliente ficam preenchidos entre um salvamento e
 * outro (cliente quer ver 3 modelos → troca o modelo e salva de novo);
 * "Limpar" zera a visita inteira.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Calculator, CheckCircle2, ChevronRight, Eraser, History, Layers, Loader2,
  Ruler, Save, Sparkles, Tag, User, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/useToast'
import Toaster from '@/components/ui/Toaster'
import { SUGESTOES_AMBIENTE } from '@/lib/constants'
import { useHistoricoCliente, resumoHistorico } from '@/hooks/useHistoricoCliente'
import { lazyComRecarga } from '@/lib/lazyComRecarga'
import SectionHeader from '@/components/shared/SectionHeader'

const CalculadoraCortina = lazyComRecarga(() => import('@/components/cortina/CalculadoraCortina'))

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const MODELOS = [
  { id: 'Rolo', label: 'Rolô' },
  { id: 'Double', label: 'Double' },
  { id: 'Romana', label: 'Romana' },
  { id: 'PV', label: 'PV' },
  { id: 'PH_Aluminio', label: 'PH Alumínio' },
  { id: 'PH_50', label: 'PH 50mm' },
]

interface Opcoes {
  tecidos: string[]
  artigosPV: string[]
  artigosPH: string[]
  ph50: { valor: string; label: string }[]
}

interface Resultado {
  total4x: number
  totalAvista: number
  vendaProduto: number
  vendaAcabamento: number
  instalacao: number | 'sob_consulta' | null
  emPromocao: boolean
  descontoPct: number | null
  observacoes: string[]
  custoProduto?: number
  custoAcabamento?: number
  erro?: string
}

interface Salvo { id: string; modelo: string; detalhe: string; total: number }

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3.5 py-3 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/50 hover:border-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all duration-150'
const labelCls =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-foreground/50 dark:text-foreground/55'

export default function TabSimulador({ modoVenda, aoSalvar }: {
  /** No Fechamento a simulação vira VENDA FECHADA direto (não um orçamento aberto). */
  modoVenda?: boolean
  aoSalvar?: () => void
} = {}) {
  const { toasts, toast, dismiss } = useToast()
  const [modelo, setModelo] = useState('Rolo')
  const [tecido, setTecido] = useState('')
  const [artigo, setArtigo] = useState('')
  const [ph50Acab, setPh50Acab] = useState<'cadarco' | 'fita'>('cadarco')
  const [ph50Bando, setPh50Bando] = useState(false)
  const [corFerragem, setCorFerragem] = useState<'BRANCA' | 'PRETA'>('BRANCA')
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [acabamento, setAcabamento] = useState('nenhum')
  const [instalacao, setInstalacao] = useState(false)
  const [cliente, setCliente] = useState('')
  const [telefone, setTelefone] = useState('')
  const [ambiente, setAmbiente] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvoAtual, setSalvoAtual] = useState(false)
  const [salvos, setSalvos] = useState<Salvo[]>([])
  // desconto/acréscimo dado na mão: vazio = cobra o valor calculado
  // persiana e cortina são dois cálculos diferentes; a chave decide qual aparece
  const [produto, setProduto] = useState<'persiana' | 'cortina'>('persiana')
  const [valorCobrado, setValorCobrado] = useState('')
  // à vista tem 5% de desconto; no cartão vale o valor em 4x
  const [formaPagamento, setFormaPagamento] = useState('cartao_4x')
  // o que a loja combinou define o preço; isto aqui é como o cliente pagou
  const [formaReal, setFormaReal] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chamadaRef = useRef(0)

  const { data: historicoCliente } = useHistoricoCliente(cliente)
  const { data: opcoes } = useQuery<Opcoes>({
    queryKey: ['simulador-opcoes'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('simular', { body: { acao: 'opcoes' } })
      if (error) throw error
      return data as Opcoes
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const num = (s: string) => parseFloat(s.replace(',', '.')) || 0
  const comTecido = modelo === 'Rolo' || modelo === 'Double' || modelo === 'Romana'
  const entrada = useMemo(() => ({
    modelo,
    tecido: comTecido ? (tecido || undefined) : undefined,
    artigo: !comTecido ? (artigo || undefined) : undefined,
    ph50Acabamento: ph50Acab,
    ph50Bando,
    corFerragem,
    largura: num(largura),
    altura: num(altura),
    quantidade: Math.max(1, Math.round(num(quantidade))),
    acabamento,
    incluirInstalacao: instalacao,
  }), [modelo, comTecido, tecido, artigo, ph50Acab, ph50Bando, corFerragem, largura, altura, quantidade, acabamento, instalacao])

  const pronto = entrada.largura > 0 && entrada.altura > 0 &&
    (comTecido ? !!entrada.tecido : !!entrada.artigo)

  /* ── cálculo no servidor, com debounce (o motor é o mesmo dos agentes) ── */
  useEffect(() => {
    setSalvoAtual(false)
    setValorCobrado('')
    setFormaPagamento('cartao_4x')
    setFormaReal('')
    if (!pronto) { setResultado(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const id = ++chamadaRef.current
    debounceRef.current = setTimeout(async () => {
      setCalculando(true)
      try {
        const { data, error } = await supabase.functions.invoke('simular', {
          body: { acao: 'calcular', entrada },
        })
        if (id !== chamadaRef.current) return
        if (error) throw error
        setResultado(data as Resultado)
      } catch {
        if (id === chamadaRef.current) setResultado({ erro: 'Não consegui calcular. Tente de novo.' } as Resultado)
      } finally {
        if (id === chamadaRef.current) setCalculando(false)
      }
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [entrada, pronto])

  async function salvar() {
    if (!resultado || resultado.erro || salvando || salvoAtual) return
    setSalvando(true)
    try {
      const { data, error } = await supabase.functions.invoke('simular', {
        body: { acao: 'salvar', entrada, cliente: cliente.trim(), telefone: telefone.trim(), ambiente: ambiente.trim(), fechado: !!modoVenda,
          valor_cobrado: num(valorCobrado) || null, forma_pagamento: formaPagamento,
          forma_pagamento_real: formaReal.trim() || null },
      })
      if (error) throw error
      if ((data as { error?: string }).error) throw new Error((data as { error: string }).error)
      const detalheProduto = comTecido ? tecido
        : modelo === 'PH_50' ? (opcoes?.ph50.find(i => i.valor === artigo)?.label ?? artigo)
        : artigo
      setSalvos(prev => [...prev, {
        id: (data as { id: string }).id,
        modelo: MODELOS.find(m => m.id === modelo)?.label ?? modelo,
        detalhe: `${detalheProduto} · ${largura}×${altura}m`,
        total: resultado.total4x,
      }])
      setSalvoAtual(true)
      toast('success', modoVenda ? 'Venda registrada no Fechamento!' : 'Orçamento salvo na Planilha!')
      aoSalvar?.()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erro ao salvar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  /* ── nova visita: zera produto, cliente e a lista de salvos ── */
  function limparTudo() {
    setModelo('Rolo'); setTecido(''); setArtigo(''); setPh50Acab('cadarco'); setPh50Bando(false)
    setCorFerragem('BRANCA'); setLargura(''); setAltura(''); setQuantidade('1')
    setAcabamento('nenhum'); setInstalacao(false)
    setCliente(''); setTelefone(''); setAmbiente('')
    setResultado(null); setSalvoAtual(false); setSalvos([]); setValorCobrado(''); setFormaPagamento('cartao_4x'); setFormaReal('')
  }

  const ok = resultado && !resultado.erro ? resultado : null
  const ehAdminView = ok?.custoProduto != null
  const margem = ehAdminView && ok
    ? (() => {
        const receita = ok.total4x + (typeof ok.instalacao === 'number' ? ok.instalacao : 0)
        const custo = (ok.custoProduto ?? 0) + (ok.custoAcabamento ?? 0)
        return receita > 0 ? ((receita - custo) / receita) * 100 : null
      })()
    : null

  return (
    <>
      {/* ── Cabeçalho: só como aba; dentro do Fechamento seria página dentro de página ── */}
      <div className={cn('mb-6 flex-col items-center gap-2 text-center', modoVenda ? 'hidden' : 'flex')}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground/40">Dashboard</span>
          <ChevronRight className="h-3 w-3 text-foreground/30" />
          <span className="text-xs font-medium text-primary">Simulador</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Preço na hora</h2>
          <p className="mt-0.5 text-sm text-foreground/50">O mesmo cálculo dos orçamentos oficiais, direto do banco de preços.</p>
        </div>
      </div>

      {/* ── Persiana ou cortina: contas diferentes, telas diferentes ── */}
      <div className="mx-auto mb-5 flex w-full max-w-xs gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {([['persiana', 'Persiana'], ['cortina', 'Cortina Wave']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setProduto(id)}
            className={cn('flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all active:scale-95',
              produto === id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>

      {produto === 'cortina' && (
        <Suspense fallback={
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        }>
          <CalculadoraCortina />
        </Suspense>
      )}

      <div className={cn('grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px] xl:gap-5',
        produto === 'cortina' && 'hidden')}>

        {/* ── COLUNA ESQUERDA: produto + cliente ── */}
        <div className="space-y-4">

          {/* SEÇÃO 1: Produto */}
          <section>
            <SectionHeader step="1" icon={<Layers className="h-3.5 w-3.5" />} title="Produto" />
            <div className="mt-3 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
              <div>
                <label className={labelCls}>Modelo</label>
                <div className="grid grid-cols-3 gap-2">
                  {MODELOS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setModelo(m.id); setTecido(''); setArtigo(''); setAcabamento('nenhum'); setPh50Bando(false) }}
                      className={cn(
                        'rounded-lg border px-2 py-2.5 text-sm font-semibold transition-all duration-100 active:scale-95',
                        modelo === m.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-foreground/60 hover:border-muted-foreground/40 hover:bg-muted/30',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {comTecido && (
                  <>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Tecido</label>
                      <CustomSelect value={tecido} onChange={setTecido}
                        options={opcoes?.tecidos ?? []}
                        placeholder={opcoes ? 'Escolha o tecido…' : 'Carregando…'} />
                    </div>
                    {modelo !== 'Romana' && (
                      <div>
                        <label className={labelCls}>Ferragem</label>
                        <CustomSelect value={corFerragem} onChange={v => setCorFerragem(v as 'BRANCA' | 'PRETA')}
                          options={[{ value: 'BRANCA', label: 'Branca' }, { value: 'PRETA', label: 'Preta' }]} />
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>Acabamento</label>
                      <CustomSelect value={acabamento} onChange={setAcabamento}
                        options={[
                          { value: 'nenhum', label: 'Sem acabamento' },
                          { value: 'bando_branco', label: 'Bandô branco' },
                          { value: 'bando_preto', label: 'Bandô preto' },
                          { value: 'barra', label: 'Barra niveladora' },
                          ...(modelo === 'Rolo' ? [{ value: 'kit_box', label: 'Kit Box' }] : []),
                        ]} />
                    </div>
                  </>
                )}

                {(modelo === 'PV' || modelo === 'PH_Aluminio') && (
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Artigo</label>
                    <CustomSelect value={artigo} onChange={setArtigo}
                      options={(modelo === 'PV' ? opcoes?.artigosPV : opcoes?.artigosPH) ?? []}
                      placeholder={opcoes ? 'Escolha o artigo…' : 'Carregando…'} />
                  </div>
                )}

                {modelo === 'PH_50' && (
                  <>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Modelo / cor</label>
                      <CustomSelect value={artigo} onChange={setArtigo}
                        options={(opcoes?.ph50 ?? []).map(i => ({ value: i.valor, label: i.label }))}
                        placeholder={opcoes ? 'Escolha…' : 'Carregando…'} />
                    </div>
                    <div>
                      <label className={labelCls}>Acabamento</label>
                      <CustomSelect value={ph50Acab} onChange={v => setPh50Acab(v as 'cadarco' | 'fita')}
                        options={[{ value: 'cadarco', label: 'Com cadarço' }, { value: 'fita', label: 'Com fita' }]} />
                    </div>
                    <label className="flex items-end gap-2 pb-3 text-sm font-medium">
                      <input type="checkbox" checked={ph50Bando} onChange={e => setPh50Bando(e.target.checked)}
                        className="h-4 w-4 accent-primary" />
                      Incluir bandô
                    </label>
                  </>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-2 select-none" aria-hidden="true">
                  <Ruler className="h-3 w-3 text-primary/40" />
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-foreground/35">Medidas</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div>
                    <label className={labelCls}>Largura (m)</label>
                    <input className={inputCls} inputMode="decimal" placeholder="1,20"
                      value={largura} onChange={e => setLargura(e.target.value.replace(',', '.'))} />
                  </div>
                  <div>
                    <label className={labelCls}>Altura (m)</label>
                    <input className={inputCls} inputMode="decimal" placeholder="1,50"
                      value={altura} onChange={e => setAltura(e.target.value.replace(',', '.'))} />
                  </div>
                  <div>
                    <label className={labelCls}>Qtd</label>
                    <input className={inputCls} inputMode="numeric"
                      value={quantidade} onChange={e => setQuantidade(e.target.value)} />
                  </div>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={instalacao} onChange={e => setInstalacao(e.target.checked)}
                    className="h-4 w-4 accent-primary" />
                  Incluir instalação
                </label>
              </div>
            </div>
          </section>

          {/* SEÇÃO 2: Cliente (opcional — fica preenchido entre um salvamento e outro) */}
          <section>
            <SectionHeader step="2" icon={<User className="h-3.5 w-3.5" />} title="Cliente"
              hint="— opcional; vale pra todos os modelos que salvar nesta visita" />
            <div className="mt-3 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Nome</label>
                  <input className={inputCls} placeholder="Balcão" autoComplete="off"
                    value={cliente} onChange={e => setCliente(e.target.value)} />
                  {historicoCliente && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                      <History className="h-3 w-3 shrink-0" />
                      Cliente conhecido: {resumoHistorico(historicoCliente)}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input className={inputCls} inputMode="tel" placeholder="(00) 00000-0000"
                    value={telefone} onChange={e => setTelefone(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Ambiente</label>
                  <input className={inputCls} placeholder="Sala, Quarto…" list="sugestoes-ambiente-sim"
                    value={ambiente} onChange={e => setAmbiente(e.target.value)} />
                  <datalist id="sugestoes-ambiente-sim">
                    {SUGESTOES_AMBIENTE.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── COLUNA DIREITA: valor + salvar + salvos da visita ── */}
        <div className="xl:sticky xl:top-24 h-fit space-y-3">
          <div className={cn(
            'rounded-xl border-2 bg-card p-5 shadow-sm transition-all',
            ok ? 'border-primary/25' : 'border-border',
            calculando && 'opacity-60',
          )}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Valor pro cliente</p>
              {calculando && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>

            {!pronto && !ok && (
              <p className="mt-3 flex items-center gap-2 text-sm text-foreground/40">
                <Calculator className="h-4 w-4 shrink-0" />
                Escolha o produto e as medidas — o preço aparece aqui na hora.
              </p>
            )}

            {pronto && resultado?.erro && !calculando && (
              <div className="mt-3">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{resultado.erro}</p>
                {/* atalho: a recusa da ferragem preta tem uma solução óbvia — dar ela pronta */}
                {corFerragem === 'PRETA' && /branca/i.test(resultado.erro) && (
                  <button
                    type="button"
                    onClick={() => setCorFerragem('BRANCA')}
                    className="mt-2 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-300"
                  >
                    Cotar com ferragem branca
                  </button>
                )}
              </div>
            )}

            {ok && (
              <>
                <p className="mt-1 font-display text-4xl font-bold tabular-nums text-primary">{brl(ok.total4x)}</p>
                <p className="mt-0.5 text-sm text-foreground/60">
                  em até <strong>4x de {brl(ok.total4x / 4)}</strong> sem juros
                </p>
                <p className="text-sm text-foreground/60">
                  à vista <strong>{brl(ok.totalAvista)}</strong> (−5%)
                </p>
                {ok.instalacao != null && (
                  <p className="mt-1 text-sm text-foreground/60">
                    Instalação: <strong>{ok.instalacao === 'sob_consulta' ? 'sob consulta' : brl(ok.instalacao)}</strong>
                    {typeof ok.instalacao === 'number' && <> · total <strong>{brl(ok.total4x + ok.instalacao)}</strong></>}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {ok.emPromocao && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                      <Tag className="h-3 w-3" /> em promoção{ok.descontoPct != null && ` (−${ok.descontoPct}%)`} — avise o cliente!
                    </span>
                  )}
                  {ok.observacoes.map((o, i) => <span key={i}>{o}</span>)}
                </div>

                {ehAdminView && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      Custo: {brl((ok.custoProduto ?? 0) + (ok.custoAcabamento ?? 0))}
                    </span>
                    {margem != null && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        Margem: {margem.toFixed(0)}%
                      </span>
                    )}
                    <span className="text-foreground/35">(só admin vê)</span>
                  </div>
                )}

                <div className="mt-4 border-t border-border/60 pt-4">
                  <label className={labelCls}>Forma de pagamento</label>
                  <div className="mb-3 grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'cartao_4x', rotulo: 'Cartão 4x', valor: () => ok?.total4x },
                      { id: 'a_vista', rotulo: 'À vista −5%', valor: () => ok?.totalAvista },
                      { id: 'outro', rotulo: 'Outro', valor: () => undefined },
                    ].map(op => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => {
                          setFormaPagamento(op.id)
                          const v = op.valor()
                          // a forma escolhida já preenche o valor real da venda
                          setValorCobrado(v != null ? v.toFixed(2) : '')
                        }}
                        className={cn(
                          'rounded-lg border px-2 py-2 text-xs font-semibold transition-all active:scale-95',
                          formaPagamento === op.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-foreground/60 hover:border-muted-foreground/40 hover:bg-muted/30',
                        )}
                      >
                        {op.rotulo}
                      </button>
                    ))}
                  </div>
                  <label className={labelCls}>Pagou de outro jeito? (opcional)</label>
                  <input
                    className={cn(inputCls, 'mb-3')}
                    placeholder="ex.: 5x no link, PIX + cartão"
                    maxLength={120}
                    value={formaReal}
                    onChange={e => setFormaReal(e.target.value)}
                  />
                  <label className={labelCls}>Valor cobrado do cliente</label>
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    placeholder={ok ? brl(ok.total4x).replace('R$ ', '') : ''}
                    value={valorCobrado}
                    onChange={e => setValorCobrado(e.target.value.replace(',', '.'))}
                  />
                  {(() => {
                    const cobrado = num(valorCobrado)
                    if (!ok || !cobrado || Math.abs(cobrado - ok.total4x) < 0.01) {
                      return <p className="mt-1 mb-3 text-[11px] text-foreground/40">Deixe vazio para cobrar o valor calculado.</p>
                    }
                    const dif = cobrado - ok.total4x
                    const pct = (dif / ok.total4x) * 100
                    return (
                      <p className={cn('mt-1 mb-3 text-[11px] font-semibold',
                        dif < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                        {dif < 0 ? 'Desconto' : 'Acréscimo'} de {brl(Math.abs(dif))} ({Math.abs(pct).toFixed(1)}%)
                        {dif < 0 && ok.custoProduto != null && (
                          <> · margem cai para {(((cobrado - (ok.custoProduto + (ok.custoAcabamento ?? 0))) / cobrado) * 100).toFixed(0)}%</>
                        )}
                      </p>
                    )
                  })()}
                  <button
                    type="button"
                    onClick={salvar}
                    disabled={salvando || calculando || salvoAtual}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-bold transition-all duration-150 active:scale-[0.98]',
                      salvoAtual
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 cursor-default'
                        : 'bg-brand-gradient text-white shadow-brand hover:opacity-95 disabled:opacity-60',
                    )}
                  >
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin" />
                      : salvoAtual ? <CheckCircle2 className="h-4 w-4" />
                      : <Save className="h-4 w-4" />}
                    {salvoAtual
                      ? (modoVenda ? 'Venda registrada! Troque o modelo pra somar outra' : 'Salvo! Troque o modelo pra salvar outro')
                      : (modoVenda ? 'Registrar venda' : 'Salvar orçamento')}
                  </button>
                  <p className="mt-1.5 text-[11px] text-foreground/40">
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    {modoVenda
                      ? 'Entra como venda fechada no Fechamento. Os dados do cliente continuam aqui pro próximo item.'
                      : 'Salva direto na Planilha, sem WhatsApp. Os dados do cliente continuam aqui pro próximo modelo.'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Limpar sempre à mão — zera produto, cliente e a lista da visita */}
          <button
            type="button"
            onClick={limparTudo}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
            title="Zera produto, cliente e os salvos — pronto pra próxima visita"
          >
            <Eraser className="h-3.5 w-3.5" />
            Limpar tudo
          </button>

          {/* Salvos nesta visita */}
          {salvos.length > 0 && (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">
                  Salvos nesta visita ({salvos.length})
                </p>
                <button
                  type="button"
                  onClick={limparTudo}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Limpar tudo e começar outra visita"
                >
                  <Eraser className="h-3 w-3" />
                  Limpar tudo
                </button>
              </div>
              <div className="divide-y divide-border/40">
                {salvos.map(s => (
                  <div key={s.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{s.modelo}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{s.detalhe}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-primary">{brl(s.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
