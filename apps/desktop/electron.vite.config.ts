import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import vueI18n from '@intlify/unplugin-vue-i18n/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'electron-vite'
import { autoImportPlugin, componentsPlugin, vueRouterPlugin } from './config/unplugins.js'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string }

function rendererManualChunks(id: string): string | undefined {
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
}

export default defineConfig({
  main: {
    ssr: {
      external: ['electron', 'electron-updater'],
    },
    build: {
      externalizeDeps: {
        include: ['electron-updater'],
      },
      lib: {
        entry: resolve(__dirname, 'electron/main.ts'),
        formats: ['cjs'],
      },
      rollupOptions: {
        external: ['electron', /^electron\/.+/, 'electron-updater'],
        output: {
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  preload: {
    ssr: {
      external: ['electron'],
    },
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/preload.ts'),
        formats: ['cjs'],
      },
      rollupOptions: {
        external: ['electron', /^electron\/.+/],
        output: {
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    clearScreen: false,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    envDir: resolve(__dirname, '../..'),
    plugins: [
      vueRouterPlugin(),
      vue(),
      autoImportPlugin(),
      componentsPlugin(),
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
        '@matrix': resolve(__dirname, 'src/matrix'),
        '@shared': resolve(__dirname, 'src/shared'),
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
    root: '.',
    server: {
      port: 1420,
      strictPort: true,
    },
    build: {
      target: 'chrome100',
      chunkSizeWarningLimit: 1400,
      minify: !process.env.ELECTRON_DEBUG ? 'esbuild' : false,
      cssMinify: !process.env.ELECTRON_DEBUG,
      cssCodeSplit: true,
      reportCompressedSize: false,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        output: {
          manualChunks: rendererManualChunks,
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      sourcemap: !!process.env.ELECTRON_DEBUG,
    },
  },
})
