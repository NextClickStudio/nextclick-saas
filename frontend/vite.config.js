import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',        // keep same output folder — backend expects /frontend/build
    sourcemap: false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  define: {
    // Vite uses import.meta.env, but keep process.env support for libraries
    'process.env': {},
  },
});
