# Design System — Sombrear Dashboard

Fonte de verdade das decisões visuais. Toda tela nova deve usar estes tokens e padrões — divergiu, é drift.

## Cor

Tokens HSL em `src/index.css` (`:root` + `.dark`), mapeados no `tailwind.config.ts`. **Nunca hardcodar cor fora daqui.**

- **Marca**: `--primary` = `25 82% 51%` = **#E8701A exato** (logo, botões primários, seleção, gráficos via `hsl(var(--primary))`). Gradiente oficial: `bg-brand-gradient` (#E8701A → #C45E14). Sombra de marca: `shadow-brand`.
- **Semânticos**: `background`, `card`, `border`, `muted`, `muted-foreground`, `destructive`, `ring`. Estados de negócio: emerald = fechado/ok, amber = atenção/espera, destructive = erro/ruptura, violet/blue = categorias secundárias.
- **Estratégia**: Restrained — neutros + um acento (laranja) em ≤10% da superfície. Gráficos podem usar a rampa da marca (#E8701A, #C45E14, #F59E0B, âmbares).
- Texto cinza sobre fundo colorido: proibido — usar tom da própria cor do fundo ou token semântico.

### Contraste (WCAG AA — verificado matematicamente em 2026-08-03)

- Texto normal precisa de **≥4,5:1** contra o fundo onde vive; UI/texto grande ≥3:1.
- `muted-foreground` foi calibrado pra passar AA sobre card, background E chips (`muted`): claro `220 10% 43%`, escuro `220 10% 60%`. **Não clarear** sem recalcular.
- `destructive` no dark é `0 72% 62%` (texto de erro legível). No claro, `0 72% 51%`.
- **Piso de opacidade para texto informativo**: `foreground/65` (≈5,5:1). Opacidades de `muted-foreground` em texto são proibidas (caem abaixo de 4:1 rápido). Profundidade visual = escala `foreground/85 → /75 → /65 → muted-foreground`.
- **Trade-off aceito de marca**: branco sobre `primary` (#E8701A) = 3,08:1 — passa como UI/large (3:1), não como texto normal estrito. Botões da marca mantêm texto branco `font-semibold` (decisão consciente, padrão de mercado em marcas laranja). Não usar branco sobre primary em texto longo/pequeno.

## Tipografia

- **Inter** (font-sans) para tudo de UI; **Space Grotesk** (font-display) apenas em valores de KPI e títulos de marca. Não introduzir terceira família.
- Escala fixa (rem), ratio apertado: títulos de card `text-sm font-semibold`, valores KPI `text-xl/2xl font-bold font-display`, corpo `text-sm`, metadados `text-xs text-muted-foreground`.
- Números em colunas: `tabular-nums`. Reticências: `…` (nunca `...`). Loading sempre termina em `…`.

## Espaçamento & raio

- Escala Tailwind (múltiplos de 4px); gaps padrão: `gap-3` em grids de KPI, `gap-4` em forms, `px-4 py-3` em células.
- Raios: `rounded-xl` para cards, `rounded-lg` para botões/inputs, `rounded-full` para pills/badges (`--radius: 0.75rem`).

## Primitivas base (`src/components/ui/primitives.tsx`)

- **`<Button>`** — variants `primary | brand | outline | ghost | destructive`, sizes `sm | md | lg`, props `loading` (spinner) e `fullWidth`. Foco visível, active:scale e disabled já embutidos. **Não escrever botão com classes soltas em componente novo.**
- **`<SectionTitle>`** — título de card/seção no padrão `font-display text-sm font-semibold tracking-wide` com ícone opcional e slot à direita.
- **`<EmptyState>`** — ícone + título + dica que ensina (nunca "Sem dados" seco).
- Migração: telas existentes adotam as primitivas quando forem tocadas; novas telas nascem com elas.

## Componentes

- **Cards**: `rounded-xl border bg-card shadow-sm`. Acento de variante = borda inteira tingida + banho de fundo sutil (`border-{cor}/25 bg-{cor}/[0.04]`). **Listra lateral (border-l grosso) é proibida.**
- **Linhas de alerta em tabela**: banho de fundo (`bg-destructive/[0.07]` etc. — ver `estoque/theme.ts`), nunca listra.
- **Botões**: primário `bg-primary text-white rounded-lg`; todos com `active:scale-95` + `focus-visible:ring-2 focus-visible:ring-ring/60`.
- **Loading**: skeleton (`skeleton-shimmer`) espelhando o layout real — nunca spinner no meio do conteúdo. Skeleton e conteúdo usam o MESMO grid (sem layout shift).
- **Empty states**: ícone + frase que ensina de onde vêm os dados.
- **Forms**: `grid-cols-2` com `col-span-2 sm:col-span-1` para empilhar no mobile; labels `text-[11px] uppercase tracking-widest`.

## Motion

- 150–250ms; easing `ease-out` ou `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint). **Sem bounce/elastic/overshoot.**
- Animar só `transform`/`opacity` (indicador de aba usa translateX+scaleX; dots de digitação usam `.typing-dot`).
- Motion comunica estado (chegou dado novo → pulse; fechou negócio → flash verde) — não decoração.
- `prefers-reduced-motion` respeitado globalmente (bloco no fim do `index.css`).

## Dark mode

- Classe `.dark` + `colorScheme` nativo (useTheme). Todo token tem par dark. Grays fixos (`text-gray-N`) são proibidos — usar `text-foreground`/`text-muted-foreground` com opacidades.

## Página pública (exceção de registro)

`OrcamentoPublico.tsx` é brand-light standalone: sempre clara, laranja #E8701A literal, mobile-first, sem dependência dos tokens dark.
