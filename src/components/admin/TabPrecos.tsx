import { Fragment, useMemo, useState } from 'react'
import {
  Blinds, CircleDollarSign, Cog, Layers, Loader2, Percent, RefreshCw, Ruler, Search, Settings2, Sparkles, Tag, Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import PrecosGrid, { ColunaDef } from './PrecosGrid'
import PrecosIA from './PrecosIA'
import SimuladorPreco from './SimuladorPreco'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  statusPromocao, usePrecosArtigos, usePrecosBandos, usePrecosBandosParams, usePrecosBarraFaixas, usePrecosColocacao,
  usePrecosFerragemComponentes, usePrecosFerragemEscada, usePrecosFerragemFamilias,
  usePrecosMotorComponentes, usePrecosMotorEstrutura, usePrecosMutations, usePrecosParametros,
  usePrecosPh50, usePrecosPromocoes, usePrecosRomanaMatriz, usePrecosTecidoModelos, usePrecosTecidos,
  MODELOS_PERSIANA,
} from '@/hooks/usePrecos'

interface Props { toast: (type: 'success' | 'error', message: string) => void }

const fmtBRL = (v: unknown) =>
  `R$ ${(Math.round((Number(v ?? 0) + 1e-9) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtNum = (v: unknown) => Number(v ?? 0).toLocaleString('pt-BR')

// ordem lógica: IA + promoções | produtos (tecidos e modelos) | estrutura (ferragem, acabamento, motor) | markups
const SECOES = [
  { id: 'ia',         label: 'Assistente',     icon: Sparkles,  fimGrupo: false },
  { id: 'promocoes',  label: 'Promoções',      icon: Percent,   fimGrupo: true },
  { id: 'tecidos',    label: 'Tecidos',        icon: Layers,    fimGrupo: false },
  { id: 'artigos',    label: 'PV / PH Alumínio', icon: Blinds,  fimGrupo: false },
  { id: 'ph50',       label: 'PH 50mm',        icon: Blinds,    fimGrupo: true },
  { id: 'ferragens',  label: 'Ferragens',      icon: Wrench,    fimGrupo: false },
  { id: 'bandos',     label: 'Bandôs',         icon: Tag,       fimGrupo: false },
  { id: 'barra',      label: 'Barra Niv.',     icon: Ruler,     fimGrupo: false },
  { id: 'colocacao',  label: 'Instalação',     icon: Cog,       fimGrupo: false },
  { id: 'motor',      label: 'Motor',          icon: Cog,       fimGrupo: true },
  { id: 'parametros', label: 'Parâmetros',     icon: Settings2, fimGrupo: false },
] as const

type SecaoId = typeof SECOES[number]['id']

export default function TabPrecos({ toast }: Props) {
  const [secao, setSecao] = useState<SecaoId>('ia')
  const [promoPrefill, setPromoPrefill] = useState<string | null>(null)
  const { updateRow, insertRow, deleteRow } = usePrecosMutations()

  const salvar = (table: string) => async (
    match: Record<string, unknown>, patch: Record<string, unknown>, antes?: Record<string, unknown>,
  ) => {
    try { await updateRow(table, match, patch, antes); toast('success', 'Salvo!') }
    catch { toast('error', 'Erro ao salvar — confira os dados') }
  }
  const excluir = (table: string) => async (match: Record<string, unknown>, antes?: Record<string, unknown>) => {
    try { await deleteRow(table, match, antes); toast('success', 'Excluído') }
    catch { toast('error', 'Erro ao excluir') }
  }
  const adicionar = (table: string) => async (row: Record<string, unknown>) => {
    try { await insertRow(table, row); toast('success', 'Adicionado!') }
    catch { toast('error', 'Erro ao adicionar — confira os dados') }
  }

  const { data: kpiTecidos } = usePrecosTecidos()
  const { data: kpiPromos } = usePrecosPromocoes()
  const { data: kpiParams } = usePrecosParametros()
  const { data: kpiFamilias } = usePrecosFerragemFamilias()
  const promosAtivas = (kpiPromos ?? []).filter(p => statusPromocao(p) === 'ativa').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Tabela de Preços</h2>
          <p className="text-xs text-muted-foreground">
            Fonte central de preços e promoções — a planilha-espelho se atualiza a cada 30 min ou pelo botão.
          </p>
        </div>
        <BotaoSincronizar toast={toast} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Tecidos', value: new Set((kpiTecidos ?? []).map(t => t.nome)).size },
          { label: 'Promoções ativas', value: promosAtivas },
          { label: 'Famílias de ferragem', value: (kpiFamilias ?? []).length },
          { label: 'Parâmetros', value: (kpiParams ?? []).length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border-2 border-primary/20 bg-primary/10 dark:bg-primary/15 p-4 shadow-sm flex flex-col items-center text-center gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{label}</p>
            <p className="font-display text-2xl font-bold text-primary">{value}</p>
          </div>
        ))}
      </div>

      <SimuladorPreco />

      <div className="flex flex-wrap items-stretch gap-1 rounded-xl bg-muted/50 p-1">
        {SECOES.map(({ id, label, icon: Icon, fimGrupo }) => (
          <Fragment key={id}>
            <button onClick={() => setSecao(id)} title={label}
              className={cn(
                'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                secao === id ? 'bg-card text-primary shadow-elevated' : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
              )}>
              <Icon className="h-4 w-4 shrink-0" />{label}
            </button>
            {fimGrupo && <div className="mx-1 my-1.5 w-px bg-border" />}
          </Fragment>
        ))}
      </div>

      {secao === 'ia' && <PrecosIA toast={toast} />}
      {secao === 'tecidos' && (
        <SecaoTecidos salvar={salvar} excluir={excluir} adicionar={adicionar}
          onCriarPromocao={nome => { setPromoPrefill(nome); setSecao('promocoes') }} />
      )}
      {secao === 'promocoes' && <SecaoPromocoes toast={toast} prefill={promoPrefill} />}
      {secao === 'artigos' && <SecaoArtigos salvar={salvar} excluir={excluir} adicionar={adicionar} />}
      {secao === 'ph50' && <SecaoPh50 salvar={salvar} excluir={excluir} adicionar={adicionar} />}
      {secao === 'ferragens' && <SecaoFerragens salvar={salvar} />}
      {secao === 'bandos' && <SecaoBandos salvar={salvar} excluir={excluir} adicionar={adicionar} />}
      {secao === 'barra' && <SecaoBarra salvar={salvar} />}
      {secao === 'colocacao' && <SecaoColocacao salvar={salvar} excluir={excluir} adicionar={adicionar} />}
      {secao === 'motor' && <SecaoMotor salvar={salvar} />}
      {secao === 'parametros' && <SecaoParametros salvar={salvar} />}
    </div>
  )
}

/* ─── helpers de seção ───────────────────────────────────── */
type SalvarFn = (table: string) => (match: Record<string, unknown>, patch: Record<string, unknown>, antes?: Record<string, unknown>) => Promise<void>
type ExcluirFn = (table: string) => (match: Record<string, unknown>, antes?: Record<string, unknown>) => Promise<void>
type AdicionarFn = (table: string) => (row: Record<string, unknown>) => Promise<void>
interface SecaoProps { salvar: SalvarFn; excluir?: ExcluirFn; adicionar?: AdicionarFn }

function Carregando() {
  return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
}

const CATEGORIAS_TECIDO = [
  { value: 'blackout', label: 'Blackout' }, { value: 'tela_solar', label: 'Tela Solar' },
  { value: 'decorativo', label: 'Decorativo' }, { value: 'outro', label: 'Outro' },
] as const

function SecaoTecidos({ salvar, excluir, adicionar, onCriarPromocao }: SecaoProps & { onCriarPromocao: (nome: string) => void }) {
  const { data, isLoading } = usePrecosTecidos()
  const { data: promocoes } = usePrecosPromocoes()
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')

  const promoAtiva = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const p of promocoes ?? []) {
      if (statusPromocao(p) === 'ativa') mapa.set(p.alvo_nome, Math.max(mapa.get(p.alvo_nome) ?? 0, Number(p.desconto_pct)))
    }
    return mapa
  }, [promocoes])

  const linhas = useMemo(() => (data ?? [])
    .filter(t => !categoria || t.tipo === categoria)
    .filter(t => !busca || t.nome.toLowerCase().includes(busca.toLowerCase()))
    .map(t => ({ ...t, promo: promoAtiva.has(t.nome) ? `🏷️ −${fmtNum(promoAtiva.get(t.nome))}%` : '' })),
  [data, categoria, busca, promoAtiva])

  const colunas: ColunaDef[] = [
    { key: 'nome', label: 'Tecido', tipo: 'texto' },
    { key: 'tipo', label: 'Categoria', tipo: 'select', options: [...CATEGORIAS_TECIDO] },
    { key: 'largura', label: 'Largura (m)', tipo: 'numero', formato: fmtNum },
    { key: 'preco', label: 'Preço/m²', tipo: 'numero', formato: fmtBRL },
    { key: 'promo', label: 'Promoção', tipo: 'texto', readonly: true },
  ]
  if (isLoading) return <Carregando />
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tecido…"
            className="w-56 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ value: '', label: 'Todos' }, ...CATEGORIAS_TECIDO].map(c => {
            const n = c.value === ''
              ? new Set((data ?? []).map(t => t.nome)).size
              : new Set((data ?? []).filter(t => t.tipo === c.value).map(t => t.nome)).size
            return (
              <button key={c.value} onClick={() => setCategoria(c.value)}
                className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-colors active:scale-95',
                  categoria === c.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                {c.label} · {n}
              </button>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        A categoria alimenta buscas como “blackout mais barato”. Cada largura de rolo é uma linha.
        O ícone <Percent className="inline h-3 w-3" /> cria uma promoção já com o tecido escolhido.
      </p>
      <PrecosGrid colunas={colunas} linhas={linhas} chave={r => ({ id: r.id })}
        onSalvar={salvar('precos_tecidos')} onExcluir={excluir!('precos_tecidos')}
        onAdicionar={adicionar!('precos_tecidos')}
        acaoLinha={{ titulo: 'Criar promoção deste tecido', icone: <Percent className="h-3.5 w-3.5" />, onClick: r => onCriarPromocao(r.nome) }}
        conferirMudanca={(row, patch) => {
          const antes = Number(row.preco), depois = Number(patch.preco)
          if (antes > 0 && depois > 0 && (depois > antes * 2 || depois < antes / 2)) {
            return `Preço muito diferente do atual (${fmtBRL(antes)} → ${fmtBRL(depois)}). Confere se não foi erro de digitação.`
          }
          return null
        }} />
      <VinculoModelos tecidos={data ?? []} />
    </div>
  )
}

function VinculoModelos({ tecidos }: { tecidos: { nome: string }[] }) {
  const { data: vinculos, isLoading } = usePrecosTecidoModelos()
  const { insertRow, deleteRow } = usePrecosMutations()
  const [tecido, setTecido] = useState('')
  const [mexendo, setMexendo] = useState<string | null>(null)
  const nomes = useMemo(() => [...new Set(tecidos.map(t => t.nome))], [tecidos])
  const meus = useMemo(() => new Set((vinculos ?? []).filter(v => v.tecido_nome === tecido).map(v => v.modelo)), [vinculos, tecido])

  async function alternar(modelo: string) {
    if (!tecido) return
    setMexendo(modelo)
    try {
      if (meus.has(modelo)) await deleteRow('precos_tecido_modelos', { tecido_nome: tecido, modelo })
      else await insertRow('precos_tecido_modelos', { tecido_nome: tecido, modelo })
    } finally { setMexendo(null) }
  }

  return (
    <div className="rounded-xl border-2 bg-card shadow-sm p-4">
      <p className="font-display text-sm font-semibold tracking-wide">Em quais modelos cada tecido entra</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Um tecido só aparece nos orçamentos dos modelos marcados aqui (é o que gera a aba DADOS_TECIDOS).
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <CustomSelect className="py-2 sm:w-64" value={tecido} onChange={setTecido}
          options={nomes} placeholder="Escolha o tecido…" />
        {tecido && !isLoading && (
          <div className="flex flex-wrap gap-1.5">
            {MODELOS_PERSIANA.map(m => (
              <button key={m} onClick={() => alternar(m)} disabled={mexendo === m}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors active:scale-95',
                  meus.has(m) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                )}>
                {mexendo === m ? '…' : m.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SecaoPromocoes({ toast, prefill }: { toast: Props['toast']; prefill?: string | null }) {
  const { data: promocoes, isLoading } = usePrecosPromocoes()
  const { data: tecidos } = usePrecosTecidos()
  const { insertRow, deleteRow } = usePrecosMutations()
  const [form, setForm] = useState(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    const semana = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    return prefill
      ? { alvo_nome: prefill, desconto_pct: '', inicio: hoje, fim: semana }
      : { alvo_nome: '', desconto_pct: '', inicio: '', fim: '' }
  })
  const [salvando, setSalvando] = useState(false)
  const nomes = useMemo(() => [...new Set((tecidos ?? []).map(t => t.nome))], [tecidos])

  async function criar() {
    if (!form.alvo_nome || !form.desconto_pct || !form.inicio || !form.fim) {
      toast('error', 'Preencha tecido, desconto e o período'); return
    }
    if (form.fim < form.inicio) {
      toast('error', 'A data final precisa ser depois da inicial'); return
    }
    setSalvando(true)
    try {
      await insertRow('precos_promocoes', {
        alvo_tipo: 'tecido', alvo_nome: form.alvo_nome,
        desconto_pct: parseFloat(form.desconto_pct.replace(',', '.')),
        inicio: form.inicio, fim: form.fim,
      })
      setForm({ alvo_nome: '', desconto_pct: '', inicio: '', fim: '' })
      toast('success', 'Promoção criada! Entra e sai sozinha nas datas.')
    } catch { toast('error', 'Erro ao criar promoção') }
    finally { setSalvando(false) }
  }

  const inputCls = 'rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary'
  const badge = { ativa: 'bg-emerald-500/15 text-emerald-600', agendada: 'bg-amber-500/15 text-amber-600', expirada: 'bg-muted text-muted-foreground' }
  if (isLoading) return <Carregando />
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 bg-card shadow-sm p-4">
        <p className="mb-3 font-display text-sm font-semibold tracking-wide">Nova promoção de tecido</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <CustomSelect className="py-2 sm:col-span-2" value={form.alvo_nome}
            onChange={v => setForm(f => ({ ...f, alvo_nome: v }))}
            options={nomes} placeholder="Escolha o tecido…" />
          <input className={inputCls} placeholder="% desconto" inputMode="decimal" value={form.desconto_pct}
            onChange={e => setForm(f => ({ ...f, desconto_pct: e.target.value }))} />
          <input className={inputCls} type="date" value={form.inicio}
            onChange={e => setForm(f => ({ ...f, inicio: e.target.value }))} />
          <input className={inputCls} type="date" value={form.fim}
            onChange={e => setForm(f => ({ ...f, fim: e.target.value }))} />
        </div>
        <button onClick={criar} disabled={salvando}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {salvando ? 'Criando…' : 'Criar promoção'}
        </button>
      </div>

      <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/40">
            <th className="border border-border/60 px-4 py-2.5 text-center font-semibold text-muted-foreground">Tecido</th>
            <th className="border border-border/60 px-4 py-2.5 text-center font-semibold text-muted-foreground">Desconto</th>
            <th className="border border-border/60 px-4 py-2.5 text-center font-semibold text-muted-foreground">Período</th>
            <th className="border border-border/60 px-4 py-2.5 text-center font-semibold text-muted-foreground">Status</th>
            <th className="w-16 border border-border/60 px-4 py-2.5" />
          </tr></thead>
          <tbody>
            {(promocoes ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma promoção cadastrada.</td></tr>
            )}
            {(promocoes ?? []).map(p => {
              const st = statusPromocao(p)
              const diasPraVencer = Math.ceil((new Date(p.fim + 'T23:59:59').getTime() - Date.now()) / 86400000)
              const vencendo = st === 'ativa' && diasPraVencer <= 3
              return (
                <tr key={p.id}>
                  <td className="border border-border/50 px-4 py-2.5 text-center font-semibold">{p.alvo_nome}</td>
                  <td className="border border-border/50 px-4 py-2.5 text-center tabular-nums">−{fmtNum(p.desconto_pct)}%</td>
                  <td className="border border-border/50 px-4 py-2.5 text-center tabular-nums">
                    {new Date(p.inicio + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(p.fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="border border-border/50 px-4 py-2.5 text-center">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', badge[st])}>{st}</span>
                    {vencendo && (
                      <span className="ml-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600">
                        {diasPraVencer <= 0 ? 'vence hoje' : diasPraVencer === 1 ? 'vence amanhã' : `vence em ${diasPraVencer} dias`}
                      </span>
                    )}
                  </td>
                  <td className="border border-border/50 px-4 py-2.5 text-center">
                    <button onClick={async () => {
                      if (!confirm('Remover esta promoção?')) return
                      try { await deleteRow('precos_promocoes', { id: p.id }); toast('success', 'Promoção removida') }
                      catch { toast('error', 'Erro ao remover') }
                    }} className="text-xs font-semibold text-destructive hover:underline">Remover</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SecaoArtigos({ salvar, excluir, adicionar }: SecaoProps) {
  const { data, isLoading } = usePrecosArtigos()
  const colunas: ColunaDef[] = [
    { key: 'categoria', label: 'Linha', tipo: 'select', options: [
      { value: 'PV', label: 'PV (Vertical)' }, { value: 'PH_ALUMINIO', label: 'PH Alumínio 25mm' }] },
    { key: 'nome', label: 'Artigo', tipo: 'texto' },
    { key: 'preco', label: 'Preço/m²', tipo: 'numero', formato: fmtBRL },
  ]
  if (isLoading) return <Carregando />
  return <PrecosGrid colunas={colunas} linhas={data ?? []} chave={r => ({ id: r.id })}
    onSalvar={salvar('precos_artigos')} onExcluir={excluir!('precos_artigos')} onAdicionar={adicionar!('precos_artigos')}
    conferirMudanca={(row, patch) => {
      const antes = Number(row.preco), depois = Number(patch.preco)
      if (antes > 0 && depois > 0 && (depois > antes * 2 || depois < antes / 2)) {
        return `Preço muito diferente do atual (${fmtBRL(antes)} → ${fmtBRL(depois)}). Confere se não foi erro de digitação.`
      }
      return null
    }} />
}

function SecaoPh50({ salvar, excluir, adicionar }: SecaoProps) {
  const { data, isLoading } = usePrecosPh50()
  const colunas: ColunaDef[] = [
    { key: 'modelo', label: 'Modelo', tipo: 'texto' },
    { key: 'cor', label: 'Cor', tipo: 'texto' },
    { key: 'preco_cadarco', label: 'Cadarço/m²', tipo: 'numero', formato: fmtBRL },
    { key: 'preco_fita', label: 'Fita/m²', tipo: 'numero', formato: fmtBRL },
    { key: 'bando_ml', label: 'Bandô/ml', tipo: 'numero', formato: fmtBRL },
    { key: 'aba_pc', label: 'Aba/pç', tipo: 'numero', formato: fmtBRL },
  ]
  if (isLoading) return <Carregando />
  return <PrecosGrid colunas={colunas} linhas={data ?? []} chave={r => ({ id: r.id })}
    onSalvar={salvar('precos_ph50')} onExcluir={excluir!('precos_ph50')} onAdicionar={adicionar!('precos_ph50')} />
}

function SecaoFerragens({ salvar }: SecaoProps) {
  const { data: familias, isLoading: l1 } = usePrecosFerragemFamilias()
  const { data: componentes, isLoading: l2 } = usePrecosFerragemComponentes()
  const { data: escada } = usePrecosFerragemEscada()
  const [fam, setFam] = useState<string>('')
  if (l1 || l2) return <Carregando />

  const chaves = (familias ?? []).map(f => `${f.familia}|${f.cor}|${f.espessura}`)
  const atual = fam || chaves[0] || ''
  const [cFam, cCor, cEsp] = atual.split('|')
  const comps = (componentes ?? []).filter(c => c.familia === cFam && c.cor === cCor && String(c.espessura) === cEsp)
  const escadaFam = (escada ?? []).filter(e => e.familia === cFam && e.cor === cCor && String(e.espessura) === cEsp)
  const somaMl = comps.filter(c => c.tipo_custo === 'por_metro').reduce((s, c) => s + Number(c.valor), 0)
  const somaFixo = comps.filter(c => c.tipo_custo === 'fixo').reduce((s, c) => s + Number(c.valor), 0)

  const colunas: ColunaDef[] = [
    { key: 'item', label: 'Componente', tipo: 'texto' },
    { key: 'tipo_custo', label: 'Cobrança', tipo: 'select', options: [
      { value: 'por_metro', label: 'Por metro' }, { value: 'fixo', label: 'Fixo' },
      { value: 'opcional_ml', label: 'Opcional (por metro)' }, { value: 'opcional_par', label: 'Opcional (por par)' }] },
    { key: 'valor', label: 'Valor', tipo: 'numero', formato: fmtBRL },
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {[...chaves, 'ROMANA'].map(c => {
          const [f, cor, esp] = c.split('|')
          const label = c === 'ROMANA' ? 'ROMANA (matriz)' : `${f} ${cor}${esp !== '0' ? ` ${esp}mm` : ''}`
          return (
            <button key={c} onClick={() => setFam(c)}
              className={cn('rounded-full px-3 py-1 text-xs font-semibold',
                atual === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          )
        })}
      </div>
      {atual === 'ROMANA' ? (
        <MatrizRomana salvar={salvar} />
      ) : escadaFam.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Esta família usa tabela de valores direta (os componentes da planilha não batiam com a escada).
          </p>
          <PrecosGrid
            colunas={[
              { key: 'largura', label: 'Largura (m)', tipo: 'numero', readonly: true, formato: fmtNum },
              { key: 'custo', label: 'Custo', tipo: 'numero', formato: fmtBRL },
            ]}
            linhas={escadaFam}
            chave={r => ({ familia: r.familia, cor: r.cor, espessura: r.espessura, largura: r.largura })}
            onSalvar={salvar('precos_ferragem_escada')} />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
            Custo calculado: <b className="tabular-nums">{fmtBRL(somaMl)}</b> por metro + <b className="tabular-nums">{fmtBRL(somaFixo)}</b> fixo.
            Ex.: 2,00m → <b className="tabular-nums">{fmtBRL(somaMl * 2 + somaFixo)}</b>. Edite os componentes que a escada inteira se recalcula.
            Itens marcados como “Opcional” são cobrados à parte e ficam fora dessa soma.
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PrecosGrid colunas={colunas} linhas={comps} chave={r => ({ id: r.id })}
                onSalvar={salvar('precos_ferragem_componentes')} />
            </div>
            <EscadaCalculada
              titulo="Tabela gerada (igual à planilha)"
              linhas={escadaCalculada(familias?.find(f => `${f.familia}|${f.cor}|${f.espessura}` === atual), somaMl, somaFixo)} />
          </div>
        </div>
      )}
    </div>
  )
}

function escadaCalculada(
  fam: { larg_min: number; larg_max: number; passo: number } | undefined, somaMl: number, somaFixo: number,
): { largura: number; valor: number }[] {
  if (!fam) return []
  const out: { largura: number; valor: number }[] = []
  for (let L = Number(fam.larg_min); L <= Number(fam.larg_max) + 1e-9; L += Number(fam.passo)) {
    const Lr = Math.round(L * 100) / 100
    out.push({ largura: Lr, valor: somaMl * Lr + somaFixo })
  }
  return out
}

function EscadaCalculada({ titulo, linhas, colunasExtras }: {
  titulo: string
  linhas: { largura: number; valor: number; extras?: (string | number)[] }[]
  colunasExtras?: string[]
}) {
  return (
    <div className="rounded-xl border-2 bg-card shadow-sm overflow-hidden self-start">
      <p className="border-b bg-muted/40 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {titulo}
      </p>
      <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th className="border border-border/60 px-3 py-2 text-center font-semibold text-muted-foreground">Largura</th>
              {(colunasExtras ?? []).map(c => (
                <th key={c} className="border border-border/60 px-3 py-2 text-center font-semibold text-muted-foreground">{c}</th>
              ))}
              <th className="border border-border/60 px-3 py-2 text-center font-semibold text-muted-foreground">Preço</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.largura}>
                <td className="border border-border/50 px-3 py-1.5 text-center font-semibold tabular-nums">{fmtNum(l.largura)}</td>
                {(l.extras ?? []).map((e, i) => (
                  <td key={i} className="border border-border/50 px-3 py-1.5 text-center tabular-nums">{e}</td>
                ))}
                <td className="border border-border/50 px-3 py-1.5 text-center tabular-nums">{fmtBRL(l.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MatrizRomana({ salvar }: { salvar: SalvarFn }) {
  const { data, isLoading } = usePrecosRomanaMatriz()
  const [editando, setEditando] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [salvandoCel, setSalvandoCel] = useState(false)

  const { largs, alts, porChave } = useMemo(() => {
    const largs = [...new Set((data ?? []).map(r => Number(r.largura)))].sort((a, b) => a - b)
    const alts = [...new Set((data ?? []).map(r => Number(r.altura)))].sort((a, b) => a - b)
    const porChave = new Map((data ?? []).map(r => [`${Number(r.largura)}|${Number(r.altura)}`, Number(r.custo)]))
    return { largs, alts, porChave }
  }, [data])

  if (isLoading) return <Carregando />

  async function salvarCelula(L: number, A: number) {
    const novo = parseFloat(valor.replace(',', '.'))
    const antes = porChave.get(`${L}|${A}`)
    if (!(novo > 0) || novo === antes) { setEditando(null); return }
    setSalvandoCel(true)
    try {
      await salvar('precos_romana_matriz')({ largura: L, altura: A }, { custo: novo }, { custo: antes })
      setEditando(null)
    } finally { setSalvandoCel(false) }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Custo da ferragem Romana por largura × altura (célula usada: a mais próxima <i>para cima</i> da medida).
        Clique numa célula para editar. Espelhada na aba SYNC_Custo M2 da planilha “Romana - Sombrear”.
      </p>
      <div className="rounded-xl border-2 bg-card shadow-sm overflow-x-auto" style={{ maxHeight: 480, overflowY: 'auto' }}>
        <table className="text-xs tabular-nums" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-muted px-2 py-1.5 text-left font-semibold text-muted-foreground">A \ L</th>
              {largs.map(l => (
                <th key={l} className="sticky top-0 z-10 bg-muted px-2 py-1.5 font-semibold text-muted-foreground">{fmtNum(l)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alts.map(a => (
              <tr key={a}>
                <td className="sticky left-0 z-10 bg-muted px-2 py-1 font-semibold text-muted-foreground">{fmtNum(a)}</td>
                {largs.map(l => {
                  const chave = `${l}|${a}`
                  const em = editando === chave
                  return (
                    <td key={l} className="border-b border-l border-border/40 p-0 text-right">
                      {em ? (
                        <input autoFocus value={valor} disabled={salvandoCel}
                          onChange={e => setValor(e.target.value)}
                          onBlur={() => salvarCelula(l, a)}
                          onKeyDown={e => { if (e.key === 'Enter') salvarCelula(l, a); if (e.key === 'Escape') setEditando(null) }}
                          className="w-16 bg-primary/10 px-1.5 py-1 text-center text-xs outline-none ring-2 ring-primary/40" />
                      ) : (
                        <button
                          onClick={() => { setEditando(chave); setValor(String(porChave.get(chave) ?? '')) }}
                          className="w-full px-1.5 py-1 text-center hover:bg-primary/10">
                          {(porChave.get(chave) ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SecaoBandos({ salvar, excluir, adicionar }: SecaoProps) {
  const { data, isLoading } = usePrecosBandos()
  const { data: params } = usePrecosBandosParams()
  if (isLoading || !params) return <Carregando />

  const precoDe = (cor: string, largura: number, qtdCd: number) => {
    const p = params.find(x => x.cor === cor)
    if (!p) return 0
    return largura * Number(p.preco_metro) + qtdCd * (Number(p.cd1) + Number(p.cd2)) + Number(p.par)
  }
  const linhas = (data ?? []).map(b => ({ ...b, preco_calc: precoDe(b.cor, Number(b.largura), Number(b.qtd_cd)) }))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        Preço calculado por fórmula (igual à planilha): <b>largura × base + cadarços × (cd1 + cd2) + par</b>.
        Mude a base aqui em cima que a escada inteira se recalcula.
      </div>
      <PrecosGrid
        colunas={[
          { key: 'cor', label: 'Cor', tipo: 'texto', readonly: true },
          { key: 'preco_metro', label: 'Base (R$/m)', tipo: 'numero', formato: fmtBRL },
          { key: 'par', label: 'Par (fixo)', tipo: 'numero', formato: fmtBRL },
          { key: 'cd1', label: 'Cadarço 1', tipo: 'numero', formato: fmtBRL },
          { key: 'cd2', label: 'Cadarço 2', tipo: 'numero', formato: fmtBRL },
        ]}
        linhas={params} chave={r => ({ cor: r.cor })} onSalvar={salvar('precos_bandos_params')} />
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Escada por largura — edite a quantidade de cadarços; o preço sai da fórmula:
        </p>
        <PrecosGrid
          colunas={[
            { key: 'cor', label: 'Cor', tipo: 'select', options: [
              { value: 'BRANCO', label: 'Branco' }, { value: 'PRETO', label: 'Preto' }] },
            { key: 'largura', label: 'Largura (m)', tipo: 'numero', formato: fmtNum },
            { key: 'qtd_cd', label: 'Cadarços', tipo: 'numero', formato: fmtNum },
            { key: 'qtd_par', label: 'Pares', tipo: 'numero', formato: fmtNum },
            { key: 'preco_calc', label: 'Preço (calculado)', tipo: 'numero', readonly: true, formato: fmtBRL },
          ]}
          linhas={linhas} chave={r => ({ id: r.id })}
          onSalvar={salvar('precos_bandos')} onExcluir={excluir!('precos_bandos')}
          onAdicionar={adicionar!('precos_bandos')} />
      </div>
    </div>
  )
}

function SecaoBarra({ salvar }: SecaoProps) {
  const { data: params, isLoading } = usePrecosParametros()
  const { data: faixas } = usePrecosBarraFaixas()
  if (isLoading) return <Carregando />
  const barra = (params ?? []).filter(p => p.chave.startsWith('barra_'))
  const metro = Number(barra.find(p => p.chave === 'barra_preco_metro')?.valor ?? 0)
  const presilha = Number(barra.find(p => p.chave === 'barra_preco_presilha')?.valor ?? 0)
  const fxs = [...(faixas ?? [])].sort((a, b) => a.largura_min - b.largura_min)
  const escada: { largura: number; valor: number; extras: (string | number)[] }[] = []
  for (let L = 1.0; L <= 6.0 + 1e-9; L += 0.1) {
    const Lr = Math.round(L * 100) / 100
    let qtd = fxs[0]?.qtd_presilhas ?? 2
    for (const f of fxs) if (Lr >= Number(f.largura_min)) qtd = f.qtd_presilhas
    escada.push({
      largura: Lr, valor: metro * Lr + presilha * qtd,
      extras: [qtd, fmtBRL(presilha * qtd), fmtBRL(metro * Lr)],
    })
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <PrecosGrid
          colunas={[
            { key: 'descricao', label: 'Parâmetro', tipo: 'texto', readonly: true },
            { key: 'valor', label: 'Valor', tipo: 'numero', formato: fmtBRL },
          ]}
          linhas={barra} chave={r => ({ chave: r.chave })} onSalvar={salvar('precos_parametros')} />
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Quantidade de presilhas por faixa de largura (a partir de):</p>
          <PrecosGrid
            colunas={[
              { key: 'largura_min', label: 'A partir de (m)', tipo: 'numero', readonly: true, formato: fmtNum },
              { key: 'qtd_presilhas', label: 'Presilhas', tipo: 'numero', formato: fmtNum },
            ]}
            linhas={faixas ?? []} chave={r => ({ largura_min: r.largura_min })} onSalvar={salvar('precos_barra_faixas')} />
        </div>
      </div>
      <EscadaCalculada titulo="Tabela gerada (igual à planilha)"
        colunasExtras={['Presilhas', 'Valor presilhas', 'Valor barra']} linhas={escada} />
    </div>
  )
}

function SecaoColocacao({ salvar, excluir, adicionar }: SecaoProps) {
  const { data, isLoading } = usePrecosColocacao()
  const colunas: ColunaDef[] = [
    { key: 'ml_min', label: 'De (ml)', tipo: 'numero', formato: fmtNum },
    { key: 'ml_max', label: 'Até (ml)', tipo: 'numero', formato: fmtNum },
    { key: 'preco', label: 'Preço', tipo: 'numero', formato: fmtBRL },
  ]
  if (isLoading) return <Carregando />
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Acima da última faixa, a instalação fica “sob consulta”.</p>
      <PrecosGrid colunas={colunas} linhas={data ?? []} chave={r => ({ id: r.id })}
        onSalvar={salvar('precos_colocacao')} onExcluir={excluir!('precos_colocacao')} onAdicionar={adicionar!('precos_colocacao')} />
    </div>
  )
}

function SecaoMotor({ salvar }: SecaoProps) {
  const { data: estrutura, isLoading: l1 } = usePrecosMotorEstrutura()
  const { data: comps, isLoading: l2 } = usePrecosMotorComponentes()
  if (l1 || l2) return <Carregando />
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Estrutura motorizada (largura × altura)</p>
        <PrecosGrid
          colunas={[
            { key: 'largura', label: 'Largura (m)', tipo: 'numero', readonly: true, formato: fmtNum },
            { key: 'alt_faixa', label: 'Altura', tipo: 'texto', readonly: true },
            { key: 'valor', label: 'Valor', tipo: 'numero', formato: fmtBRL },
            { key: 'obs', label: 'Obs', tipo: 'texto', readonly: true },
          ]}
          linhas={estrutura ?? []} chave={r => ({ id: r.id })} onSalvar={salvar('precos_motor_estrutura')} />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Motores e componentes</p>
        <PrecosGrid
          colunas={[
            { key: 'item', label: 'Item', tipo: 'texto', readonly: true },
            { key: 'custo', label: 'Custo', tipo: 'numero', formato: fmtBRL },
            { key: 'quantidade', label: 'Qtd', tipo: 'numero', formato: v => v == null ? '—' : fmtNum(v) },
          ]}
          linhas={comps ?? []} chave={r => ({ id: r.id })} onSalvar={salvar('precos_motor_componentes')} />
      </div>
    </div>
  )
}

const GRUPOS_PARAMETROS: {
  titulo: string; hint: string; chaves: string[]; formato: (v: unknown) => string
}[] = [
  {
    titulo: 'Markups de venda', hint: 'Quanto o custo é multiplicado para virar preço de venda.',
    chaves: ['markup_venda', 'markup_acabamento', 'markup_venda_pv_ph', 'markup_venda_ph50', 'markup_bando_ph50', 'markup_motorizacao'],
    formato: v => `× ${fmtNum(v)}`,
  },
  {
    titulo: 'Taxas e descontos', hint: 'Parcelamento, taxa da PH 50 e desconto à vista.',
    chaves: ['taxa_parcelamento', 'taxa_ph50', 'desconto_avista_pct', 'bando_ph50_venda_fixo'],
    formato: v => fmtNum(v),
  },
  {
    titulo: 'Kit Box', hint: 'Fatores da fórmula do Kit Box (exclusivo da Rolô).',
    chaves: ['kitbox_ml_largura', 'kitbox_fixo1', 'kitbox_ml_perimetro', 'kitbox_fixo2', 'kitbox_ml_altura'],
    formato: v => fmtBRL(v),
  },
]

function SecaoParametros({ salvar }: SecaoProps) {
  const { data, isLoading } = usePrecosParametros()
  if (isLoading) return <Carregando />
  const porChave = new Map((data ?? []).map(p => [p.chave, p]))
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-foreground">
        <CircleDollarSign className="mr-1.5 inline h-4 w-4 text-amber-500" />
        Cuidado: estes números afetam TODOS os orçamentos. Mexa com certeza — dá pra desfazer no histórico do Assistente.
      </div>
      {GRUPOS_PARAMETROS.map(g => {
        const linhas = g.chaves.map(c => porChave.get(c)).filter(Boolean) as NonNullable<ReturnType<typeof porChave.get>>[]
        if (linhas.length === 0) return null
        return (
          <div key={g.titulo}>
            <p className="mb-0.5 font-display text-sm font-semibold tracking-wide">{g.titulo}</p>
            <p className="mb-2 text-xs text-muted-foreground">{g.hint}</p>
            <PrecosGrid
              colunas={[
                { key: 'descricao', label: 'O que é', tipo: 'texto', readonly: true },
                { key: 'valor', label: 'Valor', tipo: 'numero', formato: g.formato },
              ]}
              linhas={linhas} chave={r => ({ chave: r.chave })} onSalvar={salvar('precos_parametros')} />
          </div>
        )
      })}
    </div>
  )
}


function BotaoSincronizar({ toast }: { toast: Props['toast'] }) {
  const [sincronizando, setSincronizando] = useState(false)
  async function sincronizar() {
    setSincronizando(true)
    try {
      const r = await fetch('https://n8n-n8n.yjlhot.easypanel.host/webhook/sincronizar-precos', { method: 'POST' })
      const j = await r.json()
      if (j?.ok) toast('success', `Planilha sincronizada (${j.abas_sincronizadas} abas)`)
      else toast('error', 'A sincronização retornou erro — tente de novo em 1 min')
    } catch {
      toast('error', 'Não consegui falar com o sincronizador')
    } finally {
      setSincronizando(false)
    }
  }
  return (
    <button onClick={sincronizar} disabled={sincronizando}
      className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-50">
      {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {sincronizando ? 'Sincronizando…' : 'Sincronizar planilha'}
    </button>
  )
}
