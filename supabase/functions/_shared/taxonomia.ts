/**
 * Vocabulário fixo das etiquetas: objeções do cliente e falhas de atendimento da equipe.
 *
 * ESPELHO de src/lib/insights/taxonomia.ts (o Deno não importa de src/). Mudou lá, muda
 * aqui: slug que só existe de um lado é gravado e some da contagem do dash sem ninguém
 * perceber. src/lib/__tests__/classificarFases.test.ts compara as duas listas.
 *
 * (classificar-conversas ainda tem a sua cópia das objeções, de antes deste arquivo.)
 */

export const OBJECOES: ReadonlyArray<{ id: string; criterio: string }> = [
  { id: 'foto_tecido',        criterio: 'não consegue imaginar como o tecido fica: transparência, se dá pra ver de fora, quanto escurece, diferença entre Tela Solar 1% e 3%, quer ver foto real' },
  { id: 'preco_alto',         criterio: 'reagiu ao valor como alto, comparou com o que esperava gastar, disse que está fora do orçamento' },
  { id: 'desconto_avista',    criterio: 'pede desconto, condição especial, ou pergunta o valor à vista / parcelado' },
  { id: 'custo_instalacao',   criterio: 'estranhou que instalação ou frete são cobrados à parte, ou pediu pacote com instalação inclusa' },
  { id: 'orcamento_apertado', criterio: 'quer reduzir metragem, quantidade de peças ou trocar por modelo mais barato para o total caber num teto' },
  { id: 'prazo_entrega',      criterio: 'achou o prazo longo, tem data limite, ou está cobrando previsão de entrega/instalação' },
  { id: 'manutencao_limpeza', criterio: 'quer conserto, troca de peça, manutenção ou limpeza de persiana já instalada — sua ou de terceiros' },
  { id: 'decisao_terceiro',   criterio: 'precisa consultar cônjuge, sócio, diretoria, arquiteto ou síndico antes de decidir' },
  { id: 'duvida_medida',      criterio: 'não sabe medir, confundiu medida do vão com a final, ou tem medo de errar e receber peça errada' },
  { id: 'comprou_outro',      criterio: 'disse que comprou ou fechou em outro lugar, ou que achou mais barato em outra loja' },
  { id: 'adiou',              criterio: 'deixou pra depois: obra não pronta, mudança futura, "ano que vem", sem urgência' },
  { id: 'outro',              criterio: 'travou por um motivo real que não cabe em nenhum item acima — descreva em objecao_outro' },
]

export const FALHAS: ReadonlyArray<{ id: string; criterio: string }> = [
  { id: 'retorno_esquecido',     criterio: 'a loja prometeu voltar (com orçamento, data, verificação, foto) e não voltou no combinado; o cliente teve que cobrar ("estou aguardando", "algum retorno?", "já tem data?")' },
  { id: 'orcamento_demorado',    criterio: 'o cliente já tinha passado o que precisava (medida, modelo, foto) e esperou mais de 1 dia útil pelo preço, ou cobrou o orçamento' },
  { id: 'pergunta_sem_resposta', criterio: 'o cliente fez uma pergunta escrita (valor, forma de pagamento, prazo, detalhe do produto) e a loja não respondeu nem retomou o assunto depois. Se a loja mandou áudio logo em seguida, NÃO marque: a resposta pode estar no áudio' },
  { id: 'orcamento_confuso',     criterio: 'o cliente não entendeu o orçamento ou achou erro nele: item que não pediu, valor que mudou sem explicação, instalação ou taxa que não estava dita, e precisou perguntar o que significava' },
  { id: 'sem_followup',          criterio: 'depois do orçamento o cliente ficou em silêncio ou disse que ia pensar ou consultar alguém, e a loja passou mais de 3 dias sem chamar de novo, ou só voltou com mensagem em massa (promoção para todos)' },
  { id: 'fechamento_parado',     criterio: 'o cliente deu sinal de compra (disse que quer fechar, aceitou o valor, perguntou forma de pagamento ou prazo para fazer) e a loja não conduziu o próximo passo: pagamento, data de medição ou de instalação' },
  { id: 'prazo_sem_aviso',       criterio: 'o prazo de produção, entrega ou instalação passou ou mudou e o cliente só soube quando perguntou; a loja não avisou antes' },
  { id: 'outro',                 criterio: 'a loja deixou passar algo real que não cabe em nenhum item acima — descreva em falha_outro' },
]
