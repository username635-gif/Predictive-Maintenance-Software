import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'ReliabilityOS – Pipeline Integrity',
        short_name: 'ReliabilityOS',
        description: 'Predictive Maintenance for Oil & Gas Pipelines',
        theme_color: '#0A0E17',
        background_color: '#0A0E17',
        display: 'standalone',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 2000, maxAgeSeconds: 86400 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^http:\/\/localhost:4000\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxAgeSeconds: 3600 },
              networkTimeoutSeconds: 5
            }
          }
        ]
      }
    })
  ],
  server: { port: 3000 },
  define: {
    // Intentionally do not set VITE_DEMO_MODE by default.
    // Enable demo controls/badges only via explicit env configuration.
  },
});

