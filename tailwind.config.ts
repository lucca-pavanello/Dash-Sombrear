import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        brand: {
          // Mantido em sincronia com --primary (25 82% 51% = #E8701A)
          DEFAULT: 'hsl(var(--primary))',
          dark: '#C45E14',
          light: '#F0854A',
        },
        // Séries de gráfico com duas categorias — passos validados em src/index.css.
        // Cada modo tem o seu, então nunca hardcodar o hex aqui.
        serie: {
          1: 'hsl(var(--serie-1))',
          2: 'hsl(var(--serie-2))',
        },
        // Lâminas do funil do atendimento — passos e tintas em src/index.css, por modo.
        funil: {
          1: 'hsl(var(--funil-1))', '1-tinta': 'hsl(var(--funil-1-tinta))',
          2: 'hsl(var(--funil-2))', '2-tinta': 'hsl(var(--funil-2-tinta))',
          3: 'hsl(var(--funil-3))', '3-tinta': 'hsl(var(--funil-3-tinta))',
          4: 'hsl(var(--funil-4))', '4-tinta': 'hsl(var(--funil-4-tinta))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        elevated: '0 4px 24px -4px rgba(0,0,0,0.15)',
        brand: '0 4px 24px -4px rgba(232,112,26,0.35)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #E8701A 0%, #C45E14 100%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}

export default config
