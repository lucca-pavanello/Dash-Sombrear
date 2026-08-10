/**
 * Exportação da Tabela de Preços — Excel (.xlsx) e PDF.
 *
 * Excel sai com uma aba por tabela e os preços como NÚMERO formatado em real,
 * não texto: dá pra somar, filtrar e fazer conta em cima. O PDF é o mesmo
 * conteúdo em formato de leitura/impressão.
 */
import { supabase } from '@/lib/supabase'

/** Colunas de controle do banco não interessam a quem abre a planilha */
const OCULTAS = new Set(['id', 'created_at', 'updated_at', 'criado_em', 'atualizado_em'])

/** Em precos_parametros, "valor" é markup/fator (1,4 · 1,8) — não é dinheiro */
const NAO_E_DINHEIRO = new Set(['precos_parametros.valor'])

/** Colunas que são dinheiro — viram número com formato de real */
const ehDinheiro = (campo: string, tabela: string): boolean =>
  ehCalculada(campo) ||
  !NAO_E_DINHEIRO.has(`${tabela}.${campo}`)
  && (/^(preco|valor|custo)/.test(campo) || /_(preco|valor|rs)$/.test(campo)
    || ['bando_ml', 'aba_pc', 'preco_fita', 'preco_cadarco'].includes(campo))

const ROTULOS: Record<string, string> = {
  nome: 'Nome', largura: 'Largura (m)', altura: 'Altura (m)', preco: 'Preço',
  cor: 'Cor', categoria: 'Categoria', modelo: 'Modelo', familia: 'Família',
  espessura: 'Espessura (mm)', item: 'Item', tipo_custo: 'Tipo de custo',
  ml_min: 'De (ml)', ml_max: 'Até (ml)', largura_min: 'Largura mín. (m)',
  largura_max: 'Largura máx. (m)', chave: 'Parâmetro', valor: 'Valor',
  descricao: 'Descrição', tecido_nome: 'Tecido', desconto_pct: 'Desconto (%)',
  inicio: 'Início', fim: 'Fim', ativa: 'Ativa', preco_fita: 'Preço com fita',
  preco_cadarco: 'Preço com cadarço', bando_ml: 'Bandô (por metro)', aba_pc: 'Aba (peça)',
  fator: 'Fator', quantidade: 'Quantidade', unidade: 'Unidade', observacao: 'Observação',
}
const rotular = (campo: string) =>
  ROTULOS[campo] ?? campo.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

/** coluna calculada por nós (preço final) — sempre dinheiro */
const ehCalculada = (campo: string) => campo.startsWith('__venda_')

/**
 * Como o custo daquela tabela vira preço de cliente. É a MESMA conta da
 * calculadora: custo × markup × taxa de parcelamento. Onde a regra não é
 * única (bandô comum, barra) a tabela fica sem a coluna em vez de chutar.
 */
interface RegraVenda {
  campos: string[]          // colunas de custo que ganham par de venda
  markup: string; mkPadrao: number
  taxa: string; taxaPadrao: number; expo: number
  nota: string              // explica a conta no cabeçalho do PDF
}
const VENDA_PERSIANA: RegraVenda = {
  campos: [], markup: 'markup_venda', mkPadrao: 2.8,
  taxa: 'taxa_parcelamento', taxaPadrao: 1.06, expo: 2,
  nota: 'Preço final = custo × markup de venda × taxa de parcelamento²  (Rolô, Double e Romana)',
}
const comCampos = (r: RegraVenda, campos: string[], nota?: string): RegraVenda =>
  ({ ...r, campos, nota: nota ?? r.nota })

/** As tabelas na mesma ordem em que aparecem na tela */
export const TABELAS: {
  tabela: string; titulo: string; aba: string; ordem: string[]
  venda?: RegraVenda; avisoVenda?: string
}[] = [
  { tabela: 'precos_promocoes', titulo: 'Promoções', aba: 'Promoções', ordem: ['inicio'] },
  { tabela: 'precos_tecidos', titulo: 'Tecidos', aba: 'Tecidos', ordem: ['nome', 'largura'],
    venda: comCampos(VENDA_PERSIANA, ['preco']) },
  { tabela: 'precos_tecido_modelos', titulo: 'Tecidos por modelo', aba: 'Tecidos x Modelo', ordem: ['tecido_nome', 'modelo'] },
  { tabela: 'precos_artigos', titulo: 'PV / PH Alumínio', aba: 'PV e PH Aluminio', ordem: ['categoria', 'nome'],
    venda: { campos: ['preco'], markup: 'markup_venda_pv_ph', mkPadrao: 1.8,
      taxa: 'taxa_parcelamento', taxaPadrao: 1.06, expo: 2,
      nota: 'Preço final = custo × markup de PV/PH × taxa de parcelamento²' } },
  { tabela: 'precos_ph50', titulo: 'PH 50mm', aba: 'PH 50mm', ordem: ['modelo', 'cor'],
    venda: { campos: ['preco_cadarco', 'preco_fita'], markup: 'markup_venda_ph50', mkPadrao: 1.95,
      taxa: 'taxa_ph50', taxaPadrao: 1.07, expo: 1,
      nota: 'Preço final = custo × markup do PH 50 × taxa do PH 50' },
    avisoVenda: 'O bandô do PH 50 tem markup próprio e ainda soma um valor fixo por peça — por isso não ganha coluna de venda aqui.' },
  { tabela: 'precos_ferragem_familias', titulo: 'Ferragens — famílias', aba: 'Ferragem familias', ordem: ['familia', 'cor', 'espessura'] },
  { tabela: 'precos_ferragem_componentes', titulo: 'Ferragens — componentes', aba: 'Ferragem componentes', ordem: ['familia', 'cor', 'espessura', 'item'],
    venda: comCampos(VENDA_PERSIANA, ['valor']) },
  { tabela: 'precos_ferragem_escada', titulo: 'Ferragens — escada por largura', aba: 'Ferragem escada', ordem: ['familia', 'cor', 'espessura', 'largura'],
    venda: comCampos(VENDA_PERSIANA, ['preco', 'valor', 'custo']) },
  { tabela: 'precos_romana_matriz', titulo: 'Romana — matriz', aba: 'Romana', ordem: ['altura', 'largura'],
    venda: comCampos(VENDA_PERSIANA, ['custo']) },
  { tabela: 'precos_bandos', titulo: 'Bandôs', aba: 'Bandos', ordem: ['cor', 'largura'] },
  { tabela: 'precos_bandos_params', titulo: 'Bandôs — parâmetros', aba: 'Bandos params', ordem: ['cor'],
    venda: { campos: ['preco_metro'], markup: 'markup_acabamento', mkPadrao: 2.2,
      taxa: 'taxa_parcelamento', taxaPadrao: 1.06, expo: 2,
      nota: 'Preço final = custo × markup de acabamento × taxa de parcelamento²' } },
  { tabela: 'precos_barra_faixas', titulo: 'Barra niveladora', aba: 'Barra niveladora', ordem: ['largura_min'] },
  { tabela: 'precos_colocacao', titulo: 'Instalação', aba: 'Instalacao', ordem: ['ml_min'],
    avisoVenda: 'A instalação já é cobrada por este valor — não leva markup.' },
  { tabela: 'precos_motor_estrutura', titulo: 'Motor — estrutura', aba: 'Motor estrutura', ordem: ['largura'],
    venda: comCampos(VENDA_PERSIANA, ['valor', 'valor_extra'],
      'Preço final = custo × markup de venda × taxa de parcelamento² (mesma regra da persiana)') },
  { tabela: 'precos_motor_componentes', titulo: 'Motor — componentes', aba: 'Motor componentes', ordem: ['item'],
    venda: comCampos(VENDA_PERSIANA, ['custo'],
      'Preço final = custo × markup de venda × taxa de parcelamento² (mesma regra da persiana)') },
  { tabela: 'precos_parametros', titulo: 'Parâmetros e markups', aba: 'Parametros', ordem: ['chave'] },
]

type Linhas = Record<string, unknown>[]

/** Multiplicador de venda de cada tabela, lido dos parâmetros do banco */
async function multiplicadores() {
  const { data } = await supabase.from('precos_parametros').select('chave, valor')
  const param = (chave: string, padrao: number) => {
    const p = (data ?? []).find(x => x.chave === chave)
    const n = Number(p?.valor)
    return Number.isFinite(n) && n > 0 ? n : padrao
  }
  return (r: RegraVenda) => param(r.markup, r.mkPadrao) * param(r.taxa, r.taxaPadrao) ** r.expo
}

const rotuloVenda = (campo: string) =>
  campo === 'preco' || campo === 'valor' || campo === 'custo'
    ? 'Preço final ao cliente'
    : `${rotular(campo)} — preço final`

interface Bloco {
  tabela: string; titulo: string; aba: string
  campos: string[]; linhas: Linhas
  /** colunas de venda calculadas: nome sintético → rótulo */
  vendaCols: { campo: string; rotulo: string }[]
  nota?: string
}

/** `apenas` limita a uma tabela; sem ele, vem o pacote inteiro. */
async function buscarTudo(apenas?: string): Promise<Bloco[]> {
  const mult = await multiplicadores()
  const resultado: Bloco[] = []
  for (const t of TABELAS.filter(x => !apenas || x.tabela === apenas)) {
    let q = supabase.from(t.tabela).select('*')
    for (const c of t.ordem) q = q.order(c, { ascending: true })
    const { data, error } = await q
    if (error || !data?.length) continue          // tabela vazia não vira aba em branco
    const campos = Object.keys(data[0]).filter(c => !OCULTAS.has(c))
    const linhas = data as Linhas

    // preço final ao lado de cada custo, pela regra daquela tabela
    const vendaCols: { campo: string; rotulo: string }[] = []
    if (t.venda) {
      const k = mult(t.venda)
      for (const c of t.venda.campos.filter(c => campos.includes(c))) {
        const sintetico = `__venda_${c}`
        vendaCols.push({ campo: sintetico, rotulo: rotuloVenda(c) })
        for (const l of linhas) {
          const v = Number(l[c])
          l[sintetico] = Number.isFinite(v) && l[c] != null && l[c] !== ''
            ? Math.round(v * k * 100) / 100
            : null
        }
      }
    }
    resultado.push({
      tabela: t.tabela, titulo: t.titulo, aba: t.aba,
      campos: [...campos, ...vendaCols.map(v => v.campo)], linhas, vendaCols,
      nota: vendaCols.length ? t.venda?.nota : t.avisoVenda,
    })
  }
  return resultado
}

const carimbo = () => new Date().toLocaleString('pt-BR')
/** Vira nome de arquivo: "PV / PH Alumínio" → "PV-PH-Aluminio" */
const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
const nomeArquivo = (ext: string, titulo?: string) => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const meio = titulo ? semAcento(titulo) : 'Tabela-de-Precos'
  return `${meio}-Sombrear-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.${ext}`
}
/** Mensagem clara quando a tabela existe mas não tem linha nenhuma */
const vazia = (apenas?: string) => {
  const t = TABELAS.find(x => x.tabela === apenas)
  return new Error(t ? `A tabela "${t.titulo}" está vazia — não há o que baixar.`
                     : 'Não veio nenhuma tabela do banco')
}

/** Uma aba por tabela; preço vai como número com formato de real. */
export async function baixarPrecosExcel(apenas?: string) {
  const [XLSX, blocos] = await Promise.all([import('xlsx'), buscarTudo(apenas)])
  if (!blocos.length) throw vazia(apenas)

  const wb = XLSX.utils.book_new()
  for (const b of blocos) {
    const cabecalho = (c: string) => b.vendaCols.find(v => v.campo === c)?.rotulo ?? rotular(c)
    const ws = XLSX.utils.aoa_to_sheet([b.campos.map(cabecalho)])
    XLSX.utils.sheet_add_json(ws, b.linhas.map(l => {
      const o: Record<string, unknown> = {}
      for (const c of b.campos) {
        const v = l[c]
        o[c] = ehDinheiro(c, b.tabela) && v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : v
      }
      return o
    }), { header: b.campos, skipHeader: true, origin: 'A2' })

    // formato de moeda nas colunas de preço + largura das colunas
    b.campos.forEach((campo, i) => {
      if (!ehDinheiro(campo, b.tabela)) return
      for (let linha = 2; linha <= b.linhas.length + 1; linha++) {
        const cel = ws[XLSX.utils.encode_cell({ c: i, r: linha - 1 })]
        if (cel && cel.t === 'n') cel.z = 'R$ #,##0.00'
      }
    })
    ws['!cols'] = b.campos.map(c => ({
      wch: Math.max(cabecalho(c).length + 2,
        ...b.linhas.slice(0, 200).map(l => String(l[c] ?? '').length + 2)),
    }))
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, ws, b.aba.slice(0, 31))
  }
  XLSX.writeFile(wb, nomeArquivo('xlsx', apenas ? blocos[0].titulo : undefined))
  return blocos.length
}

/** Mesmo conteúdo, formato de leitura — uma tabela por seção, com sumário. */
export async function baixarPrecosPDF(apenas?: string) {
  const [{ default: jsPDF }, { default: autoTable }, blocos] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), buscarTudo(apenas),
  ])
  if (!blocos.length) throw vazia(apenas)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const larguraPg = doc.internal.pageSize.getWidth()

  // capa com sumário só faz sentido no pacote inteiro; tabela única já começa nela
  const umaSo = blocos.length === 1
  if (!umaSo) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18)
    doc.text('Tabela de Preços — Sombrear', larguraPg / 2, 120, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(120)
    doc.text(`Gerada em ${carimbo()}`, larguraPg / 2, 140, { align: 'center' })
    doc.setFontSize(11); doc.setTextColor(40)
    blocos.forEach((b, i) => doc.text(`${i + 1}.  ${b.titulo}`, 150, 180 + i * 18))
  }

  const fmtBRL = (v: unknown) =>
    `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  blocos.forEach((b, i) => {
    if (!(umaSo && i === 0)) doc.addPage()   // sem capa, a primeira tabela usa a página 1
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20)
    doc.text(b.titulo, 40, 48)
    if (b.nota) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120)
      doc.text(b.nota, 40, 60)
    }
    autoTable(doc, {
      startY: b.nota ? 72 : 62,
      head: [b.campos.map(c => b.vendaCols.find(v => v.campo === c)?.rotulo ?? rotular(c))],
      body: b.linhas.map(l => b.campos.map(c => {
        const v = l[c]
        if (v == null || v === '') return '—'
        if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
        return ehDinheiro(c, b.tabela) && Number.isFinite(Number(v)) ? fmtBRL(v) : String(v)
      })),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [232, 112, 26], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 246, 242] },
      margin: { left: 32, right: 32, bottom: 40 },
    })
  })

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(150)
    doc.text(`Sombrear · ${carimbo()} · ${p}/${total}`,
      larguraPg / 2, doc.internal.pageSize.getHeight() - 20, { align: 'center' })
  }
  doc.save(nomeArquivo('pdf', apenas ? blocos[0].titulo : undefined))
  return blocos.length
}
