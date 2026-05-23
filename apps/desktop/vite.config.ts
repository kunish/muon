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
  publicDir: resolve(__dirname, '../../public'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@features': resolve(__dirname, 'src/features'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@matrix': resolve(__dirname, 'src/matrix'),
      '@muon/enterprise-contracts': resolve(__dirname, '../../packages/enterprise-contracts/src/index.ts'),
      '@muon/rich-text/editor': resolve(__dirname, '../../packages/rich-text/src/editor/useRichTextEditor.ts'),
      '@muon/rich-text/html': resolve(__dirname, '../../packages/rich-text/src/htmlSanitizer.ts'),
      '@muon/rich-text/linkify': resolve(__dirname, '../../packages/rich-text/src/linkify.ts'),
      '@muon/rich-text/markdown': resolve(__dirname, '../../packages/rich-text/src/markdown.ts'),
      '@muon/rich-text/message-content': resolve(
        __dirname,
        '../../packages/rich-text/src/components/RichMessageContent.vue',
      ),
      '@muon/rich-text': resolve(__dirname, '../../packages/rich-text/src/index.ts'),
    },
  },
  clearScreen: false,
  optimizeDeps: {
    include: ['date-fns', 'date-fns/locale'],
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'ELECTRON_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.ELECTRON_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.ELECTRON_DEBUG,
    cssMinify: !process.env.ELECTRON_DEBUG,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1400,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // 大体积 SDK 独立分块，利用浏览器并行加载 + 长效缓存
          if (id.includes('matrix-js-sdk')) return 'matrix-sdk'
          if (id.includes('@tiptap/')) return 'editor'
          if (id.includes('lottie-web')) return 'lottie'
          if (id.includes('livekit-client')) return 'livekit'
          // 框架运行时合并为 vendor chunk（vue, pinia, vue-router, vue-i18n）
          if (
            id.includes('vue') ||
            id.includes('pinia') ||
            id.includes('vue-router') ||
            id.includes('vue-i18n') ||
            id.includes('@vue')
          )
            return 'vendor'
          return undefined
        },
        // 稳定 chunk hash，跨构建缓存友好
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
