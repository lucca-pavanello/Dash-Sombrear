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
const ehDinheiro = (campo: string, tabela: string) =>
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

/** As tabelas na mesma ordem em que aparecem na tela */
const TABELAS: { tabela: string; titulo: string; aba: string; ordem: string[] }[] = [
  { tabela: 'precos_promocoes', titulo: 'Promoções', aba: 'Promoções', ordem: ['inicio'] },
  { tabela: 'precos_tecidos', titulo: 'Tecidos', aba: 'Tecidos', ordem: ['nome', 'largura'] },
  { tabela: 'precos_tecido_modelos', titulo: 'Tecidos por modelo', aba: 'Tecidos x Modelo', ordem: ['tecido_nome', 'modelo'] },
  { tabela: 'precos_artigos', titulo: 'PV / PH Alumínio', aba: 'PV e PH Aluminio', ordem: ['categoria', 'nome'] },
  { tabela: 'precos_ph50', titulo: 'PH 50mm', aba: 'PH 50mm', ordem: ['modelo', 'cor'] },
  { tabela: 'precos_ferragem_familias', titulo: 'Ferragens — famílias', aba: 'Ferragem familias', ordem: ['familia', 'cor', 'espessura'] },
  { tabela: 'precos_ferragem_componentes', titulo: 'Ferragens — componentes', aba: 'Ferragem componentes', ordem: ['familia', 'cor', 'espessura', 'item'] },
  { tabela: 'precos_ferragem_escada', titulo: 'Ferragens — escada por largura', aba: 'Ferragem escada', ordem: ['familia', 'cor', 'espessura', 'largura'] },
  { tabela: 'precos_romana_matriz', titulo: 'Romana — matriz', aba: 'Romana', ordem: ['altura', 'largura'] },
  { tabela: 'precos_bandos', titulo: 'Bandôs', aba: 'Bandos', ordem: ['cor', 'largura'] },
  { tabela: 'precos_bandos_params', titulo: 'Bandôs — parâmetros', aba: 'Bandos params', ordem: ['cor'] },
  { tabela: 'precos_barra_faixas', titulo: 'Barra niveladora', aba: 'Barra niveladora', ordem: ['largura_min'] },
  { tabela: 'precos_colocacao', titulo: 'Instalação', aba: 'Instalacao', ordem: ['ml_min'] },
  { tabela: 'precos_motor_estrutura', titulo: 'Motor — estrutura', aba: 'Motor estrutura', ordem: ['largura'] },
  { tabela: 'precos_motor_componentes', titulo: 'Motor — componentes', aba: 'Motor componentes', ordem: ['item'] },
  { tabela: 'precos_parametros', titulo: 'Parâmetros e markups', aba: 'Parametros', ordem: ['chave'] },
]

type Linhas = Record<string, unknown>[]

async function buscarTudo() {
  const resultado: { tabela: string; titulo: string; aba: string; campos: string[]; linhas: Linhas }[] = []
  for (const t of TABELAS) {
    let q = supabase.from(t.tabela).select('*')
    for (const c of t.ordem) q = q.order(c, { ascending: true })
    const { data, error } = await q
    if (error || !data?.length) continue          // tabela vazia não vira aba em branco
    const campos = Object.keys(data[0]).filter(c => !OCULTAS.has(c))
    resultado.push({ tabela: t.tabela, titulo: t.titulo, aba: t.aba, campos, linhas: data as Linhas })
  }
  return resultado
}

const carimbo = () => new Date().toLocaleString('pt-BR')
const nomeArquivo = (ext: string) => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `Tabela-de-Precos-Sombrear-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.${ext}`
}

/** Uma aba por tabela; preço vai como número com formato de real. */
export async function baixarPrecosExcel() {
  const [XLSX, blocos] = await Promise.all([import('xlsx'), buscarTudo()])
  if (!blocos.length) throw new Error('Não veio nenhuma tabela do banco')

  const wb = XLSX.utils.book_new()
  for (const b of blocos) {
    const ws = XLSX.utils.aoa_to_sheet([b.campos.map(rotular)])
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
      wch: Math.max(rotular(c).length + 2,
        ...b.linhas.slice(0, 200).map(l => String(l[c] ?? '').length + 2)),
    }))
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, ws, b.aba.slice(0, 31))
  }
  XLSX.writeFile(wb, nomeArquivo('xlsx'))
  return blocos.length
}

/** Mesmo conteúdo, formato de leitura — uma tabela por seção, com sumário. */
export async function baixarPrecosPDF() {
  const [{ default: jsPDF }, { default: autoTable }, blocos] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), buscarTudo(),
  ])
  if (!blocos.length) throw new Error('Não veio nenhuma tabela do banco')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const larguraPg = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18)
  doc.text('Tabela de Preços — Sombrear', larguraPg / 2, 120, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(120)
  doc.text(`Gerada em ${carimbo()}`, larguraPg / 2, 140, { align: 'center' })
  doc.setFontSize(11); doc.setTextColor(40)
  blocos.forEach((b, i) => doc.text(`${i + 1}.  ${b.titulo}`, 150, 180 + i * 18))

  const fmtBRL = (v: unknown) =>
    `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  for (const b of blocos) {
    doc.addPage()
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20)
    doc.text(b.titulo, 40, 48)
    autoTable(doc, {
      startY: 62,
      head: [b.campos.map(rotular)],
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
  }

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(150)
    doc.text(`Sombrear · ${carimbo()} · ${p}/${total}`,
      larguraPg / 2, doc.internal.pageSize.getHeight() - 20, { align: 'center' })
  }
  doc.save(nomeArquivo('pdf'))
  return blocos.length
}
