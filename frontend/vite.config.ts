import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  server: {
    port: 5102,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8102',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@community/shared': fileURLToPath(new URL('../packages/shared/src', import.meta.url)),
    },
  },
});
