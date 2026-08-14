# Cortinas — respostas da loja (14/08/2026), organizadas

A loja respondeu o questionário das cortinas com texto, 5 fotos (romaneios e
pedidos de compra) e um áudio. O áudio diz, em resumo: *"as fotos são as
tabelas de quando eu compro, do romaneio — monta umas tabelas organizadas que
depois eu refino o que fica, preço e largura"*. Este arquivo é essa
organização: o que já entrou no sistema, o que ela precisa preencher e o que
ainda precisa responder.

## 1. O que JÁ entrou no sistema (validado por orçamento real)

Os dois orçamentos de conta aberta que ela mandou (Wave 2,00×2,30) foram
reproduzidos ao centavo pelo motor — `src/lib/__tests__/motor.test.ts`:

| valor | de onde veio |
|---|---|
| Varão simples **R$ 24,00/m** | Opção 01: 2,00m × 24 = 48 |
| Trilho duplo **R$ 48,00/m de largura** (2 linhas × R$ 24) | Opção 02: 4,00m de trilho × 24 = 96 |
| Franzido **não leva fita** | Opção 02: fundo franzido sem item de fita |
| MO do franzido **igual à do Wave** (÷1,50 × R$ 40) | Opção 02: 3,00 ÷ 1,50 × 40 = 80 |
| MO com forro costurado junto **conta os dois panos** | Opção 01: (5+5) ÷ 1,50 × 40 = 266,67 — correção no motor |

Com isso a calculadora de cortina destravou: só **varão duplo** segue sem preço.

## 2. Regras dela, em limpo

**Modelos**: Wave, Pregas e Franzida — em varão ou trilho, simples ou duplo.

**Fatores de franzimento** (largura × fator):

| situação | fator declarado |
|---|---|
| Franzido/Prega como frente (cortina) | ×3,0 |
| Wave com fita irregular | ×3,0 |
| Wave com fita regular | ×2,5 |
| Forro BK 70% ou Classic | ×1,8 ⚠️ ver divergência D1 |
| Forro BK 100% | ×1,5 |

**Altura (acréscimos de corte)**:

| item | medida |
|---|---|
| Bainha | 3 cm ⚠️ ver pergunta P2 |
| Barra | +18 cm |
| Entretela (Wave e Pregas) | +12 cm |
| Entretela (Franzido) | +10 cm |

## 3. Catálogo de venda — falta ela preencher os preços

Estrutura exatamente como ela listou (a tabela é separada da de persianas):

| tecido | cores | largura | preço/m venda |
|---|---|---|---|
| Gaze de linho | branco, bege, cinza, trigo, pérola | 2,80 | R$ ____ |
| Gaze de linho | idem | 3,00 | R$ ____ |
| Gaze de linho | idem | 3,30 | R$ ____ |
| Gaze de linho cru | — | 2,80 | R$ ____ |
| Gaze de linho cru | — | 3,00 | R$ ____ |
| Gaze de linho cru | — | 3,30 | R$ ____ |
| Blackout 100% | branco, pérola, cinza | 3,00 | R$ ____ |
| Blackout 70% | branco, amêndoa, cinza | 3,00 | R$ ____ |
| Forro Classic | branco, pérola, cinza | 3,00 | R$ ____ |

*Não cadastrado no banco ainda de propósito: linha sem preço quebraria a
calculadora. Quando os preços vierem, entra tudo pela tela Preços → Cortinas.*

## 4. Custos de compra extraídos das fotos (romaneios/pedidos)

⚠️ Fotos de tela, algumas linhas desalinhadas — **conferir antes de usar**.
São custo de COMPRA, não preço de venda.

**Tecidos — REFINADO PELA LOJA (WhatsApp, 14/08)**, substitui a leitura das
fotos:

| tecido | custo/m |
|---|---|
| Flame pesado | 11,50 |
| Flame leve | 10,50 |
| Flame pesado 3,30m | 13,50 |
| Semi black 70% 2,80m | 13,50 |
| Semi black 70% 3,00m | 15,50 |
| Black 100% | 15,20 |
| Natural Look 2865 | 16,00 |
| Natural Look 2868 | 18,90 |
| Natural Look 2866 | 16,00 |
| Natural Look 2867 | 13,90 |
| Microfibra 90g 3,00m | 7,00 |
| Microfibra 90g 3,30m | 7,80 |
| Linho irlandês 3,00m (marfim/trigo)* | 15,73 |
| Linho wide jaspe 3,30m (trigo)* | 19,27 |

*\*linhos vieram só nas fotos, a loja não repetiu na lista refinada.*

⚠️ Estes nomes são os de COMPRA (fornecedor) e não casam 1:1 com o catálogo
de venda da seção 3 (Gaze de linho, Forro Classic…). O mapeamento
compra→venda ainda precisa da loja — não chutar.

**Suportes e aviamentos** (pedido M.A.V. 07/07/2026):

| item | custo |
|---|---|
| Varão ultra especial 28mm (cromado, aço escovado) | 16,90/m |
| Trilho max tradicional simples c/ aba branco | 6,49/m |
| Trilho max tradicional duplo c/ espaçamento branco | 15,49/m |
| Entretela TNT 150g | 0,518/m |
| Deslizante c/ furo | 0,079/un |
| Deslizante wave p/ botão de metal | 0,149/un |
| Suporte Klin regulável simples | 6,50/un |
| Ponteira tampão 28mm aço escovado | 1,69/un |

*Referência de margem: trilho vendido a R$ 24/m custa R$ 6,49/m.*

## 5. Divergências e perguntas abertas (mandar pra loja)

- **D1 — fator do forro BK70**: você falou ×1,8 pra BK70/Classic, mas o seu
  orçamento real (Opção 02) usa BK70 franzido com ×1,5. Qual vale? *(o sistema
  está com 1,5 — o do exemplo real — até você bater o martelo)*
- **D2 — "valor comercial"**: nos dois orçamentos, depois do parcelado (+6%)
  ainda existe um "valor comercial" maior (931,92 → 1.009,20 e 838,28 →
  920,84). A conta desses dois saltos não segue um % único (8,3% num, 9,8% no
  outro). Como esse valor é formado?
- **P1 — fita regular × irregular no Wave**: o que decide se a fita é regular
  (×2,5) ou irregular (×3,0)? É escolha do cliente, do tecido, ou da altura?
  *(hoje o sistema decide pela altura: acima de 2,80m usa ×3,0)*
- **P2 — bainha 3cm**: entra SEMPRE além da barra+entretela, ou é acabamento
  alternativo (ou bainha lateral)? O corte validado (altura + 0,12 + 0,18) não
  inclui os 3cm.
- **P3 — varão duplo**: quanto por metro? *(único suporte ainda sem preço)*
- **P4 — modelo Pregas**: consumo ×3,0 como o franzido-frente? Fita/entretela
  de prega tem preço próprio ou usa os mesmos R$ 31,40/m do Wave?
- **P5 — preços de venda dos tecidos**: a tabela da seção 3, com os R$ em
  branco. A loja respondeu com a tabela de CUSTO refinada (seção 4) — segue
  faltando o preço de venda, OU a margem sobre o custo (P6/markup), OU o
  mapeamento nome de compra → nome de venda.
- **P6 — emenda, motorizado, prazo e markup**: perguntas 8–11 do questionário
  ficaram sem resposta.
