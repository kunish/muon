import { resolve } from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

const srcDir = resolve(__dirname, '../src')

/**
 * Auto-import for framework APIs (`ref`, `computed`, `useRouter`, `useI18n`, `@vueuse/core`).
 * Shared by the electron-vite renderer config and the web-dev vite config so both
 * build pipelines resolve the same generated `auto-imports.d.ts` / eslint globals.
 */
export function autoImportPlugin() {
  return AutoImport({
    imports: ['vue', 'vue-router', 'vue-i18n', '@vueuse/core'],
    dts: resolve(srcDir, 'auto-imports.d.ts'),
    eslintrc: {
      enabled: true,
      filepath: resolve(__dirname, '../.eslintrc-auto-import.json'),
    },
  })
}

/**
 * Auto-register only the globally shared components (`src/shared/components`,
 * `src/app/components`). Feature-local components keep explicit imports to avoid
 * cross-feature name collisions; revisit with `directoryAsNamespace` if expanded.
 */
export function componentsPlugin() {
  return Components({
    dirs: [resolve(srcDir, 'shared/components'), resolve(srcDir, 'app/components')],
    dts: resolve(srcDir, 'components.d.ts'),
  })
}
