/**
 * Simulador de balcão — atendente da loja com o cliente na frente.
 * O cálculo roda no SERVIDOR (edge function `simular`, mesmo motor dos agentes);
 * a atendente vê só o valor de venda. Custo e margem só aparecem para admin.
 * "Salvar orçamento" grava direto na tabela orcamentos (fonte='simulador').
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator, CheckCircle2, ChevronRight, Loader2, Save, Sparkles, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/useToast'
import Toaster from '@/components/ui/Toaster'

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

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

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3.5 py-3 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/50 hover:border-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all duration-150'
const labelCls =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-foreground/50 dark:text-foreground/55'

export default function TabSimulador() {
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
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvoId, setSalvoId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chamadaRef = useRef(0)

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
    setSalvoId(null)
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
    if (!resultado || resultado.erro || salvando) return
    setSalvando(true)
    try {
      const { data, error } = await supabase.functions.invoke('simular', {
        body: { acao: 'salvar', entrada, cliente: cliente.trim() },
      })
      if (error) throw error
      if ((data as { error?: string }).error) throw new Error((data as { error: string }).error)
      setSalvoId((data as { id: string }).id)
      toast('success', `Orçamento de ${(data as { cliente: string }).cliente} salvo na Planilha!`)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Erro ao salvar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
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
      <div className="mx-auto max-w-2xl">
        {/* ── Cabeçalho ── */}
        <div className="mb-6 flex flex-col items-center text-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-foreground/40">Dashboard</span>
            <ChevronRight className="h-3 w-3 text-foreground/30" />
            <span className="text-xs font-medium text-primary">Simulador</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Preço na hora
          </h2>
          <p className="text-sm text-foreground/50">
            O mesmo cálculo dos orçamentos oficiais, direto do banco de preços.
          </p>
        </div>

        {/* ── Formulário ── */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
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

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div>
              <label className={labelCls}>Largura (m)</label>
              <input className={inputCls} inputMode="decimal" placeholder="1,20"
                value={largura} onChange={e => setLargura(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Altura (m)</label>
              <input className={inputCls} inputMode="decimal" placeholder="1,50"
                value={altura} onChange={e => setAltura(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Qtd</label>
              <input className={inputCls} inputMode="numeric"
                value={quantidade} onChange={e => setQuantidade(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={instalacao} onChange={e => setInstalacao(e.target.checked)}
              className="h-4 w-4 accent-primary" />
            Incluir instalação
          </label>
        </div>

        {/* ── Resultado ── */}
        <div className="mt-4">
          {!pronto && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-foreground/40">
              <Calculator className="mx-auto mb-2 h-6 w-6" />
              Escolha o produto e as medidas — o preço aparece aqui na hora.
            </div>
          )}

          {pronto && resultado?.erro && !calculando && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center text-sm font-medium text-amber-700 dark:text-amber-400">
              {resultado.erro}
            </div>
          )}

          {pronto && (ok || calculando) && (
            <div className={cn('rounded-2xl border-2 border-primary/25 bg-card p-5 shadow-sm transition-opacity', calculando && 'opacity-60')}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Valor pro cliente</p>
                {calculando && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              {ok && (
                <>
                  <p className="mt-1 font-display text-4xl font-bold tabular-nums text-primary">
                    {brl(ok.total4x)}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground/60">
                    em até <strong>4x de {brl(ok.total4x / 4)}</strong> sem juros
                    · à vista <strong>{brl(ok.totalAvista)}</strong> (−5%)
                  </p>
                  {ok.instalacao != null && (
                    <p className="mt-1 text-sm text-foreground/60">
                      Instalação: <strong>{ok.instalacao === 'sob_consulta' ? 'sob consulta' : brl(ok.instalacao)}</strong>
                      {typeof ok.instalacao === 'number' && <> · total com instalação <strong>{brl(ok.total4x + ok.instalacao)}</strong></>}
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
                      <span className="text-foreground/35">(visível só para admin)</span>
                    </div>
                  )}

                  {/* ── Salvar ── */}
                  <div className="mt-4 border-t border-border/60 pt-4">
                    {salvoId ? (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Salvo na Planilha! Já aparece no funil.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input className={cn(inputCls, 'sm:flex-1')} placeholder="Nome do cliente (opcional)"
                          value={cliente} onChange={e => setCliente(e.target.value)} />
                        <button
                          type="button"
                          onClick={salvar}
                          disabled={salvando || calculando}
                          className="flex items-center justify-center gap-2 rounded-lg bg-brand-gradient px-5 py-3 text-sm font-bold text-white shadow-brand transition-all duration-150 hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
                        >
                          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Salvar orçamento
                        </button>
                      </div>
                    )}
                    <p className="mt-1.5 text-[11px] text-foreground/40">
                      <Sparkles className="mr-1 inline h-3 w-3" />
                      Salva direto na Planilha, sem WhatsApp — pra registrar a consulta do balcão.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
