import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const native = Boolean(process.env.TAURI_ENV_PLATFORM)

export default defineConfig({
  plugins: [
    react(),
    // Native Tauri releases use their embedded web assets; PWA caching is web-only.
    ...(!native ? [VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '/',
        name: 'GoreeCloud Image Search',
        short_name: 'Image Search',
        description: 'Explore openly licensed photography and illustrations in a beautiful masonry gallery.',
        theme_color: '#faf9fc',
        background_color: '#faf9fc',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'any',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,css,js,svg,png}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Never cache remote image URLs, search queries, or third-party responses.
        runtimeCaching: [],
        maximumFileSizeToCacheInBytes: 1_500_000,
      },
    })] : []),
  ],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: { target: process.env.TAURI_ENV_PLATFORM === 'android' ? 'es2020' : 'es2022' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
