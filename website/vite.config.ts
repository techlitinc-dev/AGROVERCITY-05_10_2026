import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
