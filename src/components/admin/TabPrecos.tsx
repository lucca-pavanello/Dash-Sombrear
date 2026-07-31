import { useMemo, useState } from 'react'
import {
  Blinds, CircleDollarSign, Cog, Layers, Loader2, Percent, RefreshCw, Ruler, Settings2, Sparkles, Tag, Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import PrecosGrid, { ColunaDef } from './PrecosGrid'
import PrecosIA from './PrecosIA'
import {
  statusPromocao, usePrecosArtigos, usePrecosBandos, usePrecosBandosParams, usePrecosBarraFaixas, usePrecosColocacao,
  usePrecosFerragemComponentes, usePrecosFerragemEscada, usePrecosFerragemFamilias,
  usePrecosMotorComponentes, usePrecosMotorEstrutura, usePrecosMutations, usePrecosParametros,
  usePrecosPh50, usePrecosPromocoes, usePrecosTecidoModelos, usePrecosTecidos,
  MODELOS_PERSIANA,
} from '@/hooks/usePrecos'

interface Props { toast: (type: 'success' | 'error', message: string) => void }

const fmtBRL = (v: unknown) => `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
const fmtNum = (v: unknown) => Number(v ?? 0).toLocaleString('pt-BR')

const SECOES = [
  { id: 'ia',         label: 'Assistente',     icon: Sparkles },
  { id: 'tecidos',    label: 'Tecidos',        icon: Layers },
  { id: 'promocoes',  label: 'Promoções',      icon: Percent },
  { id: 'artigos',    label: 'PV / PH Alumínio', icon: Blinds },
  { id: 'ph50',       label: 'PH 50mm',        icon: Blinds },
  { id: 'ferragens',  label: 'Ferragens',      icon: Wrench },
  { id: 'bandos',     label: 'Bandôs',         icon: Tag },
  { id: 'barra',      label: 'Barra Niv.',     icon: Ruler },
  { id: 'colocacao',  label: 'Instalação',     icon: Cog },
  { id: 'motor',      label: 'Motor',          icon: Cog },
  { id: 'parametros', label: 'Parâmetros',     icon: Settings2 },
] as const

type SecaoId = typeof SECOES[number]['id']

export default function TabPrecos({ toast }: Props) {
  const [secao, setSecao] = useState<SecaoId>('ia')
  const { updateRow, insertRow, deleteRow } = usePrecosMutations()

  const salvar = (table: string) => async (match: Record<string, unknown>, patch: Record<string, unknown>) => {
    try { await updateRow(table, match, patch); toast('success', 'Salvo!') }
    catch { toast('error', 'Erro ao salvar — confira os dados') }
  }
  const excluir = (table: string) => async (match: Record<string, unknown>) => {
    try { await deleteRow(table, match); toast('success', 'Excluído') }
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

      <div className="flex flex-wrap gap-1 rounded-xl bg-muted/50 p-1">
        {SECOES.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSecao(id)} title={label}
            className={cn(
              'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              secao === id ? 'bg-card text-primary shadow-elevated' : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
            )}>
            <Icon className="h-4 w-4 shrink-0" />{label}
          </button>
        ))}
      </div>

      {secao === 'ia' && <PrecosIA toast={toast} />}
      {secao === 'tecidos' && <SecaoTecidos salvar={salvar} excluir={excluir} adicionar={adicionar} />}
      {secao === 'promocoes' && <SecaoPromocoes toast={toast} />}
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
type SalvarFn = (table: string) => (match: Record<string, unknown>, patch: Record<string, unknown>) => Promise<void>
type ExcluirFn = (table: string) => (match: Record<string, unknown>) => Promise<void>
type AdicionarFn = (table: string) => (row: Record<string, unknown>) => Promise<void>
interface SecaoProps { salvar: SalvarFn; excluir?: ExcluirFn; adicionar?: AdicionarFn }

function Carregando() {
  return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
}

function SecaoTecidos({ salvar, excluir, adicionar }: SecaoProps) {
  const { data, isLoading } = usePrecosTecidos()
  const colunas: ColunaDef[] = [
    { key: 'nome', label: 'Tecido', tipo: 'texto' },
    { key: 'tipo', label: 'Categoria', tipo: 'select', options: [
      { value: 'blackout', label: 'Blackout' }, { value: 'tela_solar', label: 'Tela Solar' },
      { value: 'decorativo', label: 'Decorativo' }, { value: 'outro', label: 'Outro' }] },
    { key: 'largura', label: 'Largura (m)', tipo: 'numero', formato: fmtNum },
    { key: 'preco', label: 'Preço/m²', tipo: 'numero', formato: fmtBRL },
  ]
  if (isLoading) return <Carregando />
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        A categoria alimenta buscas como “blackout mais barato”. Cada largura de rolo é uma linha.
      </p>
      <PrecosGrid colunas={colunas} linhas={data ?? []} chave={r => ({ id: r.id })}
        onSalvar={salvar('precos_tecidos')} onExcluir={excluir!('precos_tecidos')}
        onAdicionar={adicionar!('precos_tecidos')} />
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
        <select value={tecido} onChange={e => setTecido(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:w-64">
          <option value="">Escolha o tecido…</option>
          {nomes.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
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

function SecaoPromocoes({ toast }: { toast: Props['toast'] }) {
  const { data: promocoes, isLoading } = usePrecosPromocoes()
  const { data: tecidos } = usePrecosTecidos()
  const { insertRow, deleteRow } = usePrecosMutations()
  const [form, setForm] = useState({ alvo_nome: '', desconto_pct: '', inicio: '', fim: '' })
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
          <select className={cn(inputCls, 'sm:col-span-2')} value={form.alvo_nome}
            onChange={e => setForm(f => ({ ...f, alvo_nome: e.target.value }))}>
            <option value="">Escolha o tecido…</option>
            {nomes.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
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
          <thead><tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Tecido</th>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Desconto</th>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Período</th>
            <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Status</th>
            <th className="w-16 px-4 py-2.5" />
          </tr></thead>
          <tbody>
            {(promocoes ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma promoção cadastrada.</td></tr>
            )}
            {(promocoes ?? []).map(p => {
              const st = statusPromocao(p)
              return (
                <tr key={p.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{p.alvo_nome}</td>
                  <td className="px-4 py-2.5 tabular-nums">−{fmtNum(p.desconto_pct)}%</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {new Date(p.inicio + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(p.fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', badge[st])}>{st}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
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
    onSalvar={salvar('precos_artigos')} onExcluir={excluir!('precos_artigos')} onAdicionar={adicionar!('precos_artigos')} />
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
        {chaves.map(c => {
          const [f, cor, esp] = c.split('|')
          const label = `${f} ${cor}${esp !== '0' ? ` ${esp}mm` : ''}`
          return (
            <button key={c} onClick={() => setFam(c)}
              className={cn('rounded-full px-3 py-1 text-xs font-semibold',
                atual === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          )
        })}
      </div>
      {escadaFam.length > 0 ? (
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
          <PrecosGrid colunas={colunas} linhas={comps} chave={r => ({ id: r.id })}
            onSalvar={salvar('precos_ferragem_componentes')} />
        </div>
      )}
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
  return (
    <div className="space-y-4">
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
          ]}
          linhas={comps ?? []} chave={r => ({ id: r.id })} onSalvar={salvar('precos_motor_componentes')} />
      </div>
    </div>
  )
}

function SecaoParametros({ salvar }: SecaoProps) {
  const { data, isLoading } = usePrecosParametros()
  if (isLoading) return <Carregando />
  const gerais = (data ?? []).filter(p => !p.chave.startsWith('barra_'))
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-foreground">
        <CircleDollarSign className="mr-1.5 inline h-4 w-4 text-amber-500" />
        Cuidado: estes números afetam TODOS os orçamentos (markup, taxas, Kit Box). Mexa com certeza.
      </div>
      <PrecosGrid
        colunas={[
          { key: 'chave', label: 'Chave', tipo: 'texto', readonly: true },
          { key: 'descricao', label: 'O que é', tipo: 'texto', readonly: true },
          { key: 'valor', label: 'Valor', tipo: 'numero', formato: fmtNum },
        ]}
        linhas={gerais} chave={r => ({ chave: r.chave })} onSalvar={salvar('precos_parametros')} />
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
