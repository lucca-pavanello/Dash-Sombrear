# Agente IA como produto — plano de replicação (Ogarimpo + Dorce)

> Escrito em 2026-08-17. Objetivo: chegar nos dois com o agente JÁ respondendo
> no WhatsApp antes de pedir qualquer coisa a eles. Tudo roda com credenciais
> e número do Lucca; nada depende do cliente até ele dizer sim.

## O que sabemos de cada um (pesquisa pública, 17/08)

### Ogarimpo / Garimpo Studio — barbearia
- **Fonte**: `sites.appbarber.com.br/garimpostudio-4emz` + Instagram `@ogarimpostudio` / `@ryangomes.gs`
- **Endereço**: Rua Redentora, 2955 — Vila Redentora, São José do Rio Preto/SP
- **Horário**: seg–sex 08:00–20:00 · sáb 08:00–17:00
- **Profissionais**: Mike, Ryan
- **Tagline**: "Uma nova experiência para uma antiga tradição."
- **Pagamento**: dinheiro, crédito, débito, PIX, pacote
- **Comodidades**: wi-fi, estacionamento, acessibilidade, atende crianças
- **Serviços (preço real da tabela pública)**:

| serviço | preço | duração |
|---|---|---|
| Corte | 60,00 | 40 min |
| Corte + Sobrancelha | 85,00 | 40 min |
| Corte + Barba | 100,00 | 60 min |
| Barba | 50,00 | 30 min |
| Barba Express | a partir de 30,00 | 20 min |
| Sobrancelha | 25,00 | 10 min |
| Ajuste do bigode | 20,00 | 10 min |
| Pézinho | 30,00 | 10 min |
| Hidratação | 30,00 | 10 min |
| Depilação nasal | 30,00 | 10 min |
| Selagem | a partir de 160,00 (mediante avaliação) | 40 min |

- **Branding (medido na logo real)**: fundo azul-marinho profundo `#102030`,
  texto off-white `#F0F0F0`, acento dourado/âmbar `#F0A040`. Direção: escuro,
  clássico, dourado como assinatura. Fonte a confirmar no Instagram (o site do
  AppBarber é template da plataforma — não usar as cores de lá).
- **O que o Ryan pediu (WhatsApp 17/08)**: além do atendimento 24h, **régua de
  retorno por tipo de cliente** (7/15/21/30/45/60 dias) e pós-venda de cliente
  novo. Perguntou "tem algo validado no meu segmento?" — a demo responde isso.
- **Hipóteses até ele corrigir**: agenda no AppBarber (a IA reserva e o
  barbeiro confirma; integração direta com o app é etapa 2); régua padrão por
  serviço: corte 21d, corte+barba 21d, barba 15d, selagem 60d, cliente novo
  pós-venda D+1; tom: próximo, direto, sem formalidade ("fala, meu amigo").

### Produtora Dorce — retratos corporativos
- **Fonte**: `produtoradorce.com` + Instagram `@produtoradorce` / `@joaopedrodorce`
- **O que faz**: retratos profissionais "que elevam autoridade e impulsionam
  carreira"; pacotes de atualização rápida até experiência completa pra redes.
- **Diferenciais (site)**: produção completa (make + cabelo), 10+ cenários,
  direção de pose com técnica de teatro/cinema, entrega em até 3 dias úteis,
  mentoria de uso do material, "conexão antes do clique" (conversa prévia com
  o João Pedro).
- **Agenda**: ter–sáb, sessões às 9h e 14h (~4h cada). Contato principal:
  WhatsApp (17) 98204-3154; formulário do site redireciona pro WhatsApp.
- **Preço**: NÃO é público — o site leva pro WhatsApp. Decisão de produto dele:
  o agente qualifica antes de falar valor (ou passa pro João Pedro). Não
  inventar preço na demo — mostrar exatamente esse comportamento.
- **Branding (medido no site)**: fundo quase-preto `#121315`, texto `#333`/
  cinza-claro `#E4E4E4`, acento amarelo-ouro `#FFBF08` (+ variante `#FEC42D`),
  rosa `#CC3366` como cor secundária/CTA. Fontes: **Syne** (display) +
  Poppins/Montserrat (texto). Logos: `logo-dorce_branco.png` e
  `WHATS-logo-dorce_preto.png` (públicas no site).
- **Dor com o fornecedor anterior** (Lucca): IA travada, não lia foto, fizeram
  ele montar os nodes. Cada uma já é caso tratado na Stella (imagem, figurinha,
  citação, interrupção, kill-switch, canário) — é argumento de venda.
- **Hipóteses até ele corrigir**: a IA agenda a "conexão antes do clique"
  (call/conversa), não a sessão direta; qualificação mínima: profissão,
  objetivo (LinkedIn/site/campanha), prazo; tom: acolhedor e sofisticado,
  "você", sem gíria.

## Preço (definido pelo Lucca, 17/08)
- Ogarimpo e Dorce: **R$ 700–800/mês**, sem setup nos 3 primeiros clientes,
  API/tokens por conta do Lucca; **variável por volume de conversas** (fixar
  teto incluso + excedente antes de fechar); +R$ 100/mês por barbeiro novo.
- Sombrear: sem preço (família) — vale registrar custo interno como referência.
- Contrato: por último; primeiro demonstrar.

## Princípios (decididos)
1. O produto é o **agente + follow-up**; CRM visual é vitrine (vem por último).
2. **Repo novo e mínimo por produto** (`agente-crm`), não fork da Sombrear.
   1 repo, 1 deploy Vercel por cliente com env diferente.
3. **1 projeto Supabase por cliente** — isolamento, RLS simples, saída limpa.
4. Domínio é ~70% do trabalho (estágios, régua, prompt); branding ~30% (tokens).
5. **Evolution** pra atendimento e follow-up de base própria; Meta só se algum
   cliente quiser disparo frio em escala (cobra à parte).
6. Stella vira **template parametrizado** no n8n — nunca editar prompt via API
   por cliente (incidente dos escapes).

## Estágios por nicho (SeloStatus)

| # | Sombrear | Barbearia | Produtora |
|---|---|---|---|
| 1 | Novo contato | Novo contato | Novo contato |
| 2 | Coletando dados | Escolhendo serviço/horário/barbeiro | Entendendo objetivo e pacote |
| 3 | Orçado | **Agendado** | **Conversa/sessão agendada** |
| 4 | Quer fechar | Compareceu → Recorrente | Sessão feita → Entregue |
| follow-up | "e aí, fechou?" | régua por serviço + pós-venda D+1 | pós-entrega, reagendar ciclo |

## Passos

### Fase 0 — kit (sem cliente) · Terminal 1 + Lucca
- [ ] **T1**: exportar a Stella como template com variáveis (`{{CLIENTE}}`,
      `{{SUPABASE_URL}}`, credenciais nomeadas por cliente); documentar o
      import limpo.
- [ ] **T1**: extrair o extrator de status pra receber os 4 estágios do nicho
      via `config_automacoes` (ou variável), não hardcoded.
- [ ] **Lucca**: 2 chaves Gemini (uma por cliente), 2 instâncias Evolution no
      número do Lucca (`Demo_Ogarimpo`, `Demo_Dorce`), 2 inboxes Chatwoot.

### Fase 1 — agente respondendo (a demo) · Terminal 2 + Terminal 1
- [ ] **T2**: 2 projetos Supabase (`crm-ogarimpo`, `crm-dorce`) + migration
      única do kit (`profiles`, `crm_leads`, `atendimentos`,
      `config_automacoes`, `relatorios_ia`, `relatorios_pedidos`) + RLS.
- [ ] **T2**: `cliente.config.ts` por cliente — nome, tokens de cor, estágios,
      serviços/pacotes com preço, régua, tom, "nunca fazer", gatilhos de
      humano. **Único arquivo que muda por cliente.** Fonte também do prompt.
- [ ] **T1**: 2 imports do template + prompt de domínio gerado do config +
      follow-up com a régua-hipótese, ligado por kill-switch.
- [ ] **T1**: caso de QA por cliente no harness (mensagem → estágio esperado).
- [ ] **Lucca**: testar de outro número: agendar corte, mandar foto, mandar
      áudio, cancelar — e ver o lead entrar na tela.

### Fase 2 — CRM visual (vitrine) · Terminal 2
- [ ] Repo `agente-crm` mínimo: login, aba Agente IA (leads, estágio, motivo,
      origem, temperatura, follow-up), tokens por cliente, sem laranja Sombrear.
- [ ] 2 deploys Vercel (`crm-ogarimpo.vercel.app`, `crm-dorce.vercel.app`).
- [ ] Modo demo: botão "ver conversa" abre o Chatwoot.

### Fase 3 — venda
- [ ] Mensagem pro Ryan: "monta que a IA da Ogarimpo já responde — chama nesse
      número" + link do CRM na cor dele.
- [ ] Mensagem pro João Pedro: idem, com os 3 pontos da dor anterior já
      resolvidos.
- [ ] Depois do sim: form de nicho (rascunho pronto) pra afinar preço/régua/
      tom → ajustes no `config` → contrato (teto de conversas + excedente).

## Aberto
- Nome final do repo: `agente-crm`? Org: `luccapa-pav`?
- Fonte do Instagram da Garimpo (o AppBarber é template).
- Dorce: confirmar se "conexão antes do clique" é call ou WhatsApp.
