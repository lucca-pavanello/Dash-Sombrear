import { FunctionDeclarationsTool, SchemaType } from "@google/generative-ai"
import type { NivelConfirmacao } from "./types"

export const NIVEIS_CONFIRMACAO = {
  // Nível 1 — sem confirmação (leitura/idempotente)
  consultar_estoque_resumo: 1,
  listar_produtos_classe_a: 1,
  listar_produtos_parados: 1,
  listar_sugestoes_compra: 1,
  recalcular_curva_abc: 1,
  gerar_pedido_compra_csv: 1,

  // Nível 2 — confirmação simples (cadastros e edições leves)
  cadastrar_produto: 2,
  cadastrar_fornecedor: 2,
  cadastrar_localizacao: 2,
  editar_configuracao: 2,

  // Nível 3 — confirmação com revisão (operações que afetam estoque/dinheiro)
  registrar_entrada: 3,
  registrar_venda: 3,
  mover_item_localizacao: 3,
  inativar_produto: 3,
} as const satisfies Record<string, NivelConfirmacao>

export type NomeTool = keyof typeof NIVEIS_CONFIRMACAO

export const TOOLS_GEMINI: FunctionDeclarationsTool = {
  functionDeclarations: [
    // ━━━ NÍVEL 1 — LEITURA ━━━
    {
      name: "consultar_estoque_resumo",
      description:
        "Retorna resumo geral do estoque: total de produtos, valor em estoque, giro anual, sugestões de compra ativas. Use quando o usuário perguntar 'como está meu estoque?', 'me dá um overview', 'quanto tenho em estoque'.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
      },
    },
    {
      name: "listar_produtos_classe_a",
      description:
        "Lista os produtos classe A (top 80% do faturamento). Use quando perguntarem 'quais são meus produtos mais importantes?', 'top produtos', 'classe A'.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limite: {
            type: SchemaType.NUMBER,
            description: "Número máximo de produtos a retornar. Default 10.",
          },
        },
      },
    },
    {
      name: "listar_produtos_parados",
      description:
        "Lista produtos parados há mais de N dias. Use pra perguntas como 'o que está parado?', 'produtos com pouco giro', 'capital empatado'.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          dias_minimos: {
            type: SchemaType.NUMBER,
            description: "Dias mínimos parado. Default 90.",
          },
        },
      },
    },
    {
      name: "listar_sugestoes_compra",
      description:
        "Lista produtos que precisam de reposição com LEC sugerido. Use pra 'o que preciso comprar?', 'sugestões de compra', 'falta o quê'.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
      },
    },
    {
      name: "recalcular_curva_abc",
      description:
        "Recalcula a classificação ABC de todos os produtos baseado nas vendas dos últimos 90 dias. Use quando o usuário pedir 'recalcula o ABC', 'atualiza a classificação'.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
      },
    },
    {
      name: "gerar_pedido_compra_csv",
      description:
        "Gera CSV com produtos a comprar baseado nas sugestões. Use pra 'gera pedido de compra', 'exporta lista de compras'.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          fornecedor_id: {
            type: SchemaType.STRING,
            description:
              "ID do fornecedor pra filtrar (opcional). Se omitido, gera pra todos.",
          },
        },
      },
    },

    // ━━━ NÍVEL 2 — CADASTROS ━━━
    {
      name: "cadastrar_produto",
      description:
        "Cadastra um novo produto. Pede confirmação ANTES de executar. Use quando o usuário pedir 'cadastra um produto', 'adiciona X no catálogo'.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          sku: { type: SchemaType.STRING, description: "Código SKU único" },
          nome: { type: SchemaType.STRING, description: "Nome do produto" },
          tipo: {
            type: SchemaType.STRING,
            description: "Tecido, Ferragem ou Acessório",
          },
          unidade: { type: SchemaType.STRING, description: "UN, M, M2, KG" },
          custo_inicial: {
            type: SchemaType.NUMBER,
            description: "Custo de aquisição (opcional)",
          },
          preco_venda: {
            type: SchemaType.NUMBER,
            description: "Preço de venda (opcional)",
          },
          fornecedor_id: {
            type: SchemaType.STRING,
            description: "ID do fornecedor (opcional)",
          },
        },
        required: ["sku", "nome", "tipo", "unidade"],
      },
    },
    {
      name: "cadastrar_fornecedor",
      description:
        "Cadastra um novo fornecedor. Pede confirmação. Use pra 'adiciona fornecedor X', 'cadastra fornecedor'.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          nome: { type: SchemaType.STRING, description: "Nome do fornecedor" },
          contato: {
            type: SchemaType.STRING,
            description: "Pessoa de contato (opcional)",
          },
          telefone: { type: SchemaType.STRING, description: "Telefone (opcional)" },
          cnpj: { type: SchemaType.STRING, description: "CNPJ (opcional)" },
          lead_time_dias: {
            type: SchemaType.NUMBER,
            description: "Prazo médio de entrega em dias",
          },
        },
        required: ["nome"],
      },
    },
    {
      name: "cadastrar_localizacao",
      description: "Cadastra nova localização física na loja. Pede confirmação.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          codigo: {
            type: SchemaType.STRING,
            description: "Código curto (ex: BCO-01)",
          },
          setor: { type: SchemaType.STRING, description: "Nome do setor" },
          prateleira: {
            type: SchemaType.STRING,
            description: "Identificação da prateleira (opcional)",
          },
          posicao: {
            type: SchemaType.STRING,
            description: "Posição (Frente/Meio/Fundo/Superior)",
          },
          nivel_acesso: {
            type: SchemaType.STRING,
            description: "balcao/acessivel/medio/fundo/deposito",
          },
        },
        required: ["codigo", "setor", "nivel_acesso"],
      },
    },
    {
      name: "editar_configuracao",
      description:
        "Edita uma configuração do sistema (ex: lead time padrão, dias pra considerar parado, etc). Pede confirmação.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          chave: { type: SchemaType.STRING, description: "Nome da configuração" },
          valor: { type: SchemaType.STRING, description: "Novo valor" },
        },
        required: ["chave", "valor"],
      },
    },

    // ━━━ NÍVEL 3 — OPERAÇÕES CRÍTICAS ━━━
    {
      name: "registrar_entrada",
      description:
        "Registra entrada de mercadoria (compra). Afeta estoque e dispara recálculo de custo médio. Pede confirmação COM REVISÃO COMPLETA.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          produto_id: { type: SchemaType.STRING, description: "ID do produto" },
          quantidade: {
            type: SchemaType.NUMBER,
            description: "Quantidade entrando",
          },
          custo_unitario: { type: SchemaType.NUMBER, description: "Custo unitário" },
          fornecedor_id: {
            type: SchemaType.STRING,
            description: "ID do fornecedor (opcional)",
          },
          nota_fiscal: {
            type: SchemaType.STRING,
            description: "Número da NF (opcional)",
          },
        },
        required: ["produto_id", "quantidade", "custo_unitario"],
      },
    },
    {
      name: "registrar_venda",
      description:
        "Registra uma venda. Afeta estoque (PEPS automático). Pede confirmação COM REVISÃO COMPLETA.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          cliente: {
            type: SchemaType.STRING,
            description: "Nome do cliente (opcional)",
          },
          vendedor: { type: SchemaType.STRING, description: "Nome do vendedor" },
          itens: {
            type: SchemaType.ARRAY,
            description: "Lista de itens da venda",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                produto_id: { type: SchemaType.STRING },
                quantidade: { type: SchemaType.NUMBER },
                preco_unitario: { type: SchemaType.NUMBER },
                desconto: { type: SchemaType.NUMBER },
              },
              required: ["produto_id", "quantidade", "preco_unitario"],
            },
          },
        },
        required: ["vendedor", "itens"],
      },
    },
    {
      name: "mover_item_localizacao",
      description: "Move um produto de uma localização pra outra. Pede confirmação.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          produto_id: { type: SchemaType.STRING },
          localizacao_destino_id: { type: SchemaType.STRING },
        },
        required: ["produto_id", "localizacao_destino_id"],
      },
    },
    {
      name: "inativar_produto",
      description:
        "Inativa um produto (não deleta, só esconde). Pede confirmação com revisão completa.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          produto_id: { type: SchemaType.STRING },
        },
        required: ["produto_id"],
      },
    },
  ],
}
