import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const VENDOR = [
  '/react/',
  '/react-dom/',
  '/scheduler/',
  '/react-router/',
  '/react-router-dom/',
  '/socket.io-client/',
  '/engine.io-client/',
  '/lucide-react/',
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (
            id.includes('react-dom-server') ||
            id.includes('react-dom/server')
          )
            return;
          if (VENDOR.some((lib) => id.includes('node_modules' + lib)))
            return 'vendor';
        },
      },
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'https://165-245-217-29.nip.io',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
