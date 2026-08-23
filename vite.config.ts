/// <reference types="vite/client" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// على GitHub Pages يعيش الموقع داخل مجلد باسم المستودع (/ma/)،
// ومحلياً يعيش في الجذر (/). يُضبط من متغير البيئة VITE_BASE_PATH.
const basePath = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'supabase'
            return 'vendor'
          }
          if (id.includes('/src/pages/admin/') || id.includes('/src/components/admin/')) {
            return 'admin'
          }
          return undefined
        },
      },
    },
  },
})
