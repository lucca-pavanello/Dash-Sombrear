/**
 * Simulador de orçamento — replica as regras dos precificadores do n8n
 * (prompts dos Agent1 + Code_Calculadora de cada modelo), lendo os preços do banco.
 * Romana fora do v1: a matriz de ferragem dela mora em outra planilha, ainda não importada.
 */
import type {
  PrecoArtigo, PrecoBando, PrecoBandoParams, PrecoBarraFaixa, PrecoColocacao,
  PrecoFerragemComponente, PrecoParametro, PrecoPh50, PrecoTecidoVigente,
} from '@/hooks/usePrecos'

export type ModeloSim = 'Rolo' | 'Double' | 'PV' | 'PH_Aluminio' | 'PH_50'
export type AcabamentoSim = 'nenhum' | 'bando_branco' | 'bando_preto' | 'barra' | 'kit_box'

export interface EntradaSim {
  modelo: ModeloSim
  tecido?: string
  artigo?: string
  ph50Acabamento?: 'cadarco' | 'fita'
  ph50Bando?: boolean
  corFerragem: 'BRANCA' | 'PRETA'
  largura: number
  altura: number
  quantidade: number
  acabamento: AcabamentoSim
  incluirInstalacao: boolean
}

export interface DadosSim {
  tecidos: PrecoTecidoVigente[]
  componentes: PrecoFerragemComponente[]
  bandos: PrecoBando[]
  bandoParams: PrecoBandoParams[]
  barraFaixas: PrecoBarraFaixa[]
  colocacao: PrecoColocacao[]
  artigos: PrecoArtigo[]
  ph50: PrecoPh50[]
  parametros: PrecoParametro[]
}

export interface ResultadoSim {
  custoProduto: number
  custoAcabamento: number
  vendaProduto: number
  vendaAcabamento: number
  total4x: number
  totalAvista: number
  instalacao: number | 'sob_consulta' | null
  emPromocao: boolean
  descontoPct: number | null
  observacoes: string[]
}

const ceil10c = (v: number) => Math.ceil(v * 10) / 10
const round2 = (v: number) => Math.round((v + 1e-9) * 100) / 100

export function simular(e: EntradaSim, d: DadosSim): ResultadoSim | { erro: string } {
  const { largura: L, altura: A, quantidade: qtd } = e
  if (!(L > 0) || !(A > 0) || !(qtd > 0)) return { erro: 'Preencha largura, altura e quantidade' }

  const param = (chave: string, padrao: number) => {
    const p = d.parametros.find(x => x.chave === chave)
    return p ? Number(p.valor) : padrao
  }
  const obs: string[] = []
  let custoProduto = 0
  let custoAcabamento = 0
  let vendaProduto = 0
  let vendaAcabamento = 0
  let emPromocao = false
  let descontoPct: number | null = null
  const taxa2 = param('taxa_parcelamento', 1.06) ** 2

  /* ── custo do bandô (fórmula: L×base + qtd_cd×(cd1+cd2) + par, degrau ≥ L) ── */
  const custoBando = (cor: 'BRANCO' | 'PRETO'): number | null => {
    const p = d.bandoParams.find(x => x.cor === cor)
    if (!p) return null
    const degraus = d.bandos.filter(b => b.cor === cor).sort((a, b) => a.largura - b.largura)
    const degrau = degraus.find(b => Number(b.largura) >= L - 1e-9) ?? degraus[degraus.length - 1]
    if (!degrau) return null
    if (Number(degrau.largura) < L) obs.push(`Bandô: largura acima da tabela (usei ${degrau.largura}m)`)
    return Number(degrau.largura) * Number(p.preco_metro)
      + Number(degrau.qtd_cd) * (Number(p.cd1) + Number(p.cd2)) + Number(p.par)
  }

  /* ── custo da barra niveladora ── */
  const custoBarra = (): number => {
    const faixas = [...d.barraFaixas].sort((a, b) => a.largura_min - b.largura_min)
    let presilhas = faixas[0]?.qtd_presilhas ?? 2
    for (const f of faixas) if (L >= Number(f.largura_min)) presilhas = f.qtd_presilhas
    return param('barra_preco_metro', 14.4) * L + param('barra_preco_presilha', 0.45) * presilhas
  }

  /* ── modelos com tecido: Rolo e Double ── */
  if (e.modelo === 'Rolo' || e.modelo === 'Double') {
    if (!e.tecido) return { erro: 'Escolha o tecido' }
    const rolos = d.tecidos.filter(t => t.nome === e.tecido).sort((a, b) => a.largura - b.largura)
    if (rolos.length === 0) return { erro: `Tecido ${e.tecido} não encontrado` }
    const rolo = rolos.find(t => Number(t.largura) >= L - 1e-9)
    if (!rolo) return { erro: `${e.tecido}: maior rolo tem ${rolos[rolos.length - 1].largura}m (pedido ${L}m)` }
    emPromocao = rolo.em_promocao
    descontoPct = rolo.desconto_pct

    const alturaUsada = e.modelo === 'Double' ? A * 2 + 0.5 : A + 0.2
    const custoTecido = Number(rolo.largura) * alturaUsada * Number(rolo.preco)

    // ferragem: Rolo escolhe o tubo pela medida; Double é família única
    let familia = 'DOUBLE', espessura = 0
    if (e.modelo === 'Rolo') {
      familia = 'ROLO'
      espessura = (L >= 2.51 || A >= 3.01) ? 50 : (L >= 1.71 || A >= 1.41) ? 38 : 32
    }
    const comps = d.componentes.filter(c =>
      c.familia === familia && c.cor === e.corFerragem && Number(c.espessura) === espessura)
    if (comps.length === 0) return { erro: `Ferragem ${familia} ${e.corFerragem} ${espessura || ''} sem componentes` }
    const ml = comps.filter(c => c.tipo_custo === 'por_metro').reduce((s, c) => s + Number(c.valor), 0)
    const fixo = comps.filter(c => c.tipo_custo === 'fixo').reduce((s, c) => s + Number(c.valor), 0)
    const largFerragem = Math.ceil(L * 10 - 1e-9) / 10
    const custoFerragem = ml * largFerragem + fixo
    if (e.modelo === 'Rolo') obs.push(`Tubo ${espessura}mm · ferragem em ${largFerragem.toFixed(2).replace('.', ',')}m`)

    custoProduto = (custoTecido + custoFerragem) * qtd

    // acabamento
    if (e.acabamento === 'bando_branco' || e.acabamento === 'bando_preto') {
      const cb = custoBando(e.acabamento === 'bando_branco' ? 'BRANCO' : 'PRETO')
      if (cb == null) return { erro: 'Bandô sem parâmetros no banco' }
      custoAcabamento = cb * qtd
    } else if (e.acabamento === 'barra') {
      custoAcabamento = custoBarra() * qtd
    } else if (e.acabamento === 'kit_box') {
      if (e.modelo !== 'Rolo') return { erro: 'Kit Box é exclusivo da Rolô' }
      custoAcabamento = (L * param('kitbox_ml_largura', 88.7) + param('kitbox_fixo1', 20.3)
        + (L + 2 * A) * param('kitbox_ml_perimetro', 30) + param('kitbox_fixo2', 12.28)
        + 4 * A * param('kitbox_ml_altura', 0.82)) * qtd
    }

    const mkVenda = param('markup_venda', 2.8)
    const mkAcab = param('markup_acabamento', 2.2)
    if (e.acabamento === 'kit_box') {
      // Kit Box entra no valor da persiana, com o markup cheio
      vendaProduto = ceil10c((custoProduto + custoAcabamento) * mkVenda * taxa2)
      vendaAcabamento = 0
    } else {
      vendaProduto = ceil10c(custoProduto * mkVenda * taxa2)
      vendaAcabamento = custoAcabamento > 0 ? ceil10c(custoAcabamento * mkAcab * taxa2) : 0
    }
  }

  /* ── PV e PH Alumínio: artigo por m² com trava de área mínima ── */
  if (e.modelo === 'PV' || e.modelo === 'PH_Aluminio') {
    if (!e.artigo) return { erro: 'Escolha o artigo' }
    const cat = e.modelo === 'PV' ? 'PV' : 'PH_ALUMINIO'
    const art = d.artigos.find(a => a.categoria === cat && a.nome === e.artigo)
    if (!art) return { erro: `Artigo ${e.artigo} não encontrado` }

    let areaCobrada: number
    if (e.modelo === 'PV') {
      const alturaTec = Math.max(A, 1.5)
      areaCobrada = Math.max(L * alturaTec, 1.5)
      if (areaCobrada > L * A) obs.push('Área mínima de cobrança aplicada (trava 1,50)')
    } else {
      areaCobrada = Math.max(L * A, 1.2)
      if (areaCobrada > L * A) obs.push('Área mínima de 1,20m² aplicada')
    }
    custoProduto = areaCobrada * Number(art.preco) * qtd
    vendaProduto = ceil10c(custoProduto * param('markup_venda_pv_ph', 1.8) * taxa2)
  }

  /* ── PH 50: preço por m² (cadarço/fita) + bandô próprio ── */
  if (e.modelo === 'PH_50') {
    if (!e.artigo) return { erro: 'Escolha o modelo/cor' }
    const [modelo50, cor50] = e.artigo.split('|')
    const item = d.ph50.find(p => p.modelo === modelo50 && p.cor === cor50)
    if (!item) return { erro: 'Item PH 50 não encontrado' }
    const precoM2 = e.ph50Acabamento === 'fita' ? item.preco_fita : item.preco_cadarco
    if (precoM2 == null) return { erro: `${modelo50} ${cor50} não tem preço com fita` }

    custoProduto = L * A * Number(precoM2) * qtd
    const mk50 = param('markup_venda_ph50', 1.95)
    const taxa50 = param('taxa_ph50', 1.07)
    vendaProduto = ceil10c(custoProduto * mk50 * taxa50)

    if (e.ph50Bando) {
      if (!(Number(item.bando_ml) > 0)) return { erro: `${modelo50} ${cor50} não tem bandô na tabela` }
      const custoBandoUnit = L * Number(item.bando_ml)
      custoAcabamento = custoBandoUnit * qtd + Number(item.aba_pc ?? 0)
      vendaAcabamento = ceil10c(custoBandoUnit * qtd * param('markup_bando_ph50', 1.7) * taxa50
        + param('bando_ph50_venda_fixo', 50) * taxa50)
    }
  }

  /* ── instalação (estimada pela tabela de colocação, por metro linear) ── */
  let instalacao: number | 'sob_consulta' | null = null
  if (e.incluirInstalacao) {
    const ml = L * qtd
    const faixa = d.colocacao.find(c => ml >= Number(c.ml_min) - 1e-9 && ml <= Number(c.ml_max) + 1e-9)
    instalacao = faixa ? Number(faixa.preco) : 'sob_consulta'
    if (!faixa) obs.push(`Instalação: ${ml.toFixed(2).replace('.', ',')}ml está fora das faixas — sob consulta`)
  }

  const total4x = round2(vendaProduto + vendaAcabamento)
  const totalAvista = round2(total4x * (1 - param('desconto_avista_pct', 5) / 100))

  return {
    custoProduto: round2(custoProduto), custoAcabamento: round2(custoAcabamento),
    vendaProduto: round2(vendaProduto), vendaAcabamento: round2(vendaAcabamento),
    total4x, totalAvista, instalacao, emPromocao, descontoPct, observacoes: obs,
  }
}
