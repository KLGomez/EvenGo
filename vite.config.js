import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        name: 'EvenGo - Agenda de Buenos Aires',
        short_name: 'EvenGo',
        description: 'Descubrí los mejores eventos culturales, musicales y gastronómicos de Buenos Aires.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  test: {
    // Tests de API (Node.js puro, sin DOM)
    environment: 'node',
    // Tests de hooks de React usan jsdom
    environmentMatchGlobs: [
      ['src/**/*.test.{js,jsx}', 'jsdom'],
    ],
    include: [
      'api/**/*.test.js',
      'src/**/*.test.{js,jsx}',
    ],
    globals: true,
  },
})
