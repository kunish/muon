import { resolve } from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'

const srcDir = resolve(__dirname, '../src')

/**
 * File-based routing: scans `src/pages` and exposes the generated route table via
 * the `vue-router/auto-routes` virtual module (consumed by `src/app/router`).
 * MUST be registered before `@vitejs/plugin-vue` so it can transform page SFCs.
 * Shared across the electron-vite renderer, web vite and vitest configs.
 */
export function vueRouterPlugin() {
  return VueRouter({
    routesFolder: resolve(srcDir, 'pages'),
    dts: resolve(srcDir, 'typed-router.d.ts'),
    extensions: ['.vue'],
    importMode: 'async',
  })
}

/**
 * Auto-import for framework APIs (`ref`, `computed`, `useRouter`, `useI18n`, `@vueuse/core`).
 * Shared by the electron-vite renderer config and the web-dev vite config so both
 * build pipelines resolve the same generated `auto-imports.d.ts` / eslint globals.
 */
export function autoImportPlugin() {
  return AutoImport({
    // `VueRouterAutoImports` (not the plain 'vue-router' preset) pulls the typed
    // `useRoute`/`useRouter`/`definePage` from unplugin-vue-router's generated module.
    imports: ['vue', VueRouterAutoImports, 'vue-i18n', '@vueuse/core'],
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
