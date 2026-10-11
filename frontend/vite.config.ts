import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5102,
    host: true,
  },
  resolve: {
    alias: {
      '@community/shared': fileURLToPath(new URL('../packages/shared/src', import.meta.url)),
    },
  },
});
