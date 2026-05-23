# Desktop Monorepo Package Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Muon's Electron desktop app from the workspace root into `apps/desktop` as `@muon/desktop` while preserving existing root commands and desktop behavior.

**Architecture:** `apps/desktop` becomes the owner of the Electron main/preload code, Vue renderer, desktop configs, and the current root Vitest/Playwright suite. The root package becomes an orchestration layer that proxies desktop commands with `pnpm --filter @muon/desktop ...`. Renderer bridge wrappers are renamed from `src/electron/*` to `src/desktop/*`; the preload contract remains `window.muonDesktop`.

**Tech Stack:** pnpm workspaces, Electron, electron-vite, electron-builder, Vite, Vue 3, TypeScript, Vitest, Playwright.

---

## Execution Notes

The worktree is currently dirty. Implementation agents must not revert or overwrite unrelated user changes. Commit steps are included for agents running with explicit commit approval; if commit approval is not present, skip the commit command and report the changed files instead.

The current root `tests/` suite mixes desktop, enterprise, API, and Admin regression tests. This migration moves the suite mechanically into `apps/desktop/tests` to preserve existing coverage and root command behavior. Splitting API/Admin tests into their owning app packages is out of scope for this migration.

## File Structure

- Create: `apps/desktop/package.json` as the desktop app manifest and Electron Builder config owner.
- Create: `apps/desktop/tsconfig.node.json` for desktop Vite/Vitest/Playwright config type checks.
- Move: `src/` to `apps/desktop/src/`.
- Move: `electron/` to `apps/desktop/electron/`.
- Move: `tests/` to `apps/desktop/tests/`.
- Move: `index.html`, `vite.config.ts`, `electron.vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.electron.json`, and `components.json` to `apps/desktop/`.
- Modify: `apps/desktop/src/electron/*` becomes `apps/desktop/src/desktop/*`.
- Modify: root `package.json` to proxy desktop commands and keep only root tooling dependencies.
- Modify: root `scripts/dev-all.sh` to start `@muon/desktop` through pnpm filtering.
- Modify: root `scripts/seed-conduit.ts` to import local seed data from `apps/desktop/src/shared/data/localServiceMock`.
- Modify: root `README.md` to describe `apps/desktop`.
- Delete: root `tsconfig.node.json` after desktop config ownership is moved.

## Task 1: Add Migration Contract Test

**Files:**
- Create: `tests/unit/desktopMonorepoPackage.test.ts`

- [ ] **Step 1: Write the failing contract test**

Create `tests/unit/desktopMonorepoPackage.test.ts` with this content:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

interface PackageJson {
  build?: unknown
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  main?: string
  name?: string
  scripts?: Record<string, string>
}

function getRepoRoot(): string {
  const cwd = process.cwd()
  return cwd.endsWith(`${sep}apps${sep}desktop`) ? resolve(cwd, '../..') : cwd
}

const repoRoot = getRepoRoot()
const desktopRoot = resolve(repoRoot, 'apps/desktop')

function readRepoSource(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8')
}

function readDesktopSource(path: string): string {
  return readFileSync(resolve(desktopRoot, path), 'utf8')
}

function readRepoJson<T>(path: string): T {
  return JSON.parse(readRepoSource(path)) as T
}

function readDesktopJson<T>(path: string): T {
  return JSON.parse(readDesktopSource(path)) as T
}

function listFiles(root: string): string[] {
  if (!existsSync(root))
    return []

  const entries = readdirSync(root).filter(entry => !['.git', 'coverage', 'dist', 'node_modules', 'out'].includes(entry))
  return entries.flatMap((entry) => {
    const path = join(root, entry)
    if (statSync(path).isDirectory())
      return listFiles(path)
    return [path]
  })
}

function findFilesContaining(root: string, needle: string): string[] {
  return listFiles(root)
    .filter(path => /\.(ts|vue)$/.test(path))
    .filter(path => readFileSync(path, 'utf8').includes(needle))
    .map(path => path.slice(repoRoot.length + 1))
    .sort()
}

describe('desktop monorepo package migration', () => {
  it('moves the complete desktop app into apps/desktop while keeping root commands stable', () => {
    const rootPackage = readRepoJson<PackageJson>('package.json')
    const desktopPackage = readDesktopJson<PackageJson>('package.json')
    const devAll = readRepoSource('scripts/dev-all.sh')
    const componentsConfig = readDesktopJson<{ tailwind?: { css?: string } }>('components.json')

    expect(desktopPackage.name).toBe('@muon/desktop')
    expect(desktopPackage.main).toBe('out/main/main.cjs')
    expect(desktopPackage.scripts?.dev).toBe('electron-vite dev')
    expect(desktopPackage.scripts?.build).toBe('pnpm type-check && electron-vite build')
    expect(desktopPackage.scripts?.['build:web']).toBe('vue-tsc --noEmit && vite build')
    expect(desktopPackage.scripts?.dist).toBe('pnpm build && electron-builder')
    expect(desktopPackage.dependencies?.['@muon/ui']).toBe('workspace:*')
    expect(desktopPackage.dependencies?.['@muon/rich-text']).toBe('workspace:*')
    expect(desktopPackage.dependencies?.['@muon/enterprise-contracts']).toBe('workspace:*')

    expect(rootPackage.main).toBeUndefined()
    expect(rootPackage.build).toBeUndefined()
    expect(rootPackage.scripts?.['dev:desktop']).toBe('pnpm --filter @muon/desktop dev')
    expect(rootPackage.scripts?.['build:desktop']).toBe('pnpm --filter @muon/desktop build')
    expect(rootPackage.scripts?.['build:web']).toBe('pnpm --filter @muon/desktop build:web')
    expect(rootPackage.scripts?.package).toBe('pnpm --filter @muon/desktop package')
    expect(rootPackage.scripts?.dist).toBe('pnpm --filter @muon/desktop dist')
    expect(rootPackage.scripts?.['test:unit']).toBe('pnpm --filter @muon/desktop test:unit')
    expect(rootPackage.scripts?.['test:e2e']).toBe('pnpm --filter @muon/desktop test:e2e')
    expect(rootPackage.scripts?.['test:enterprise']).toBe('pnpm --filter @muon/desktop test:enterprise')

    expect(devAll).toContain('start "Electron desktop" pnpm --filter @muon/desktop dev')
    expect(devAll).not.toContain('pnpm exec electron-vite dev')
    expect(componentsConfig.tailwind?.css).toBe('src/app/main.css')

    expect(existsSync(resolve(desktopRoot, 'src/app/main.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'electron/main.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'electron/preload.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'index.html'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'electron.vite.config.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'vite.config.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'vitest.config.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'playwright.config.ts'))).toBe(true)
  })

  it('uses desktop capability imports in renderer and tests', () => {
    expect(existsSync(resolve(desktopRoot, 'src/desktop/bridge.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'src/electron'))).toBe(false)
    expect(findFilesContaining(resolve(desktopRoot, 'src'), '@/electron/')).toEqual([])
    expect(findFilesContaining(resolve(desktopRoot, 'tests'), '@/electron/')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/unit/desktopMonorepoPackage.test.ts
```

Expected: FAIL because `apps/desktop/package.json`, `apps/desktop/src`, `apps/desktop/electron`, and root command proxies do not exist yet.

- [ ] **Step 3: Commit the failing test if commit approval exists**

```bash
git add tests/unit/desktopMonorepoPackage.test.ts
git commit -m "test(desktop): define monorepo package migration contract"
```

## Task 2: Move Desktop Files Into `apps/desktop`

**Files:**
- Create: `apps/desktop/package.json`
- Move: `src/` to `apps/desktop/src/`
- Move: `electron/` to `apps/desktop/electron/`
- Move: `tests/` to `apps/desktop/tests/`
- Move: `index.html` to `apps/desktop/index.html`
- Move: `vite.config.ts` to `apps/desktop/vite.config.ts`
- Move: `electron.vite.config.ts` to `apps/desktop/electron.vite.config.ts`
- Move: `vitest.config.ts` to `apps/desktop/vitest.config.ts`
- Move: `playwright.config.ts` to `apps/desktop/playwright.config.ts`
- Move: `tsconfig.electron.json` to `apps/desktop/tsconfig.electron.json`
- Move: `components.json` to `apps/desktop/components.json`

- [ ] **Step 1: Create the desktop package directory**

Run:

```bash
mkdir -p apps/desktop
```

Expected: `apps/desktop` exists and is empty except for files created by Task 1 if the test was already moved by another agent.

- [ ] **Step 2: Move root desktop files**

Run:

```bash
git mv src apps/desktop/src
git mv electron apps/desktop/electron
git mv tests apps/desktop/tests
git mv index.html apps/desktop/index.html
git mv vite.config.ts apps/desktop/vite.config.ts
git mv electron.vite.config.ts apps/desktop/electron.vite.config.ts
git mv vitest.config.ts apps/desktop/vitest.config.ts
git mv playwright.config.ts apps/desktop/playwright.config.ts
git mv tsconfig.electron.json apps/desktop/tsconfig.electron.json
git mv components.json apps/desktop/components.json
```

Expected: the workspace root no longer has `src/`, `electron/`, root desktop configs, root `index.html`, or root `tests/`.

- [ ] **Step 3: Create `apps/desktop/package.json`**

Create `apps/desktop/package.json` with this content, using the same dependency versions currently present in root `package.json`:

```json
{
  "name": "@muon/desktop",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "description": "Muon desktop Matrix chat client",
  "main": "out/main/main.cjs",
  "scripts": {
    "dev": "electron-vite dev",
    "dev:web": "vite",
    "build": "pnpm type-check && electron-vite build",
    "build:web": "vue-tsc --noEmit && vite build",
    "preview": "electron-vite preview",
    "package": "pnpm build && electron-builder --dir",
    "dist": "pnpm build && electron-builder",
    "check": "pnpm lint && pnpm test:unit && pnpm build",
    "lint": "eslint .",
    "type-check": "vue-tsc --noEmit && tsc -p tsconfig.electron.json --noEmit && tsc -p tsconfig.node.json --noEmit",
    "test:enterprise": "vitest run tests/unit/enterprise tests/components/AdminApp.test.ts tests/components/LoginPage.enterprise.test.ts",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:unit:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test": "pnpm test:unit && pnpm test:e2e"
  },
  "build": {
    "appId": "com.muon.im",
    "productName": "Muon",
    "directories": {
      "output": "../../release"
    },
    "files": [
      "out/**/*",
      "package.json"
    ],
    "mac": {
      "icon": "../../build/icons/icon.icns",
      "target": [
        "dmg",
        "zip"
      ]
    },
    "win": {
      "icon": "../../build/icons/icon.ico",
      "target": [
        "nsis"
      ]
    },
    "linux": {
      "icon": "../../build/icons/png-set",
      "target": [
        "AppImage"
      ]
    }
  },
  "dependencies": {
    "@floating-ui/vue": "^1.1.11",
    "@intlify/unplugin-vue-i18n": "^11.1.2",
    "@muon/enterprise-contracts": "workspace:*",
    "@muon/rich-text": "workspace:*",
    "@muon/ui": "workspace:*",
    "@tailwindcss/vite": "^4.2.4",
    "@tanstack/vue-query": "^5.100.6",
    "@tanstack/vue-virtual": "^3.13.24",
    "@tiptap/core": "^3.22.5",
    "@tiptap/extension-code-block-lowlight": "3.22.5",
    "@tiptap/extension-collaboration": "3.22.5",
    "@tiptap/extension-collaboration-cursor": "3.0.0",
    "@tiptap/extension-image": "^3.22.5",
    "@tiptap/extension-link": "^3.22.5",
    "@tiptap/extension-mention": "^3.22.5",
    "@tiptap/extension-placeholder": "^3.22.5",
    "@tiptap/extension-table": "3.22.5",
    "@tiptap/extension-underline": "^3.22.5",
    "@tiptap/pm": "^3.22.5",
    "@tiptap/starter-kit": "^3.22.5",
    "@tiptap/suggestion": "^3.22.5",
    "@tiptap/vue-3": "^3.22.5",
    "@vueuse/core": "^14.2.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "dexie": "^4.4.2",
    "dompurify": "^3.4.1",
    "electron-updater": "^6.8.3",
    "livekit-client": "^2.18.8",
    "lottie-web": "^5.13.0",
    "lowlight": "^3.3.0",
    "lucide-vue-next": "^1.0.0",
    "marked": "^18.0.2",
    "matrix-js-sdk": "^41.4.0",
    "mitt": "^3.0.1",
    "nanoid": "^5.1.9",
    "pinia": "^3.0.4",
    "reka-ui": "^2.9.6",
    "tailwind-merge": "^3.5.0",
    "tailwindcss": "^4.2.4",
    "tw-animate-css": "^1.4.0",
    "vue": "^3.5.33",
    "vue-i18n": "^11.4.0",
    "vue-router": "^5.0.6",
    "vue-sonner": "^2.0.9",
    "yjs": "^13.6.30",
    "zod": "^4.4.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.59.1",
    "@types/node": "^25.6.0",
    "@vitejs/plugin-vue": "^6.0.6",
    "@vitest/coverage-v8": "^4.1.5",
    "@vue/test-utils": "^2.4.10",
    "electron": "^41.3.0",
    "electron-builder": "^26.8.1",
    "electron-vite": "^5.0.0",
    "jsdom": "^29.1.1",
    "msw": "^2.14.2",
    "typescript": "^6.0.3",
    "vite": "^8.0.10",
    "vitest": "^4.1.5",
    "vue-tsc": "^3.2.7"
  }
}
```

- [ ] **Step 4: Run the contract test to confirm only config/import assertions remain**

Run:

```bash
pnpm exec vitest run apps/desktop/tests/unit/desktopMonorepoPackage.test.ts
```

Expected: FAIL because root scripts still point at root Electron commands and `src/electron` has not been renamed to `src/desktop`.

- [ ] **Step 5: Commit the file move if commit approval exists**

```bash
git add -A src electron tests index.html vite.config.ts electron.vite.config.ts vitest.config.ts playwright.config.ts tsconfig.electron.json components.json apps/desktop
git commit -m "refactor(desktop): move app into workspace package"
```

## Task 3: Update Root Orchestration Files

**Files:**
- Modify: `package.json`
- Modify: `scripts/dev-all.sh`
- Modify: `scripts/seed-conduit.ts`
- Modify: `README.md`
- Delete: `tsconfig.node.json`

- [ ] **Step 1: Replace root desktop scripts with workspace proxies**

In root `package.json`, remove `main`, remove the top-level `build` Electron Builder config, remove root `dependencies`, and replace the `scripts` block with:

```json
{
  "dev": "bash scripts/dev-all.sh",
  "dev:desktop": "pnpm --filter @muon/desktop dev",
  "dev:web": "pnpm --filter @muon/desktop dev:web",
  "dev:api": "pnpm --filter @muon/api dev",
  "dev:admin": "pnpm --filter @muon/admin dev",
  "build": "pnpm build:contracts && pnpm build:rich-text && pnpm build:api && pnpm build:admin && pnpm build:desktop",
  "build:contracts": "pnpm --filter @muon/enterprise-contracts build",
  "build:rich-text": "pnpm --filter @muon/rich-text build",
  "build:api": "pnpm --filter @muon/api build",
  "build:desktop": "pnpm --filter @muon/desktop build",
  "build:web": "pnpm --filter @muon/desktop build:web",
  "build:admin": "pnpm --filter @muon/admin build",
  "preview": "pnpm --filter @muon/desktop preview",
  "package": "pnpm --filter @muon/desktop package",
  "dist": "pnpm --filter @muon/desktop dist",
  "check": "pnpm lint && pnpm test:unit && pnpm build",
  "lint": "eslint .",
  "type-check": "pnpm --filter @muon/desktop type-check",
  "services:up": "bash docker/start.sh",
  "services:seed": "tsx scripts/seed-conduit.ts",
  "services:down": "docker compose -f docker/docker-compose.yml down",
  "services:logs": "docker compose -f docker/docker-compose.yml logs -f",
  "test:enterprise": "pnpm --filter @muon/desktop test:enterprise",
  "test:unit": "pnpm --filter @muon/desktop test:unit",
  "test:unit:watch": "pnpm --filter @muon/desktop test:unit:watch",
  "test:unit:coverage": "pnpm --filter @muon/desktop test:unit:coverage",
  "test:e2e": "pnpm --filter @muon/desktop test:e2e",
  "test": "pnpm test:unit && pnpm test:e2e"
}
```

Keep root `devDependencies` limited to root tooling:

```json
{
  "@antfu/eslint-config": "^8.2.0",
  "eslint": "^10.2.1",
  "eslint-plugin-format": "^2.0.1",
  "tsx": "^4.21.0",
  "typescript": "^6.0.3"
}
```

- [ ] **Step 2: Update `scripts/dev-all.sh`**

Change the desktop start command to:

```bash
start "Electron desktop" pnpm --filter @muon/desktop dev
```

Keep the API and Admin start commands unchanged:

```bash
start "enterprise API" pnpm --filter @muon/api exec tsx src/server.ts
start "Admin Web" pnpm --filter @muon/admin exec vite --host 0.0.0.0 --port 4174
```

- [ ] **Step 3: Update root seed data imports**

In `scripts/seed-conduit.ts`, replace the first two imports with:

```ts
import type { LocalServiceChannel, LocalServiceMessage, LocalServiceSpace } from '../apps/desktop/src/shared/data/localServiceMock'
import process from 'node:process'
import { LOCAL_SERVICE_MOCK_DATA } from '../apps/desktop/src/shared/data/localServiceMock'
```

- [ ] **Step 4: Replace root `tsconfig.json`**

Replace root `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["scripts/**/*.ts"]
}
```

- [ ] **Step 5: Remove stale root node config**

Run:

```bash
git rm tsconfig.node.json
```

Expected: root no longer has a TypeScript config that references moved desktop Vite configs.

- [ ] **Step 6: Update README structure and brand references**

In `README.md`, update the brand asset and project structure lines to:

```md
- Workspace rail brand mark: `apps/desktop/src/app/components/workspace/WorkspaceAppRail.vue`
- Window title bar brand mark: `apps/desktop/src/app/components/window/WindowTitleBar.vue`
- Native desktop window controls: `apps/desktop/electron/main.ts`
```

Update the project structure block to include:

```text
├── apps/
│   ├── desktop/           # Electron desktop app: renderer, main/preload, tests
│   ├── api/               # Enterprise API service
│   └── admin/             # Admin Web console
├── packages/              # Shared workspace packages
├── public/                # Shared static brand assets, including the Muon logo
├── build/icons/           # Electron package icons
```

- [ ] **Step 7: Run the migration contract test**

Run:

```bash
pnpm --filter @muon/desktop exec vitest run tests/unit/desktopMonorepoPackage.test.ts
```

Expected: FAIL only on `@/electron` import assertions and config paths that are fixed in later tasks.

- [ ] **Step 8: Commit root orchestration changes if commit approval exists**

```bash
git add -A package.json scripts/dev-all.sh scripts/seed-conduit.ts README.md tsconfig.json tsconfig.node.json
git commit -m "refactor(root): proxy desktop commands to workspace package"
```

## Task 4: Repair Desktop Config Paths

**Files:**
- Modify: `apps/desktop/vite.config.ts`
- Modify: `apps/desktop/electron.vite.config.ts`
- Modify: `apps/desktop/vitest.config.ts`
- Modify: `apps/desktop/playwright.config.ts`
- Modify: `apps/desktop/tsconfig.json`
- Modify: `apps/desktop/tsconfig.electron.json`
- Create: `apps/desktop/tsconfig.node.json`

- [ ] **Step 1: Update `apps/desktop/vite.config.ts`**

Set `publicDir` and update workspace package aliases to point two levels up:

```ts
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
      '@muon/rich-text/message-content': resolve(__dirname, '../../packages/rich-text/src/components/RichMessageContent.vue'),
      '@muon/rich-text': resolve(__dirname, '../../packages/rich-text/src/index.ts'),
    },
  },
  clearScreen: false,
  optimizeDeps: {
    include: [
      'date-fns',
      'date-fns/locale',
    ],
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
          if (!id.includes('node_modules'))
            return undefined
          if (id.includes('matrix-js-sdk'))
            return 'matrix-sdk'
          if (id.includes('@tiptap/'))
            return 'editor'
          if (id.includes('lottie-web'))
            return 'lottie'
          if (id.includes('livekit-client'))
            return 'livekit'
          if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('vue-i18n') || id.includes('@vue'))
            return 'vendor'
          return undefined
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
```

- [ ] **Step 2: Update `apps/desktop/electron.vite.config.ts`**

Keep the existing manual chunk function and update renderer paths to include `publicDir` and workspace package aliases:

```ts
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
      '@muon/rich-text/message-content': resolve(__dirname, '../../packages/rich-text/src/components/RichMessageContent.vue'),
      '@muon/rich-text': resolve(__dirname, '../../packages/rich-text/src/index.ts'),
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
}
```

- [ ] **Step 3: Update `apps/desktop/vitest.config.ts`**

Replace the config with:

```ts
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        statements: 15,
        branches: 10,
        functions: 15,
        lines: 15,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@matrix': resolve(__dirname, 'src/matrix'),
      '@features': resolve(__dirname, 'src/features'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@muon/enterprise-contracts': resolve(__dirname, '../../packages/enterprise-contracts/src/index.ts'),
      '@muon/rich-text/editor': resolve(__dirname, '../../packages/rich-text/src/editor/useRichTextEditor.ts'),
      '@muon/rich-text/html': resolve(__dirname, '../../packages/rich-text/src/htmlSanitizer.ts'),
      '@muon/rich-text/linkify': resolve(__dirname, '../../packages/rich-text/src/linkify.ts'),
      '@muon/rich-text/markdown': resolve(__dirname, '../../packages/rich-text/src/markdown.ts'),
      '@muon/rich-text/message-content': resolve(__dirname, '../../packages/rich-text/src/components/RichMessageContent.vue'),
      '@muon/rich-text': resolve(__dirname, '../../packages/rich-text/src/index.ts'),
    },
  },
})
```

- [ ] **Step 4: Update `apps/desktop/playwright.config.ts`**

Change `testDir` and the web server command to package-local values:

```ts
testDir: './tests/e2e',
```

```ts
webServer: {
  command: 'pnpm dev:web',
  url: 'http://localhost:1420',
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
},
```

- [ ] **Step 5: Replace `apps/desktop/tsconfig.json`**

Replace the moved desktop `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"],
      "@features/*": ["./src/features/*"],
      "@shared/*": ["./src/shared/*"],
      "@matrix/*": ["./src/matrix/*"],
      "@muon/enterprise-contracts": ["../../packages/enterprise-contracts/src/index.ts"],
      "@muon/rich-text": ["../../packages/rich-text/src/index.ts"],
      "@muon/rich-text/editor": ["../../packages/rich-text/src/editor/useRichTextEditor.ts"],
      "@muon/rich-text/html": ["../../packages/rich-text/src/htmlSanitizer.ts"],
      "@muon/rich-text/linkify": ["../../packages/rich-text/src/linkify.ts"],
      "@muon/rich-text/markdown": ["../../packages/rich-text/src/markdown.ts"],
      "@muon/rich-text/message-content": ["../../packages/rich-text/src/components/RichMessageContent.vue"]
    },
    "resolveJsonModule": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

- [ ] **Step 6: Keep Electron TypeScript config package-local**

Verify `apps/desktop/tsconfig.electron.json` includes:

```json
{
  "include": ["electron/**/*.ts", "electron.vite.config.ts"]
}
```

- [ ] **Step 7: Create `apps/desktop/tsconfig.node.json`**

Create `apps/desktop/tsconfig.node.json` with:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "strict": true,
    "allowSyntheticDefaultImports": true,
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 8: Run config type checks**

Run:

```bash
pnpm --filter @muon/desktop type-check
```

Expected: FAIL until bridge imports and moved test imports are repaired in later tasks. Config resolution errors for `../../packages/*` should be gone.

- [ ] **Step 9: Commit config changes if commit approval exists**

```bash
git add apps/desktop/vite.config.ts apps/desktop/electron.vite.config.ts apps/desktop/vitest.config.ts apps/desktop/playwright.config.ts apps/desktop/tsconfig.json apps/desktop/tsconfig.electron.json apps/desktop/tsconfig.node.json
git commit -m "chore(desktop): retarget configs to package root"
```

## Task 5: Rename Renderer Bridge Wrappers To `src/desktop`

**Files:**
- Move: `apps/desktop/src/electron/` to `apps/desktop/src/desktop/`
- Modify: all `@/electron/*` imports in `apps/desktop/src/**/*.ts`, `apps/desktop/src/**/*.vue`, and `apps/desktop/tests/**/*.ts`
- Modify: `apps/desktop/tests/unit/windowTitleBarConfig.test.ts`
- Modify: `apps/desktop/tests/unit/desktopSettingsBridge.test.ts`
- Modify: `apps/desktop/tests/setup.ts`

- [ ] **Step 1: Move the renderer bridge directory**

Run:

```bash
git mv apps/desktop/src/electron apps/desktop/src/desktop
```

Expected: `apps/desktop/src/desktop/bridge.ts`, `dialog.ts`, `fs.ts`, `http.ts`, `opener.ts`, `screenshot.ts`, `updater.ts`, `window.ts`, and `app.ts` exist.

- [ ] **Step 2: Replace source imports**

Replace every `@/electron/` import in `apps/desktop/src` with `@/desktop/`. For example:

```ts
import { getDesktopBridge, isElectronRuntime } from '@/desktop/bridge'
import { fetch as desktopFetch } from '@/desktop/http'
import { ask } from '@/desktop/dialog'
```

Run this search to confirm the source side is clean:

```bash
rg "@/electron/" apps/desktop/src
```

Expected: no matches.

- [ ] **Step 3: Replace test mocks and imports**

Replace every `@/electron/` import or mock path in `apps/desktop/tests` with `@/desktop/`. Examples:

```ts
vi.mock('@/desktop/dialog', () => ({
  ask: vi.fn(),
}))
```

```ts
vi.mock('@/desktop/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    show: vi.fn(),
    setFocus: vi.fn(),
    hide: vi.fn(),
  })),
}))
```

Run this search to confirm the test side is clean:

```bash
rg "@/electron/" apps/desktop/tests
```

Expected: no matches.

- [ ] **Step 4: Update source-reading test paths**

In `apps/desktop/tests/unit/windowTitleBarConfig.test.ts`, change:

```ts
const rendererSource = readSource('src/electron/window.ts')
```

to:

```ts
const rendererSource = readSource('src/desktop/window.ts')
```

In `apps/desktop/tests/unit/desktopSettingsBridge.test.ts`, change:

```ts
const bridge = readSource('src/electron/bridge.ts')
```

to:

```ts
const bridge = readSource('src/desktop/bridge.ts')
```

- [ ] **Step 5: Run the contract test**

Run:

```bash
pnpm --filter @muon/desktop exec vitest run tests/unit/desktopMonorepoPackage.test.ts
```

Expected: PASS for the `uses desktop capability imports` test.

- [ ] **Step 6: Commit bridge rename if commit approval exists**

```bash
git add apps/desktop/src apps/desktop/tests
git commit -m "refactor(desktop): rename renderer bridge wrappers"
```

## Task 6: Repair Electron Main Runtime Paths

**Files:**
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/tests/unit/electronIconAssets.test.ts`

- [ ] **Step 1: Update development icon path resolution**

In `apps/desktop/electron/main.ts`, replace `getDevelopmentAppIconPath` with:

```ts
function getWorkspaceRoot(): string {
  return join(__dirname, '..', '..', '..', '..')
}

function getDevelopmentAppIconPath(): string {
  const iconRoot = join(getWorkspaceRoot(), 'build', 'icons')
  if (process.platform === 'win32')
    return join(iconRoot, 'icon.ico')

  return join(iconRoot, 'png-set', 'icon.png')
}
```

Keep `getRendererEntry()` and `getPreloadEntry()` unchanged because the electron-vite output structure remains `out/main`, `out/preload`, and `out/renderer` inside `apps/desktop`.

- [ ] **Step 2: Update icon asset source test expectations**

In `apps/desktop/tests/unit/electronIconAssets.test.ts`, read package-local `package.json` and repository-root icons separately:

```ts
function readDesktopSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function readRepoSource(path: string): string {
  return readFileSync(resolve(process.cwd(), '../..', path), 'utf8')
}
```

Change icon reads to:

```ts
expect(readRepoSource('build/icons/icon.icns').length).toBeGreaterThan(0)
expect(readRepoSource('build/icons/icon.ico').length).toBeGreaterThan(0)
expect(packageJson).toContain('"icon": "../../build/icons/icon.icns"')
expect(packageJson).toContain('"icon": "../../build/icons/icon.ico"')
```

Change the png-set directory to:

```ts
const iconDir = resolve(process.cwd(), '../..', 'build/icons/png-set')
```

- [ ] **Step 3: Run focused Electron asset tests**

Run:

```bash
pnpm --filter @muon/desktop exec vitest run tests/unit/electronIconAssets.test.ts tests/unit/windowTitleBarConfig.test.ts
```

Expected: PASS after package paths and source reads are corrected.

- [ ] **Step 4: Commit runtime path fix if commit approval exists**

```bash
git add apps/desktop/electron/main.ts apps/desktop/tests/unit/electronIconAssets.test.ts apps/desktop/tests/unit/windowTitleBarConfig.test.ts
git commit -m "fix(desktop): resolve root assets from package runtime"
```

## Task 7: Repair Moved Test Path Helpers And Cross-App Imports

**Files:**
- Create: `apps/desktop/tests/helpers/paths.ts`
- Modify: source-reading tests under `apps/desktop/tests/unit/`
- Modify: Admin/API relative imports under `apps/desktop/tests/`

- [ ] **Step 1: Create shared test path helpers**

Create `apps/desktop/tests/helpers/paths.ts` with:

```ts
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const helpersDir = dirname(fileURLToPath(import.meta.url))

export const desktopRoot = resolve(helpersDir, '..', '..')
export const repoRoot = resolve(desktopRoot, '..', '..')

export function readDesktopSource(path: string): string {
  return readFileSync(resolve(desktopRoot, path), 'utf8')
}

export function readRepoSource(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8')
}

export function readDesktopJson<T = unknown>(path: string): T {
  return JSON.parse(readDesktopSource(path)) as T
}

export function readRepoJson<T = unknown>(path: string): T {
  return JSON.parse(readRepoSource(path)) as T
}
```

- [ ] **Step 2: Update desktop source-reading tests to use desktop helpers**

In these files, replace local `readSource` or `readJson` helpers with imports from `../helpers/paths` or `../../helpers/paths`:

```ts
import { readDesktopJson, readDesktopSource, readRepoJson, readRepoSource } from '../helpers/paths'
```

For tests under `apps/desktop/tests/unit/styles`, use:

```ts
import { readDesktopSource } from '../../helpers/paths'
```

Update these files to read desktop paths with `readDesktopSource` and root paths with `readRepoSource`:

```text
apps/desktop/tests/unit/viteConfig.test.ts
apps/desktop/tests/unit/windowTitleBarConfig.test.ts
apps/desktop/tests/unit/desktopSettingsBridge.test.ts
apps/desktop/tests/unit/electronSecurityConfig.test.ts
apps/desktop/tests/unit/electronIconAssets.test.ts
apps/desktop/tests/unit/windowFrameStyle.test.ts
apps/desktop/tests/unit/styles/listMarkers.test.ts
```

- [ ] **Step 3: Update root-oriented source-reading tests to use repo helpers**

Update these files to use `readRepoSource` and `readRepoJson` for root package, Admin, API, package, script, docker, and icon reads:

```text
apps/desktop/tests/unit/monorepoScripts.test.ts
apps/desktop/tests/unit/adminRouter.test.ts
apps/desktop/tests/unit/styles/adminStyles.test.ts
```

For `apps/desktop/tests/unit/monorepoScripts.test.ts`, change the desktop command expectation to:

```ts
expect(devAll).toContain('pnpm --filter @muon/desktop dev')
expect(devAll).not.toContain('pnpm exec electron-vite dev')
expect(devAll).not.toContain('start "Electron desktop" pnpm dev:desktop')
```

- [ ] **Step 4: Update API relative imports in enterprise tests**

In `apps/desktop/tests/unit/enterprise/*.test.ts`, replace:

```ts
../../../apps/api/src/
```

with:

```ts
../../../../api/src/
```

- [ ] **Step 5: Update Admin relative imports and mocks**

In `apps/desktop/tests/components/AdminApp.test.ts`, replace:

```ts
../../apps/admin/src/
```

with:

```ts
../../../admin/src/
```

In `apps/desktop/tests/unit/adminRouter.test.ts`, replace:

```ts
../../apps/admin/src/
```

with:

```ts
../../../admin/src/
```

- [ ] **Step 6: Run path-sensitive tests**

Run:

```bash
pnpm --filter @muon/desktop exec vitest run tests/unit/desktopMonorepoPackage.test.ts tests/unit/viteConfig.test.ts tests/unit/monorepoScripts.test.ts tests/unit/adminRouter.test.ts tests/unit/styles/adminStyles.test.ts tests/unit/electronSecurityConfig.test.ts tests/unit/electronIconAssets.test.ts tests/unit/windowFrameStyle.test.ts tests/unit/styles/listMarkers.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit test path repairs if commit approval exists**

```bash
git add apps/desktop/tests
git commit -m "test(desktop): repair moved suite paths"
```

## Task 8: Update Lockfile And Verify Workspace Filtering

**Files:**
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Refresh pnpm lockfile importers**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` gains an `apps/desktop` importer and the root importer no longer owns desktop runtime dependencies.

- [ ] **Step 2: Verify root and desktop package manifests through pnpm**

Run:

```bash
pnpm --filter @muon/desktop exec electron-vite --version
```

Expected: command prints the installed `electron-vite` version.

Run:

```bash
pnpm dev:desktop -- --help
```

Expected: command reaches the `@muon/desktop` `electron-vite dev` help output or exits after printing electron-vite dev usage. Stop the command if it starts a dev server.

- [ ] **Step 3: Run migration contract test**

Run:

```bash
pnpm --filter @muon/desktop exec vitest run tests/unit/desktopMonorepoPackage.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit lockfile update if commit approval exists**

```bash
git add pnpm-lock.yaml package.json apps/desktop/package.json
git commit -m "chore(workspace): register desktop package dependencies"
```

## Task 9: Focused Desktop Verification

**Files:**
- Modify files identified by verification failures.

- [ ] **Step 1: Run desktop type checking**

Run:

```bash
pnpm type-check
```

Expected: PASS. If it fails, fix only path, alias, package ownership, or type-config errors caused by the migration.

- [ ] **Step 2: Run desktop unit tests**

Run:

```bash
pnpm test:unit
```

Expected: PASS. If it fails, fix only moved-path imports, mocks, or source-reading helpers caused by the migration.

- [ ] **Step 3: Run desktop build**

Run:

```bash
pnpm build:desktop
```

Expected: PASS and produces `apps/desktop/out`.

- [ ] **Step 4: Run package dry build**

Run:

```bash
pnpm package
```

Expected: PASS and produces an unpacked Electron package under root `release/` through `apps/desktop`'s Electron Builder config.

- [ ] **Step 5: Commit verification fixes if commit approval exists**

```bash
git add apps/desktop package.json pnpm-lock.yaml scripts README.md
git commit -m "fix(desktop): complete package migration verification"
```

## Task 10: Full Workspace Regression Verification

**Files:**
- Modify files identified by verification failures.

- [ ] **Step 1: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS. If it fails on generated output, update root `eslint.config.js` ignores for `apps/desktop/out/**` and `apps/desktop/dist/**`:

```js
'apps/desktop/out/**',
'apps/desktop/dist/**',
```

- [ ] **Step 2: Run full workspace build**

Run:

```bash
pnpm build
```

Expected: PASS. This covers contracts, rich text, API, Admin Web, and Desktop.

- [ ] **Step 3: Run e2e only if Playwright config was not proven by unit tests**

Run:

```bash
pnpm test:e2e
```

Expected: PASS or known environment-related service/browser failure. Record the exact failure if the local environment cannot run Playwright.

- [ ] **Step 4: Run final migration source search**

Run:

```bash
rg "@/electron/|src/electron|electron.vite.config.ts|playwright.config.ts|vitest.config.ts" . --glob '!docs/superpowers/**' --glob '!node_modules/**' --glob '!apps/desktop/out/**'
```

Expected: no stale `@/electron/` or `src/electron` references outside historical docs. Config filename references are allowed only when they point to `apps/desktop/...` or package-local files.

- [ ] **Step 5: Commit final fixes if commit approval exists**

```bash
git add -A apps/desktop package.json pnpm-lock.yaml scripts/dev-all.sh scripts/seed-conduit.ts README.md tsconfig.json tsconfig.node.json eslint.config.js
git commit -m "chore(desktop): verify monorepo package migration"
```
