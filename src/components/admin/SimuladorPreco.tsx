import { useMemo, useState } from 'react'
import { Calculator, ChevronDown, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { simular, AcabamentoSim, EntradaSim, ModeloSim } from '@/lib/simulador'
import {
  usePrecosArtigos, usePrecosBandos, usePrecosBandosParams, usePrecosBarraFaixas,
  usePrecosColocacao, usePrecosFerragemComponentes, usePrecosParametros, usePrecosPh50,
  usePrecosTecidosVigentes,
} from '@/hooks/usePrecos'

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

const MODELOS: { id: ModeloSim; label: string }[] = [
  { id: 'Rolo', label: 'Rolô' },
  { id: 'Double', label: 'Double' },
  { id: 'PV', label: 'PV' },
  { id: 'PH_Aluminio', label: 'PH Alumínio' },
  { id: 'PH_50', label: 'PH 50mm' },
]

const selectCls =
  'rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'

export default function SimuladorPreco() {
  const [aberto, setAberto] = useState(true)
  const [modelo, setModelo] = useState<ModeloSim>('Rolo')
  const [tecido, setTecido] = useState('')
  const [artigo, setArtigo] = useState('')
  const [ph50Acab, setPh50Acab] = useState<'cadarco' | 'fita'>('cadarco')
  const [ph50Bando, setPh50Bando] = useState(false)
  const [corFerragem, setCorFerragem] = useState<'BRANCA' | 'PRETA'>('BRANCA')
  const [largura, setLargura] = useState('1,20')
  const [altura, setAltura] = useState('1,50')
  const [quantidade, setQuantidade] = useState('1')
  const [acabamento, setAcabamento] = useState<AcabamentoSim>('nenhum')
  const [instalacao, setInstalacao] = useState(false)

  const { data: tecidos } = usePrecosTecidosVigentes()
  const { data: componentes } = usePrecosFerragemComponentes()
  const { data: bandos } = usePrecosBandos()
  const { data: bandoParams } = usePrecosBandosParams()
  const { data: barraFaixas } = usePrecosBarraFaixas()
  const { data: colocacao } = usePrecosColocacao()
  const { data: artigos } = usePrecosArtigos()
  const { data: ph50 } = usePrecosPh50()
  const { data: parametros } = usePrecosParametros()

  const num = (s: string) => parseFloat(s.replace(',', '.')) || 0
  const nomesTecidos = useMemo(() => [...new Set((tecidos ?? []).map(t => t.nome))].sort(), [tecidos])
  const nomesArtigos = useMemo(() => {
    const cat = modelo === 'PV' ? 'PV' : 'PH_ALUMINIO'
    return (artigos ?? []).filter(a => a.categoria === cat).map(a => a.nome)
  }, [artigos, modelo])
  const itensPh50 = useMemo(() => (ph50 ?? []).map(p => ({ valor: `${p.modelo}|${p.cor}`, label: `${p.modelo.trim()} · ${p.cor}` })), [ph50])

  const carregado = tecidos && componentes && bandos && bandoParams && barraFaixas && colocacao && artigos && ph50 && parametros

  const resultado = useMemo(() => {
    if (!carregado) return null
    const entrada: EntradaSim = {
      modelo, tecido: tecido || undefined, artigo: artigo || undefined,
      ph50Acabamento: ph50Acab, ph50Bando, corFerragem,
      largura: num(largura), altura: num(altura), quantidade: Math.max(1, Math.round(num(quantidade))),
      acabamento, incluirInstalacao: instalacao,
    }
    return simular(entrada, {
      tecidos: tecidos!, componentes: componentes!, bandos: bandos!, bandoParams: bandoParams!,
      barraFaixas: barraFaixas!, colocacao: colocacao!, artigos: artigos!, ph50: ph50!, parametros: parametros!,
    })
  }, [carregado, modelo, tecido, artigo, ph50Acab, ph50Bando, corFerragem, largura, altura, quantidade,
    acabamento, instalacao, tecidos, componentes, bandos, bandoParams, barraFaixas, colocacao, artigos, ph50, parametros])

  const comTecido = modelo === 'Rolo' || modelo === 'Double'
  const ok = resultado && !('erro' in resultado) ? resultado : null

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
      <button onClick={() => setAberto(a => !a)}
        className="flex w-full items-center gap-2.5 px-5 py-4 text-left hover:bg-muted/30">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Calculator className="h-3.5 w-3.5 text-primary" />
        </div>
        <h2 className="font-display text-sm font-semibold tracking-wide">Simulador de orçamento</h2>
        <span className="hidden sm:inline text-xs text-muted-foreground">— o mesmo cálculo dos agentes, ao vivo: mudou um preço, muda aqui</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div className="border-t px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <select className={selectCls} value={modelo}
              onChange={e => { setModelo(e.target.value as ModeloSim); setTecido(''); setArtigo(''); setAcabamento('nenhum'); setPh50Bando(false) }}>
              {MODELOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>

            {comTecido && (
              <>
                <select className={cn(selectCls, 'max-w-56')} value={tecido} onChange={e => setTecido(e.target.value)}>
                  <option value="">Tecido…</option>
                  {nomesTecidos.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <select className={selectCls} value={corFerragem} onChange={e => setCorFerragem(e.target.value as 'BRANCA' | 'PRETA')}>
                  <option value="BRANCA">Ferragem branca</option>
                  <option value="PRETA">Ferragem preta</option>
                </select>
                <select className={selectCls} value={acabamento} onChange={e => setAcabamento(e.target.value as AcabamentoSim)}>
                  <option value="nenhum">Sem acabamento</option>
                  <option value="bando_branco">Bandô branco</option>
                  <option value="bando_preto">Bandô preto</option>
                  <option value="barra">Barra niveladora</option>
                  {modelo === 'Rolo' && <option value="kit_box">Kit Box</option>}
                </select>
              </>
            )}

            {(modelo === 'PV' || modelo === 'PH_Aluminio') && (
              <select className={cn(selectCls, 'max-w-64')} value={artigo} onChange={e => setArtigo(e.target.value)}>
                <option value="">Artigo…</option>
                {nomesArtigos.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}

            {modelo === 'PH_50' && (
              <>
                <select className={cn(selectCls, 'max-w-64')} value={artigo} onChange={e => setArtigo(e.target.value)}>
                  <option value="">Modelo / cor…</option>
                  {itensPh50.map(i => <option key={i.valor} value={i.valor}>{i.label}</option>)}
                </select>
                <select className={selectCls} value={ph50Acab} onChange={e => setPh50Acab(e.target.value as 'cadarco' | 'fita')}>
                  <option value="cadarco">Com cadarço</option>
                  <option value="fita">Com fita</option>
                </select>
                <label className="flex items-center gap-1.5 text-sm font-medium">
                  <input type="checkbox" checked={ph50Bando} onChange={e => setPh50Bando(e.target.checked)}
                    className="h-4 w-4 accent-primary" />
                  Bandô
                </label>
              </>
            )}

            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">L</span>
              <input className={cn(selectCls, 'w-20')} inputMode="decimal" value={largura} onChange={e => setLargura(e.target.value)} />
              <span className="text-muted-foreground">×  A</span>
              <input className={cn(selectCls, 'w-20')} inputMode="decimal" value={altura} onChange={e => setAltura(e.target.value)} />
              <span className="text-muted-foreground">m ×</span>
              <input className={cn(selectCls, 'w-14')} inputMode="numeric" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
              <span className="text-muted-foreground">un</span>
            </label>

            <label className="flex items-center gap-1.5 text-sm font-medium">
              <input type="checkbox" checked={instalacao} onChange={e => setInstalacao(e.target.checked)}
                className="h-4 w-4 accent-primary" />
              Instalação
            </label>
          </div>

          {resultado && 'erro' in resultado && (
            <p className="text-sm text-muted-foreground">{resultado.erro}.</p>
          )}

          {ok && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border-2 border-primary/20 bg-primary/10 dark:bg-primary/15 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Valor em 4x</p>
                  <p className="font-display text-xl font-bold text-primary tabular-nums">{brl(ok.total4x)}</p>
                </div>
                <div className="rounded-xl border-2 bg-card p-3 text-center shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">À vista (−5%)</p>
                  <p className="font-display text-xl font-bold tabular-nums">{brl(ok.totalAvista)}</p>
                </div>
                <div className="rounded-xl border-2 bg-card p-3 text-center shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Custo</p>
                  <p className="font-display text-xl font-bold tabular-nums">{brl(ok.custoProduto + ok.custoAcabamento)}</p>
                </div>
                <div className="rounded-xl border-2 bg-card p-3 text-center shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Instalação</p>
                  <p className="font-display text-xl font-bold tabular-nums">
                    {ok.instalacao == null ? '—' : ok.instalacao === 'sob_consulta' ? 'consulta' : brl(ok.instalacao)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {ok.emPromocao && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                    <Tag className="h-3 w-3" /> tecido em promoção {ok.descontoPct != null && `(−${ok.descontoPct}%)`}
                  </span>
                )}
                {ok.vendaAcabamento > 0 && <span>Acabamento: {brl(ok.vendaAcabamento)} (já no total)</span>}
                {ok.observacoes.map((o, i) => <span key={i}>{o}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
