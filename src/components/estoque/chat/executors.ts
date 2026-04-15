import { supabase } from "@/lib/supabase"
import type { NomeTool } from "./tools"

export interface ResultadoTool {
  sucesso: boolean
  mensagem: string
  dados?: unknown
}

export async function executarTool(
  nome: NomeTool,
  args: Record<string, unknown>
): Promise<ResultadoTool> {
  try {
    switch (nome) {
      // ━━━ NÍVEL 1 ━━━
      case "consultar_estoque_resumo": {
        const { data, error } = await supabase.rpc("estoque_chat_contexto")
        if (error) throw error
        return { sucesso: true, mensagem: "Resumo obtido", dados: data.resumo }
      }

      case "listar_produtos_classe_a": {
        const limite = (args.limite as number) || 10
        const { data, error } = await supabase
          .from("estoque_produtos")
          .select("sku, nome, estoque_atual, custo_medio, preco_venda")
          .eq("classe_abc", "A")
          .eq("ativo", true)
          .limit(limite)
        if (error) throw error
        return { sucesso: true, mensagem: `${data.length} produtos classe A`, dados: data }
      }

      case "listar_produtos_parados": {
        const dias = (args.dias_minimos as number) || 90
        const { data, error } = await supabase
          .from("estoque_vw_lead_time")
          .select("*")
          .gte("dias_em_estoque", dias)
          .order("dias_em_estoque", { ascending: false })
          .limit(20)
        if (error) throw error
        return { sucesso: true, mensagem: `${data.length} produtos parados`, dados: data }
      }

      case "listar_sugestoes_compra": {
        const { data, error } = await supabase
          .from("estoque_vw_sugestao_compra")
          .select("*")
          .neq("urgencia", "ok")
        if (error) throw error
        return { sucesso: true, mensagem: `${data.length} sugestões`, dados: data }
      }

      case "recalcular_curva_abc": {
        const { error } = await supabase.rpc("estoque_recalcular_abc")
        if (error) throw error
        return { sucesso: true, mensagem: "Curva ABC recalculada com sucesso" }
      }

      case "gerar_pedido_compra_csv": {
        let query = supabase.from("estoque_vw_sugestao_compra").select("*").neq("urgencia", "ok")
        if (args.fornecedor_id) {
          query = query.eq("fornecedor_id", args.fornecedor_id as string)
        }
        const { data, error } = await query
        if (error) throw error
        const csv =
          "SKU,Nome,Quantidade,Fornecedor\n" +
          data
            .map(
              (d: Record<string, unknown>) =>
                `${d.sku},"${d.nome}",${d.lec_sugerido},"${d.fornecedor_nome}"`
            )
            .join("\n")
        return { sucesso: true, mensagem: "CSV gerado", dados: { csv, total_itens: data.length } }
      }

      // ━━━ NÍVEL 2 — CADASTROS ━━━
      case "cadastrar_produto": {
        const { data, error } = await supabase
          .from("estoque_produtos")
          .insert({
            sku: args.sku,
            nome: args.nome,
            tipo: args.tipo,
            unidade: args.unidade,
            custo_medio: (args.custo_inicial as number) || 0,
            preco_venda: (args.preco_venda as number) || null,
            fornecedor_id: (args.fornecedor_id as string) || null,
            ativo: true,
          })
          .select()
          .single()
        if (error) throw error
        return { sucesso: true, mensagem: `Produto ${(data as Record<string,unknown>).nome} cadastrado!`, dados: data }
      }

      case "cadastrar_fornecedor": {
        const { data, error } = await supabase
          .from("estoque_fornecedores")
          .insert({
            nome: args.nome,
            contato: (args.contato as string) || null,
            telefone: (args.telefone as string) || null,
            cnpj: (args.cnpj as string) || null,
            lead_time_medio_dias: (args.lead_time_dias as number) || 7,
            ativo: true,
          })
          .select()
          .single()
        if (error) throw error
        return { sucesso: true, mensagem: `Fornecedor ${(data as Record<string,unknown>).nome} cadastrado!`, dados: data }
      }

      case "cadastrar_localizacao": {
        const { data, error } = await supabase
          .from("estoque_localizacoes")
          .insert({
            codigo: args.codigo,
            setor: args.setor,
            prateleira: (args.prateleira as string) || null,
            posicao: (args.posicao as string) || null,
            nivel_acesso: args.nivel_acesso,
            ativo: true,
          })
          .select()
          .single()
        if (error) throw error
        return { sucesso: true, mensagem: `Localização ${(data as Record<string,unknown>).codigo} cadastrada!`, dados: data }
      }

      case "editar_configuracao": {
        const { data, error } = await supabase
          .from("estoque_config")
          .upsert({ chave: args.chave, valor: args.valor })
          .select()
          .single()
        if (error) throw error
        return { sucesso: true, mensagem: `Configuração ${args.chave} atualizada`, dados: data }
      }

      // ━━━ NÍVEL 3 — OPERAÇÕES CRÍTICAS ━━━
      case "registrar_entrada": {
        const { data, error } = await supabase
          .from("estoque_lotes")
          .insert({
            produto_id: args.produto_id,
            quantidade_inicial: args.quantidade,
            quantidade_atual: args.quantidade,
            custo_unitario: args.custo_unitario,
            fornecedor_id: (args.fornecedor_id as string) || null,
            nota_fiscal: (args.nota_fiscal as string) || null,
          })
          .select()
          .single()
        if (error) throw error
        return { sucesso: true, mensagem: "Entrada registrada com sucesso", dados: data }
      }

      case "registrar_venda": {
        const { data: venda, error: vendaError } = await supabase
          .from("estoque_vendas")
          .insert({
            cliente: (args.cliente as string) || null,
            vendedor: args.vendedor,
            data: new Date().toISOString(),
          })
          .select()
          .single()
        if (vendaError) throw vendaError

        const itens = args.itens as Array<{
          produto_id: string
          quantidade: number
          preco_unitario: number
          desconto?: number
        }>
        const itensInsert = itens.map((i) => ({
          venda_id: (venda as Record<string, unknown>).id,
          produto_id: i.produto_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          desconto: i.desconto || 0,
          subtotal: i.quantidade * i.preco_unitario - (i.desconto || 0),
        }))
        const { error: itensError } = await supabase
          .from("estoque_venda_itens")
          .insert(itensInsert)
        if (itensError) throw itensError

        return { sucesso: true, mensagem: "Venda registrada", dados: venda }
      }

      case "mover_item_localizacao": {
        const { data, error } = await supabase
          .from("estoque_produtos")
          .update({ localizacao_id: args.localizacao_destino_id })
          .eq("id", args.produto_id as string)
          .select()
          .single()
        if (error) throw error
        return { sucesso: true, mensagem: "Produto movido", dados: data }
      }

      case "inativar_produto": {
        const { data, error } = await supabase
          .from("estoque_produtos")
          .update({ ativo: false })
          .eq("id", args.produto_id as string)
          .select()
          .single()
        if (error) throw error
        return { sucesso: true, mensagem: "Produto inativado", dados: data }
      }

      default: {
        const _exhaustive: never = nome
        return { sucesso: false, mensagem: `Tool ${_exhaustive} não implementada` }
      }
    }
  } catch (error) {
    return {
      sucesso: false,
      mensagem: error instanceof Error ? error.message : "Erro desconhecido",
    }
  }
}

export function gerarPreviewAcao(
  toolName: NomeTool,
  args: Record<string, unknown>
): string {
  switch (toolName) {
    case "cadastrar_produto":
      return `Cadastrar produto:\n- SKU: ${args.sku}\n- Nome: ${args.nome}\n- Tipo: ${args.tipo}\n- Unidade: ${args.unidade}`

    case "cadastrar_fornecedor":
      return `Cadastrar fornecedor:\n- Nome: ${args.nome}${args.cnpj ? `\n- CNPJ: ${args.cnpj}` : ""}${args.lead_time_dias ? `\n- Lead time: ${args.lead_time_dias} dias` : ""}`

    case "cadastrar_localizacao":
      return `Cadastrar localização:\n- Código: ${args.codigo}\n- Setor: ${args.setor}\n- Nível: ${args.nivel_acesso}`

    case "editar_configuracao":
      return `Alterar configuração:\n- Chave: ${args.chave}\n- Novo valor: ${args.valor}`

    case "registrar_entrada": {
      const total =
        (args.quantidade as number) * (args.custo_unitario as number)
      return `Registrar entrada:\n- Produto ID: ${args.produto_id}\n- Quantidade: ${args.quantidade}\n- Custo unit.: R$ ${(args.custo_unitario as number).toFixed(2)}\n- Total: R$ ${total.toFixed(2)}${args.nota_fiscal ? `\n- NF: ${args.nota_fiscal}` : ""}`
    }

    case "registrar_venda": {
      const itens = args.itens as Array<{
        quantidade: number
        preco_unitario: number
        desconto?: number
      }>
      const totalItens = itens.reduce(
        (acc, i) => acc + i.quantidade * i.preco_unitario - (i.desconto || 0),
        0
      )
      return `Registrar venda:\n- Vendedor: ${args.vendedor}\n- Cliente: ${args.cliente || "não informado"}\n- Itens: ${itens.length}\n- Total: R$ ${totalItens.toFixed(2)}`
    }

    case "mover_item_localizacao":
      return `Mover produto:\n- Produto ID: ${args.produto_id}\n- Para localização ID: ${args.localizacao_destino_id}`

    case "inativar_produto":
      return `Inativar produto:\n- Produto ID: ${args.produto_id}\n\nEsta ação oculta o produto do catálogo. Não pode ser desfeita facilmente.`

    default:
      return `Executar ${toolName}:\n${JSON.stringify(args, null, 2)}`
  }
}
