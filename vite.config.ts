import { resolve } from 'node:path'
import process from 'node:process'
import vueI18n from '@intlify/unplugin-vue-i18n/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import pkg from './package.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    vue(),
    tailwindcss(),
    vueI18n({
      compositionOnly: true,
      include: resolve(__dirname, './src/locales/**'),
      strictMessage: false,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@features': resolve(__dirname, 'src/features'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@matrix': resolve(__dirname, 'src/matrix'),
      '@muon/enterprise-contracts': resolve(__dirname, 'packages/enterprise-contracts/src/index.ts'),
      '@muon/rich-text/editor': resolve(__dirname, 'packages/rich-text/src/editor/useRichTextEditor.ts'),
      '@muon/rich-text/html': resolve(__dirname, 'packages/rich-text/src/htmlSanitizer.ts'),
      '@muon/rich-text/linkify': resolve(__dirname, 'packages/rich-text/src/linkify.ts'),
      '@muon/rich-text/markdown': resolve(__dirname, 'packages/rich-text/src/markdown.ts'),
      '@muon/rich-text/message-content': resolve(__dirname, 'packages/rich-text/src/components/RichMessageContent.vue'),
      '@muon/rich-text': resolve(__dirname, 'packages/rich-text/src/index.ts'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'ELECTRON_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.ELECTRON_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.ELECTRON_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules'))
            return undefined
          if (id.includes('matrix-js-sdk'))
            return 'matrix-sdk'
          if (id.includes('@tiptap/'))
            return 'editor'
          if (id.includes('lottie-web'))
            return 'lottie'
          if (id.includes('plyr') || id.includes('viewerjs'))
            return 'media'
          return undefined
        },
      },
    },
  },
})
