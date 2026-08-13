import { defineConfig } from 'vitest/config'

// Só os testes do projeto — sem o config ele varria dist/, .claude/ e afins
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
