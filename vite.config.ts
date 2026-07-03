import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
// For GitHub Pages project sites, set VITE_BASE_PATH="/<repo-name>/" when
// building — it drives both Vite's asset base AND the PWA manifest's
// start_url/scope below, so an installed PWA launches at the right
// subpath instead of the origin root (which 404s on a project site).
const basePath = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FinVizer - ระบบจัดการเอกสารธุรกิจและบัญชี',
        short_name: 'FinVizer',
        description:
          'ระบบจัดการเอกสารธุรกิจ ใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ และใบกำกับภาษี สำหรับธุรกิจไทย',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: basePath,
        scope: basePath,
        lang: 'th',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // woff added alongside woff2 in Phase 5A — the PDF export Thai
        // font is shipped as WOFF (not WOFF2), see src/lib/pdf/fonts.ts.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
