import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
    sourcemap: false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  define: {
    // Rende disponibile VITE_HOST nel bundle anche se non è in .env
    'import.meta.env.VITE_HOST': JSON.stringify(process.env.VITE_HOST || ''),
  },
});
