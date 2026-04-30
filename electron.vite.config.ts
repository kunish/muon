import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import vueI18n from '@intlify/unplugin-vue-i18n/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'electron-vite'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string }

function rendererManualChunks(id: string): string | undefined {
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
        '@matrix': resolve(__dirname, 'src/matrix'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    root: '.',
    server: {
      port: 1420,
      strictPort: true,
    },
    build: {
      chunkSizeWarningLimit: 1400,
      minify: !process.env.ELECTRON_DEBUG ? 'esbuild' : false,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        output: {
          manualChunks: rendererManualChunks,
        },
      },
      sourcemap: !!process.env.ELECTRON_DEBUG,
    },
  },
})
