export const ADMIN_EMAIL = 'luccapavanallo@gmail.com';
export const ESTOQUE_EMAIL = 'luccapavanallo@gmail.com';

export const RESPONSAVEIS = ['Sombrear', 'Stella', 'Rogério', 'Thais', 'Gregório', 'Sueli', 'Teste'];

export const META_KEY = 'sombrear-meta-mensal';

export const MODELOS = ['Rolo', 'Romeu e Julieta', 'Vertical', 'Horizontal', 'Painel', 'Cortina'];

export const SUGESTOES_AMBIENTE = ['Sala', 'Quarto', 'Quarto 1', 'Quarto 2', 'Escritório', 'Cozinha', 'Varanda', 'Banheiro', 'Hall', 'Suíte'];

export type ModeloFieldRule = {
  obrigatorio: string[]
  opcional: string[]
  naplicavel: string[]
  avisos?: string[]
}

export const MODELO_RULES: Record<string, ModeloFieldRule> = {
  'Rolo': {
    obrigatorio: ['Tecido', 'Medidas (L × A)', 'Quantidade'],
    opcional:    ['Acabamento', 'Cor Ferragem'],
    naplicavel:  [],
  },
  'Rolo Motorizado': {
    obrigatorio: ['Tecido', 'Medidas (L × A)', 'Quantidade', 'Cor/Motor'],
    opcional:    ['Acabamento'],
    naplicavel:  [],
    avisos:      ['Motor obrigatório — informe o modelo no campo Cor/Motor'],
  },
  'Romeu e Julieta': {
    obrigatorio: ['Tecido', 'Medidas (L × A)', 'Quantidade'],
    opcional:    ['Acabamento', 'Cor/Motor'],
    naplicavel:  [],
  },
  'Romana': {
    obrigatorio: ['Tecido', 'Medidas (L × A)', 'Quantidade'],
    opcional:    ['Acabamento'],
    naplicavel:  ['Cor Ferragem'],
  },
  'Vertical': {
    obrigatorio: ['Artigo/Tecido', 'Medidas (L × A)', 'Quantidade'],
    opcional:    [],
    naplicavel:  ['Acabamento', 'Cor Ferragem'],
    avisos:      ['Altura mínima técnica: 1,50m', 'Área cobrada mínima: 1,50m²'],
  },
  'Horizontal': {
    obrigatorio: ['Artigo/Tecido', 'Medidas (L × A)', 'Quantidade'],
    opcional:    ['Acabamento (bandô)'],
    naplicavel:  ['Cor Ferragem'],
    avisos:      ['Área cobrada mínima: 1,50m²'],
  },
  'Painel': {
    obrigatorio: ['Tecido', 'Medidas (L × A)', 'Quantidade'],
    opcional:    ['Acabamento'],
    naplicavel:  ['Cor Ferragem'],
  },
  'Cortina': {
    obrigatorio: ['Tecido', 'Medidas (L × A)', 'Quantidade'],
    opcional:    ['Acabamento', 'Cor Ferragem'],
    naplicavel:  [],
  },
}

export const DEFAULT_RESPONSAVEL = 'Sombrear';

// Paginação
export const PAGE_SIZE = 50;
export const LEADS_PAGE_SIZE = 20;
export const ORCS_PAGE_SIZE = 20;

// Agente IA — horário comercial e alertas
export const HORA_INICIO = 8;
export const HORA_FIM = 18;
export const ESPERA_HORAS = 2;

// Estoque — labels em português dos ENUMs
export const TIPOS_PRODUTO: Record<string, string> = {
  tecido:    'Tecido',
  ferragem:  'Ferragem',
  acessorio: 'Acessório',
}

export const UNIDADES: Record<string, string> = {
  metro:         'Metro',
  metro_quadrado: 'Metro quadrado',
  peca:          'Peça',
  kit:           'Kit',
  par:           'Par',
}

export const CLASSES_ABC: Record<string, string> = {
  A:         'A',
  B:         'B',
  C:         'C',
  sem_dados: 'Sem dados',
}
