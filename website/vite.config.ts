import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const backendTarget = process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'AGROVERCITY',
        short_name: 'AGROVERCITY',
        display: 'standalone',
        start_url: '/',
        theme_color: '#16A34A',
        background_color: '#ffffff',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/v1\/reference\//,
            handler: 'CacheFirst',
            options: { cacheName: 'reference' },
          },
          {
            urlPattern: /\/src\/lib\/i18n\//,
            handler: 'CacheFirst',
            options: { cacheName: 'locales' },
          },
          {
            urlPattern: /\/v1\//,
            method: 'GET',
            handler: 'NetworkFirst',
            options: { cacheName: 'api' },
          },
        ],
      },
    }),
  ],
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
    rollupOptions: {
      output: {
        // Lazy route chunks live in a subfolder so the first-load entry chunk
        // (`assets/index-*.js`) is the only index chunk at the top level.
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
