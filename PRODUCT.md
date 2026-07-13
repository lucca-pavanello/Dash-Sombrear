# Sombrear Dashboard

## O que é

Dashboard interno de gestão da Sombrear (cortinas e persianas): orçamentos, custos, estoque, leads do agente de IA no WhatsApp e administração de usuários. Uma página pública por orçamento (`/orcamento/:id`) é a única superfície vista por clientes.

## Register

product — o design serve a tarefa. Usuários passam horas por dia aqui (equipe de vendas + gestão); a ferramenta deve desaparecer no trabalho. A página pública é a exceção: registro brand-light, sempre clara, cara da marca.

## Platform

web — React 19 + Vite + Tailwind 3, deploy Vercel, uso principal em desktop com suporte mobile real (equipe consulta no celular).

## Usuários

- **Vendas** (Rogério, Thais, Sueli…): criam/acompanham orçamentos, fecham negócios. Fluxo principal: Calcular → n8n → Planilha → Funil.
- **Gestão/Admin** (Lucca): KPIs, análises, margens, estoque, aprovação de usuários.
- **Clientes** (via link público): veem a proposta, aceitam, chamam no WhatsApp.

## Princípios

1. Dados densos com hierarquia clara — tabelas e KPIs são o coração; nada de decoração que compita com número.
2. O laranja Sombrear (#E8701A) marca ação primária, seleção e estado — nunca decoração de fundo.
3. Tudo funciona no dark mode e no claro, sem exceção.
4. Feedback imediato: toasts, skeletons por aba, realtime; o usuário nunca fica sem saber o que aconteceu.
