import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Testa apenas funções puras de `src/lib` (PR 5.17) — sem montar componentes
 * React nem depender do runtime do Next.js, por isso `environment: 'node'`
 * é suficiente e evita adicionar jsdom/testing-library a este pacote.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
