import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@muon/enterprise-contracts': resolve(__dirname, '../../packages/enterprise-contracts/src/index.ts'),
    },
  },
  server: {
    port: 4174,
    strictPort: true,
  },
})
