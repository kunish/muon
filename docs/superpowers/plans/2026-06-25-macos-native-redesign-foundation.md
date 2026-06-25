# macOS 原生改版 · 基座 + 聊天试点 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把全 app 的视觉语言从飞书克隆改为 macOS 原生质感的「基座」——重定向设计 token、建原生窗口外壳（vibrancy + 安静标题栏 + 跟随系统亮暗/强调色 + 无启动闪白），并把「聊天」改成完整 macOS 参考实现，由验收门 G1–G5 把关。

**Architecture:** 主杠杆是 `packages/ui` 的 Tailwind v4 `@theme` token 级联（改 token 值 → 两个 app 自动回流）。结构改动只在少数热点：把 Electron 窗口选项抽成纯函数 `buildMainWindowOptions` 使其可单测；新增 `nativeTheme`/系统强调色 IPC 桥；聊天气泡硬编码换成 token。本计划只覆盖基座 + 聊天试点；Wave 2-4 铺开等 G1–G5 通过后另行成计划。

**Tech Stack:** Electron（纯 Electron，非 electrobun）、Vue 3 `<script setup>`、Tailwind v4（CSS-first `@theme`，无 JS config）、`@tanstack/vue-store`（无 Pinia）、`@vue/test-utils` + Vitest（jsdom）、Playwright（仅 `packages/ui` 做 Storybook 视觉快照）。

## Global Constraints

- **Monorepo / 包过滤**：pnpm workspace。单测命令一律带 `--filter`：`pnpm --filter @muon/desktop ...`、`pnpm --filter @muon/ui ...`。
- **Token 单一源**：所有设计 token 只在 `packages/ui/src/tokens/*.css` 的 `@theme` 块；改值经 CSS 变量级联到 desktop/admin，**禁止**在组件里硬编码颜色/圆角绕过 token。
- **check:tokens 必须通过**：`pnpm --filter @muon/ui check:tokens`。它强制：22 个必备 `--color-*` 角色存在；**每个 `--color-*`（light）必须在 `.dark{}` 有同名 `<name>:` 覆盖**，否则 `Missing dark override` 报错退出 1。新增任何 `--color-*` 必须同时加暗色对。
- **平台分支不回退**：所有 macOS 改动按 `process.platform === 'darwin'`（主进程）或渲染层 `isMac` 分支，**不得**破坏 Windows/Linux 既有行为。
- **跟随系统**：外观默认 `system`（已是默认）；强调色跟随系统，读不到时回退 macOS 蓝 `#007aff`（dark `#0a84ff`）。
- **既有默认值已就位**（勿重复改）：`settingsStore` 中 `theme` 默认 `'system'`、`messageAlignment` 默认 `'leftright'`（`apps/desktop/src/shared/stores/settingsStore.ts:103,112`）。
- **主进程无行为测试**：现有为源码文本守卫（`tests/unit/*.test.ts` 读源码字符串断言）。本计划把窗口配置/主题桥的纯逻辑抽成可单测模块（`import type` 引 electron 类型，运行时不引 electron），放 `tests/unit/`。
- **CI 范围**：CI 只跑 `format:check`/`lint`/`type-check`/`test:unit:coverage`/`test:e2e`/`build`。`check:tokens` 与 `test:visual` 不在 CI——本计划显式手动运行它们。
- **提交**：每个任务末尾提交；`pre-commit` 的 `oxfmt` 对纯 `.md` 提交会报错，**仅当某次提交只含 `.md`** 时加 `--no-verify`；含代码的提交正常走钩子。

---

### Task 1: macOS 强调色 token + 品牌蓝重定向

把 `--color-primary` 等「应跟随强调色」的角色改为 `var(--system-accent, var(--B500))`，并把品牌蓝 `--B500` 从飞书蓝 `#3370ff` 重定向到 macOS 蓝。`--system-accent` 由 Task 4 在运行时注入；本任务只让 token 引用它并提供回退。

**Files:**
- Modify: `packages/ui/src/tokens/colors.css`（light `@theme` 内 `--B500`/`--B600`、`--color-*` 角色；`.dark{}` 内对应项）

**Interfaces:**
- Produces: `--color-primary`/`--color-ring`/`--color-info`/`--color-secondary`/`--color-sidebar-primary`/`--color-sidebar-ring`/`--color-list-item-active-rail`/`--color-chart-1` 解析为 `var(--system-accent, var(--B500))`；`--B500` 现为 macOS 蓝。后续任务依赖 `--color-primary` 跟随强调色。

- [ ] **Step 1: 重定向品牌蓝（light）**

`colors.css` light `@theme` 原始调色板（约 14 行）：
```css
  --B500: #3370ff;    --B500-raw: 51, 112, 255;   /* PRIMARY BRAND */
  --B600: #245bdb;    --B600-raw: 36, 91, 219;
```
改为 macOS systemBlue：
```css
  --B500: #007aff;    --B500-raw: 0, 122, 255;   /* PRIMARY BRAND — macOS systemBlue */
  --B600: #0067d6;    --B600-raw: 0, 103, 214;
```

- [ ] **Step 2: 重定向品牌蓝（dark）**

`.dark{}` 块（约 429 行）原 `--B500: #4c88ff`：把暗色品牌蓝改为 macOS 暗色 systemBlue：
```css
  --B500: #0a84ff;    --B500-raw: 10, 132, 255;
  --B600: #409cff;    --B600-raw: 64, 156, 255;
```

- [ ] **Step 3: 让强调色角色跟随系统（light）**

在 light `--color-*` 兼容层（约 300–337 行）把这些行改为带 `--system-accent` 回退（其余 `--color-*` 不动）：
```css
--color-primary: var(--system-accent, var(--B500));
--color-secondary: var(--system-accent, var(--B500));
--color-ring: var(--system-accent, var(--B500));
--color-info: var(--system-accent, var(--B500));
--color-sidebar-primary: var(--system-accent, var(--B500));
--color-sidebar-ring: var(--system-accent, var(--B500));
--color-sidebar-accent-foreground: var(--N900);
--color-list-item-active-rail: var(--system-accent, var(--B500));
--color-chart-1: var(--system-accent, var(--B500));
```

- [ ] **Step 4: 同步暗色（dark）**

在 `.dark{}` 的 `--color-*` 覆盖（约 554–598 行）把同名项改成相同的 `var(--system-accent, var(--B500))`（dark 下 `--B500` 已是 `#0a84ff`）：
```css
--color-primary: var(--system-accent, var(--B500));
--color-secondary: var(--system-accent, var(--B500));
--color-ring: var(--system-accent, var(--B500));
--color-info: var(--system-accent, var(--B500));
--color-sidebar-primary: var(--system-accent, var(--B500));
--color-sidebar-ring: var(--system-accent, var(--B500));
--color-list-item-active-rail: var(--system-accent, var(--B500));
--color-chart-1: var(--system-accent, var(--B500));
```

- [ ] **Step 5: 跑 token 完整性检查**

Run: `pnpm --filter @muon/ui check:tokens`
Expected: 打印 `Token completeness check PASSED`，退出 0。（22 角色仍在；每个 `--color-*` 仍有 light/dark 对。）

- [ ] **Step 6: 提交**

```bash
git add packages/ui/src/tokens/colors.css
git commit -m "feat(ui): retarget brand blue to macOS systemBlue + follow system accent"
```

---

### Task 2: 气泡颜色 token + macOS 圆角 token（真实红→绿）

新增 iMessage 气泡所需的 `--color-bubble-*`（own=强调色、other=macOS 系统灰）与 macOS 圆角档。先只加 light 触发 `check:tokens` 失败，再补 dark 转绿——验证 CI 守卫真的在把关。

**Files:**
- Modify: `packages/ui/src/tokens/colors.css`（light + dark 各加 4 个 `--color-bubble-*`）
- Modify: `packages/ui/src/tokens/radius.css`（加 `--radius-bubble`、`--radius-window`）

**Interfaces:**
- Produces: `--color-bubble-own-bg`、`--color-bubble-own-fg`、`--color-bubble-other-bg`、`--color-bubble-other-fg`、`--radius-bubble`、`--radius-window`。Task 8 的 `ChatMessage.vue` 消费它们。

- [ ] **Step 1: 只加 light 气泡 token（故意制造失败）**

在 `colors.css` light `--color-*` 兼容层末尾（分子级别 alias 之后，约 345 行后）加：
```css
/* macOS iMessage bubbles */
--color-bubble-own-bg: var(--color-primary);
--color-bubble-own-fg: #ffffff;
--color-bubble-other-bg: #e9e9eb;
--color-bubble-other-fg: var(--color-foreground);
```

- [ ] **Step 2: 跑检查，确认失败（红）**

Run: `pnpm --filter @muon/ui check:tokens`
Expected: FAIL，退出 1，输出含 `Missing dark override: --color-bubble-own-bg`（及其余三个）。

- [ ] **Step 3: 补 dark 气泡 token（转绿）**

在 `.dark{}` 的分子 `--color-*` 覆盖之后（约 598 行后）加：
```css
/* macOS iMessage bubbles — dark */
--color-bubble-own-bg: var(--color-primary);
--color-bubble-own-fg: #ffffff;
--color-bubble-other-bg: #3b3b3d;
--color-bubble-other-fg: var(--color-foreground);
```

- [ ] **Step 4: 跑检查，确认通过（绿）**

Run: `pnpm --filter @muon/ui check:tokens`
Expected: `Token completeness check PASSED`，退出 0。

- [ ] **Step 5: 加 macOS 圆角 token**

`radius.css` 的 `@theme` 块内，`--radius: var(--radius-md);` 之前加：
```css
  --radius-bubble: 1.125rem; /* 18px — iMessage 气泡 */
  --radius-window: 0.625rem; /* 10px — 原生窗口圆角 */
```

- [ ] **Step 6: 提交**

```bash
git add packages/ui/src/tokens/colors.css packages/ui/src/tokens/radius.css
git commit -m "feat(ui): add macOS bubble color tokens + bubble/window radius tokens"
```

---

### Task 3: 抽出 `buildMainWindowOptions` 纯函数（可单测）并接入 main.ts

把 `createMainWindow()` 里写死的 BrowserWindow 选项抽成按平台/主题分支的纯函数，配真实单测（darwin → `hiddenInset` + vibrancy + 去掉 WCO overlay；非 mac → 保持现状）。这把「源码文本守卫」升级成行为测试。

**Files:**
- Create: `apps/desktop/electron/windowOptions.ts`
- Create: `apps/desktop/tests/unit/windowOptions.test.ts`
- Modify: `apps/desktop/electron/main.ts`（`createMainWindow()` 约 511–535 行的选项对象）
- Modify: `apps/desktop/tests/unit/windowTitleBarConfig.test.ts`（旧的窗口 chrome 断言已移动，改为断言 main.ts 调用了 builder）

**Interfaces:**
- Produces: `buildMainWindowOptions(input: { platform: NodeJS.Platform; dark: boolean; accentHex: string | null }): Partial<BrowserWindowConstructorOptions>` —— 返回平台相关的 chrome 字段（`titleBarStyle`/`titleBarOverlay`/`trafficLightPosition`/`vibrancy`/`visualEffectState`/`backgroundColor`/`roundedCorners`）。
- Consumes（Task 5/6）：`dark` 来自 boot 解析；`accentHex` 来自 Task 4 桥（本任务可先传 `null`）。

- [ ] **Step 1: 写失败测试**

Create `apps/desktop/tests/unit/windowOptions.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildMainWindowOptions } from '../../electron/windowOptions'

describe('buildMainWindowOptions', () => {
  it('darwin: uses hiddenInset, vibrancy sidebar, no WCO overlay', () => {
    const o = buildMainWindowOptions({ platform: 'darwin', dark: false, accentHex: null })
    expect(o.titleBarStyle).toBe('hiddenInset')
    expect(o.vibrancy).toBe('sidebar')
    expect(o.visualEffectState).toBe('active')
    expect(o.roundedCorners).toBe(true)
    expect(o.titleBarOverlay).toBeUndefined() // WCO overlay is a no-op on mac
  })

  it('darwin: backgroundColor follows theme (no white flash in dark)', () => {
    expect(buildMainWindowOptions({ platform: 'darwin', dark: true, accentHex: null }).backgroundColor).toBe('#1a1a1a')
    expect(buildMainWindowOptions({ platform: 'darwin', dark: false, accentHex: null }).backgroundColor).toBe('#ffffff')
  })

  it('win32: keeps the WCO titlebar overlay + hidden style, no vibrancy', () => {
    const o = buildMainWindowOptions({ platform: 'win32', dark: false, accentHex: null })
    expect(o.titleBarStyle).toBe('hidden')
    expect(o.titleBarOverlay).toEqual({ color: '#00000000', height: 36 })
    expect(o.vibrancy).toBeUndefined()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @muon/desktop exec vitest run tests/unit/windowOptions.test.ts`
Expected: FAIL，`Cannot find module '../../electron/windowOptions'`。

- [ ] **Step 3: 实现纯函数**

Create `apps/desktop/electron/windowOptions.ts`:
```ts
import type { BrowserWindowConstructorOptions } from 'electron'

export interface MainWindowChromeInput {
  platform: NodeJS.Platform
  dark: boolean
  accentHex: string | null
}

const DARK_BG = '#1a1a1a'
const LIGHT_BG = '#ffffff'

// Platform-branched window chrome. macOS gets native hiddenInset + vibrancy;
// Windows/Linux keep the existing WCO titlebar-overlay posture untouched.
export function buildMainWindowOptions(input: MainWindowChromeInput): Partial<BrowserWindowConstructorOptions> {
  const backgroundColor = input.dark ? DARK_BG : LIGHT_BG

  if (input.platform === 'darwin') {
    return {
      backgroundColor,
      roundedCorners: true,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 12 },
      vibrancy: 'sidebar',
      visualEffectState: 'active',
    }
  }

  return {
    backgroundColor,
    titleBarOverlay: { color: '#00000000', height: 36 },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 12 },
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @muon/desktop exec vitest run tests/unit/windowOptions.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 接入 `createMainWindow()`**

`apps/desktop/electron/main.ts` 顶部 import 加：
```ts
import { buildMainWindowOptions } from './windowOptions.js'
```
把 `mainWindow = new BrowserWindow({ ... })`（约 511–535 行）里写死的 `backgroundColor / titleBarOverlay / titleBarStyle / trafficLightPosition` 四个字段删掉，改为 spread builder（`dark` 暂用 `false`，Task 6 再接真值；`accentHex` 传 `null`）：
```ts
  mainWindow = new BrowserWindow({
    ...(appIconPath ? { icon: appIconPath } : {}),
    ...buildMainWindowOptions({ platform: process.platform, dark: false, accentHex: null }),
    frame: true,
    height: 768,
    minHeight: 600,
    minWidth: 800,
    resizable: true,
    show: false,
    title: 'Muon',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: getPreloadEntry(),
      sandbox: true,
      webSecurity: true,
    },
    width: 1024,
  })
```
（`webPreferences` 的 `contextIsolation`/`nodeIntegration` 仍在 main.ts 内联——`electronSecurityConfig.test.ts` 继续绿。）

- [ ] **Step 6: 修复旧的源码文本守卫**

`tests/unit/windowTitleBarConfig.test.ts` 旧断言里 `titleBarStyle: 'hidden'` / `titleBarOverlay:` / `backgroundColor: '#ffffff'` 这些字面量已移出 main.ts。把这些**窗口 chrome 字面量断言删掉**，替换为「main.ts 调用了 builder」一条，并保留与窗口 chrome 无关的断言（如不存在 `muon:window:minimize/close/maximize`）。新增/替换断言：
```ts
  it('delegates window chrome to buildMainWindowOptions', () => {
    expect(mainSource).toContain('buildMainWindowOptions({ platform: process.platform')
  })
```
（`mainSource` 为该测试已有的、读取 `electron/main.ts` 源码文本的变量；沿用文件顶部既有的 `readDesktopSource(...)`。行为断言已由 `windowOptions.test.ts` 覆盖。）

- [ ] **Step 7: 跑相关测试 + 类型检查**

Run: `pnpm --filter @muon/desktop exec vitest run tests/unit/windowOptions.test.ts tests/unit/windowTitleBarConfig.test.ts tests/unit/electronSecurityConfig.test.ts`
Expected: 全 PASS。
Run: `pnpm --filter @muon/desktop exec tsc -p tsconfig.electron.json --noEmit`
Expected: 无类型错误。

- [ ] **Step 8: 提交**

```bash
git add apps/desktop/electron/windowOptions.ts apps/desktop/tests/unit/windowOptions.test.ts apps/desktop/electron/main.ts apps/desktop/tests/unit/windowTitleBarConfig.test.ts
git commit -m "refactor(desktop): extract testable buildMainWindowOptions with macOS vibrancy branch"
```

---

### Task 4: `nativeTheme` + 系统强调色 IPC 桥

让原生侧跟随 app 主题（`nativeTheme.themeSource`），并把系统强调色读出来经 IPC 给渲染层注入 `--system-accent`。纯映射逻辑抽成可单测模块。

**Files:**
- Create: `apps/desktop/electron/themeBridge.ts`（纯函数 + IPC 注册）
- Create: `apps/desktop/tests/unit/themeBridge.test.ts`
- Modify: `apps/desktop/electron/main.ts`（import + `registerIpc()` 调 `registerThemeIpc`）
- Modify: `apps/desktop/electron/preload.ts`（暴露 `theme` 桥）
- Create: `apps/desktop/src/app/composables/useNativeAppearance.ts`（渲染层应用强调色 + 推送主题）
- Create: `apps/desktop/tests/unit/useNativeAppearance.test.ts`
- Modify: `apps/desktop/src/app/App.vue`（启动 `useNativeAppearance()`）

**Interfaces:**
- Produces: `resolveThemeSource(mode: 'light'|'dark'|'system'): 'light'|'dark'|'system'`；`normalizeAccentColor(raw: string | null | undefined): string | null`（`"1a73e8ff"` → `#1a73e8`，空/异常 → `null`）；preload 桥 `muonDesktop.theme.set(mode) → Promise<string|null>`、`getAccent() → Promise<string|null>`、`onAccentChanged(cb)`。渲染层 `useNativeAppearance()` 在 bridge 存在时把 `--system-accent` 设到 `document.documentElement`。

- [ ] **Step 1: 写纯函数失败测试**

Create `apps/desktop/tests/unit/themeBridge.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { normalizeAccentColor, resolveThemeSource } from '../../electron/themeBridge'

describe('resolveThemeSource', () => {
  it('passes through the three appearance modes', () => {
    expect(resolveThemeSource('light')).toBe('light')
    expect(resolveThemeSource('dark')).toBe('dark')
    expect(resolveThemeSource('system')).toBe('system')
  })
})

describe('normalizeAccentColor', () => {
  it('strips the alpha byte and prefixes #', () => {
    expect(normalizeAccentColor('1a73e8ff')).toBe('#1a73e8')
    expect(normalizeAccentColor('007affff')).toBe('#007aff')
  })
  it('returns null for missing/invalid input', () => {
    expect(normalizeAccentColor(null)).toBeNull()
    expect(normalizeAccentColor(undefined)).toBeNull()
    expect(normalizeAccentColor('')).toBeNull()
    expect(normalizeAccentColor('xyz')).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @muon/desktop exec vitest run tests/unit/themeBridge.test.ts`
Expected: FAIL，`Cannot find module '../../electron/themeBridge'`。

- [ ] **Step 3: 实现 `themeBridge.ts`**

Create `apps/desktop/electron/themeBridge.ts`:
```ts
import { ipcMain, nativeTheme, systemPreferences } from 'electron'
import type { BrowserWindow } from 'electron'

export type AppearanceMode = 'light' | 'dark' | 'system'

export function resolveThemeSource(mode: AppearanceMode): AppearanceMode {
  return mode // nativeTheme.themeSource accepts exactly these three values
}

// macOS getAccentColor() → "RRGGBBAA" hex (no #). Strip alpha, prefix #.
export function normalizeAccentColor(raw: string | null | undefined): string | null {
  if (!raw) return null
  const hex = raw.trim().toLowerCase()
  if (!/^[0-9a-f]{6,8}$/.test(hex)) return null
  return `#${hex.slice(0, 6)}`
}

function readAccent(): string | null {
  try {
    return normalizeAccentColor(systemPreferences.getAccentColor?.())
  } catch {
    return null
  }
}

export function registerThemeIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('muon:theme:set', (_e, mode: AppearanceMode) => {
    nativeTheme.themeSource = resolveThemeSource(mode)
    return readAccent()
  })
  ipcMain.handle('muon:theme:get-accent', () => readAccent())

  // Push live OS accent changes to the renderer.
  try {
    systemPreferences.on?.('accent-color-changed', () => {
      getWindow()?.webContents.send('muon:theme:accent-changed', readAccent())
    })
  } catch {
    // non-macOS platforms may not emit this — renderer keeps its fallback
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @muon/desktop exec vitest run tests/unit/themeBridge.test.ts`
Expected: PASS。（注意：纯函数 import 自同模块；`ipcMain/nativeTheme/systemPreferences` 是模块顶层 import——vitest 不执行 `registerThemeIpc`，但顶层 `import { ipcMain } from 'electron'` 在 jsdom 下会解析失败。**所以**把 electron 运行时 import 改为惰性：把 `import { ipcMain, nativeTheme, systemPreferences } from 'electron'` 删除，改在 `registerThemeIpc`/`readAccent` 内部 `const { ipcMain, nativeTheme, systemPreferences } = require('electron')`，保留顶部 `import type { BrowserWindow } from 'electron'`。这样纯函数文件不在运行时触达 electron。)

- [ ] **Step 5: 主进程注册**

`apps/desktop/electron/main.ts`：顶部加 `import { registerThemeIpc } from './themeBridge.js'`；在 `registerIpc()`（约 496–506 行）末尾加一行：
```ts
  registerThemeIpc(() => mainWindow)
```

- [ ] **Step 6: preload 暴露桥**

`apps/desktop/electron/preload.ts` 的 `exposeInMainWorld('muonDesktop', { ... })` 对象里，`shell` 之后加：
```ts
  theme: {
    set: (mode: 'light' | 'dark' | 'system') => ipcRenderer.invoke('muon:theme:set', mode),
    getAccent: () => ipcRenderer.invoke('muon:theme:get-accent'),
    onAccentChanged: (callback: (hex: string | null) => void) =>
      subscribeValue<string | null>('muon:theme:accent-changed', callback),
  },
```

- [ ] **Step 7: 渲染层 composable — 写失败测试**

Create `apps/desktop/tests/unit/useNativeAppearance.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyAccent } from '@/app/composables/useNativeAppearance'

afterEach(() => {
  document.documentElement.style.removeProperty('--system-accent')
})

describe('applyAccent', () => {
  it('sets --system-accent when a hex is provided', () => {
    applyAccent('#0a84ff')
    expect(document.documentElement.style.getPropertyValue('--system-accent')).toBe('#0a84ff')
  })
  it('clears --system-accent when null (falls back to token default)', () => {
    applyAccent('#0a84ff')
    applyAccent(null)
    expect(document.documentElement.style.getPropertyValue('--system-accent')).toBe('')
  })
})
```

- [ ] **Step 8: 跑测试确认失败**

Run: `pnpm --filter @muon/desktop exec vitest run tests/unit/useNativeAppearance.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 9: 实现 composable**

Create `apps/desktop/src/app/composables/useNativeAppearance.ts`:
```ts
import { useSelector } from '@tanstack/vue-store'
import { getDesktopBridge } from '@/desktop/bridge'
import { settingsStore } from '@/shared/stores/settingsStore'

export function applyAccent(hex: string | null): void {
  const root = document.documentElement
  if (hex) root.style.setProperty('--system-accent', hex)
  else root.style.removeProperty('--system-accent')
}

// Bridges the in-app appearance to the OS (nativeTheme) and injects the live
// system accent color into --system-accent. No-op outside Electron.
export function useNativeAppearance(): void {
  const bridge = getDesktopBridge()
  if (!bridge?.isElectron || !('theme' in bridge)) return
  const themeBridge = (bridge as unknown as { theme: {
    set: (m: 'light' | 'dark' | 'system') => Promise<string | null>
    getAccent: () => Promise<string | null>
    onAccentChanged: (cb: (hex: string | null) => void) => () => void
  } }).theme

  const theme = useSelector(settingsStore, (s) => s.theme)

  watch(theme, (mode) => { void themeBridge.set(mode).then(applyAccent) }, { immediate: true })
  void themeBridge.getAccent().then(applyAccent)
  const off = themeBridge.onAccentChanged(applyAccent)
  onScopeDispose(off)
}
```
（`watch`/`onScopeDispose` 经 unplugin auto-import；`bridge` 的 `theme` 字段为 Task 6 新增——本仓 `MuonDesktopBridge` 接口在 `src/desktop/bridge.ts:79-82`，需在那补 `theme?` 字段，见 Step 10。）

- [ ] **Step 10: 给 bridge 接口补 `theme` 字段**

`apps/desktop/src/desktop/bridge.ts` 的 `MuonDesktopBridge` 接口（约 79–82 行）加可选字段：
```ts
  theme?: {
    set: (mode: 'light' | 'dark' | 'system') => Promise<string | null>
    getAccent: () => Promise<string | null>
    onAccentChanged: (callback: (hex: string | null) => void) => () => void
  }
```

- [ ] **Step 11: 跑 composable 测试确认通过**

Run: `pnpm --filter @muon/desktop exec vitest run tests/unit/useNativeAppearance.test.ts`
Expected: PASS。

- [ ] **Step 12: App.vue 启动 composable**

`apps/desktop/src/app/App.vue` `<script setup>` 顶部已有 `useTheme()` 的位置旁，加：
```ts
import { useNativeAppearance } from './composables/useNativeAppearance';
// ...
useNativeAppearance();
```

- [ ] **Step 13: 跑全量桌面单测 + 类型检查**

Run: `pnpm --filter @muon/desktop test:unit`
Expected: 全 PASS。
Run: `pnpm --filter @muon/desktop type-check`
Expected: 无错误。

- [ ] **Step 14: 提交**

```bash
git add apps/desktop/electron/themeBridge.ts apps/desktop/tests/unit/themeBridge.test.ts apps/desktop/electron/main.ts apps/desktop/electron/preload.ts apps/desktop/src/app/composables/useNativeAppearance.ts apps/desktop/tests/unit/useNativeAppearance.test.ts apps/desktop/src/app/App.vue apps/desktop/src/desktop/bridge.ts
git commit -m "feat(desktop): bridge nativeTheme + system accent color to the renderer"
```

---

### Task 5: 消除暗色启动闪白（预挂载 `.dark` + 动态窗口背景）

冷启动在暗色下会闪白：窗口 `backgroundColor` 写死 `#ffffff`，且 `.dark` 只在 Vue mount 后才打。抽出纯解析函数预挂载打 `.dark`，并把 Task 3 的 `dark` 接上真值。

**Files:**
- Create: `apps/desktop/src/app/bootTheme.ts`（`resolveBootDark` 纯函数 + 应用）
- Create: `apps/desktop/tests/unit/bootTheme.test.ts`
- Modify: `apps/desktop/src/app/main.ts`（mount 前调用）
- Modify: `apps/desktop/electron/main.ts`（窗口 `dark` 接真值）

**Interfaces:**
- Produces: `resolveBootDark(stored: string | null, prefersDark: boolean): boolean`（`stored` 为 `localStorage('muon_theme')`：`'dark'`→true、`'light'`→false、`'system'`/null→跟 `prefersDark`）；`applyBootTheme()` 在 mount 前 toggle `.dark`。

- [ ] **Step 1: 写失败测试**

Create `apps/desktop/tests/unit/bootTheme.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { resolveBootDark } from '@/app/bootTheme'

describe('resolveBootDark', () => {
  it('explicit dark/light wins over OS', () => {
    expect(resolveBootDark('dark', false)).toBe(true)
    expect(resolveBootDark('light', true)).toBe(false)
  })
  it('system or missing follows the OS', () => {
    expect(resolveBootDark('system', true)).toBe(true)
    expect(resolveBootDark('system', false)).toBe(false)
    expect(resolveBootDark(null, true)).toBe(true)
    expect(resolveBootDark(null, false)).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @muon/desktop exec vitest run tests/unit/bootTheme.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 `bootTheme.ts`**

Create `apps/desktop/src/app/bootTheme.ts`:
```ts
// Pre-mount theme resolution so the .dark class lands before Vue mounts,
// killing the white flash on a dark cold-start. Mirrors useTheme()'s logic.
export function resolveBootDark(stored: string | null, prefersDark: boolean): boolean {
  if (stored === 'dark') return true
  if (stored === 'light') return false
  return prefersDark // 'system' or missing
}

export function applyBootTheme(): void {
  const stored = localStorage.getItem('muon_theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', resolveBootDark(stored, prefersDark))
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @muon/desktop exec vitest run tests/unit/bootTheme.test.ts`
Expected: PASS。

- [ ] **Step 5: 在 mount 前调用**

`apps/desktop/src/app/main.ts`：在 `import './main.css'` 之后、`createApp(App)` 之前加：
```ts
import { applyBootTheme } from './bootTheme'

applyBootTheme()
```

- [ ] **Step 6: 窗口背景接真值**

`apps/desktop/electron/main.ts` 的 `createMainWindow()` 里把 Task 3 暂传的 `dark: false` 改为读 `nativeTheme.shouldUseDarkColors`。顶部已在 Task 4 间接引入 electron 运行时；这里直接用：在 `import { app, BrowserWindow, ... } from 'electron'`（第 7 行）加入 `nativeTheme`，并：
```ts
    ...buildMainWindowOptions({ platform: process.platform, dark: nativeTheme.shouldUseDarkColors, accentHex: null }),
```

- [ ] **Step 7: 跑测试 + 类型检查**

Run: `pnpm --filter @muon/desktop exec vitest run tests/unit/bootTheme.test.ts && pnpm --filter @muon/desktop type-check`
Expected: PASS，无类型错误。

- [ ] **Step 8: 提交**

```bash
git add apps/desktop/src/app/bootTheme.ts apps/desktop/tests/unit/bootTheme.test.ts apps/desktop/src/app/main.ts apps/desktop/electron/main.ts
git commit -m "fix(desktop): pre-mount dark theme + theme-aware window backgroundColor (no dark-launch flash)"
```

---

### Task 6: 安静的 macOS 标题栏

mac 上隐藏居中品牌 logo+wordmark（mac 标题栏应安静），让标题栏背景透明以透出 vibrancy。Win/Linux 不变。复用已有 `isMac`。

**Files:**
- Modify: `apps/desktop/src/app/components/window/WindowTitleBar.vue`（`<style scoped>`，加 `--mac` 下隐藏 brand + 透明背景）
- Modify: `apps/desktop/tests/components/`（新建 `WindowTitleBar.test.ts`）

**Interfaces:**
- Consumes: 既有 `isMac` 计算属性（基于 `getDesktopBridge()?.platform`）。
- Produces: mac 下 `.window-titlebar__brand` 不可见、标题栏透明。

- [ ] **Step 1: 写失败测试**

Create `apps/desktop/tests/components/WindowTitleBar.test.ts`:
```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import WindowTitleBar from '@/app/components/window/WindowTitleBar.vue'

function mockPlatform(platform: string) {
  vi.stubGlobal('window', Object.assign(window, { muonDesktop: { isElectron: true, runtime: 'electron', platform } }))
}

describe('windowTitleBar', () => {
  it('marks the titlebar as mac when platform is darwin', () => {
    mockPlatform('darwin')
    const wrapper = mount(WindowTitleBar)
    expect(wrapper.get('[data-testid="window-titlebar"]').classes()).toContain('window-titlebar--mac')
  })
  it('keeps the brand wordmark on non-mac', () => {
    mockPlatform('win32')
    const wrapper = mount(WindowTitleBar)
    expect(wrapper.get('[data-testid="window-titlebar"]').classes()).not.toContain('window-titlebar--mac')
    expect(wrapper.find('[data-testid="window-titlebar-logo"]').exists()).toBe(true)
  })
})
```
（断言用 class，不依赖 scoped CSS 的实际渲染——`window-titlebar--mac` 是 mac 隐藏 brand 的 CSS 钩子。）

- [ ] **Step 2: 跑测试确认失败/通过基线**

Run: `pnpm --filter @muon/desktop exec vitest run tests/components/WindowTitleBar.test.ts`
Expected: 第一个用例 `--mac` 已经会通过（组件本就加 `--mac`）；若 `darwin` 检测路径未命中则 FAIL。先跑确认现状，再据实补齐（若已绿，进入 Step 3 加样式）。

- [ ] **Step 3: 加 mac 安静样式**

`WindowTitleBar.vue` `<style scoped>` 末尾加：
```css
/* macOS: quiet titlebar — hide brand, let window vibrancy show through */
.window-titlebar--mac {
  background-color: transparent;
  background-image: none;
  border-bottom: none;
}

.window-titlebar--mac .window-titlebar__brand {
  display: none;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @muon/desktop exec vitest run tests/components/WindowTitleBar.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/app/components/window/WindowTitleBar.vue apps/desktop/tests/components/WindowTitleBar.test.ts
git commit -m "feat(desktop): quiet macOS titlebar (hide brand, transparent for vibrancy)"
```

---

### Task 7: Vibrancy 侧栏材质（app rail + 会话侧栏半透明）

主进程已开 `vibrancy: 'sidebar'`（Task 3）；现在让 app rail 与会话侧栏背景半透明，透出 OS 毛玻璃。新增 material token。**OS vibrancy 的实际观感需真机调，token 留校准旋钮。**

**Files:**
- Modify: `packages/ui/src/tokens/colors.css`（light + dark 各加 `--material-sidebar-bg`）
- Modify: `apps/desktop/src/app/components/workspace/WorkspaceAppRail.vue`（根容器背景）
- Modify: `apps/desktop/src/app/components/workspace/ChannelSidebar.vue`（根容器背景）
- Modify: `apps/desktop/tests/components/WorkspaceAppRail.test.ts`（加一条材质类断言）

**Interfaces:**
- Produces: `--material-sidebar-bg`（半透明侧栏材质，light/dark 各一）。app rail + 会话侧栏根容器消费它。

- [ ] **Step 1: 加 material token（非 `--color-*`，无需 check:tokens 配对，但 light/dark 都给）**

`colors.css` light `@theme` 语义层末尾加：
```css
/* macOS vibrancy materials — translucent over OS sidebar vibrancy. Tune on real hardware. */
--material-sidebar-bg: rgba(246, 246, 248, 0.6);
```
`.dark{}` 末尾加：
```css
--material-sidebar-bg: rgba(30, 30, 32, 0.55);
```

- [ ] **Step 2: 确认 token 检查仍通过**

Run: `pnpm --filter @muon/ui check:tokens`
Expected: PASS（`--material-*` 不是 `--color-*`，不触发配对规则；但已两侧都给，安全）。

- [ ] **Step 3: app rail 用材质**

`WorkspaceAppRail.vue` 根容器（rail 最外层 `<div>`/`<nav>`）的背景类替换为材质。找到当前 rail 背景（多为 `bg-sidebar`/`bg-server-bar` 之类），把背景改为内联材质变量并加毛玻璃：
```vue
<!-- 在根容器加： -->
<div class="..." :style="{ background: 'var(--material-sidebar-bg)' }" style="backdrop-filter: blur(24px) saturate(180%)" data-testid="workspace-rail-surface">
```
（保留原有结构/类，仅把不透明背景类换成材质 `:style`；若原来用 `bg-sidebar`，删掉该类避免覆盖。）

- [ ] **Step 4: 会话侧栏用材质**

`ChannelSidebar.vue` 根容器同样处理：背景改 `var(--material-sidebar-bg)` + `backdrop-filter`，给根容器加 `data-testid="channel-sidebar-surface"`。

- [ ] **Step 5: 加材质类断言**

`tests/components/WorkspaceAppRail.test.ts` 末尾加一条：
```ts
  it('renders the rail on a translucent vibrancy surface', () => {
    const wrapper = mount(WorkspaceAppRail)
    const surface = wrapper.get('[data-testid="workspace-rail-surface"]')
    expect(surface.attributes('style')).toContain('var(--material-sidebar-bg)')
  })
```

- [ ] **Step 6: 跑测试 + token 检查**

Run: `pnpm --filter @muon/desktop exec vitest run tests/components/WorkspaceAppRail.test.ts && pnpm --filter @muon/ui check:tokens`
Expected: PASS。

- [ ] **Step 7: 手动验证（真机，记录于 PR）**

构建并运行 mac app，确认 app rail 与会话侧栏透出桌面毛玻璃、主内容区不透明。若毛玻璃过浓/过淡，调 `--material-sidebar-bg` 的 alpha（这是校准旋钮）。
Run: `pnpm --filter @muon/desktop dev`

- [ ] **Step 8: 提交**

```bash
git add packages/ui/src/tokens/colors.css apps/desktop/src/app/components/workspace/WorkspaceAppRail.vue apps/desktop/src/app/components/workspace/ChannelSidebar.vue apps/desktop/tests/components/WorkspaceAppRail.test.ts
git commit -m "feat(desktop): translucent vibrancy material for app rail + channel sidebar"
```

---

### Task 8: 聊天气泡换 token（iMessage 化）

把 `ChatMessage.vue` 的硬编码气泡（`rounded-[20px]` + 裸 `B100/N200`）换成 Task 2 的气泡 token；自己=强调色填充白字、别人=系统灰。`messageAlignment` 默认已 leftright，加守卫测试。

**Files:**
- Modify: `apps/desktop/src/features/chat/components/ChatMessage.vue:138-141`
- Create: `apps/desktop/tests/components/ChatMessageBubble.test.ts`
- Create: `apps/desktop/tests/stores/messageAlignmentDefault.test.ts`

**Interfaces:**
- Consumes: `--color-bubble-own-bg/fg`、`--color-bubble-other-bg/fg`、`--radius-bubble`（Task 2）；`isRightAligned`（既有，`ChatMessage.vue:137`）。

- [ ] **Step 1: 守卫测试——messageAlignment 默认 leftright（G5）**

Create `apps/desktop/tests/stores/messageAlignmentDefault.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { resetSettingsStore, settingsStore } from '@/shared/stores/settingsStore'

describe('messageAlignment default', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSettingsStore()
  })
  it('defaults to leftright (iMessage) for macOS-native chat', () => {
    expect(settingsStore.state.messageAlignment).toBe('leftright')
  })
})
```
Run: `pnpm --filter @muon/desktop exec vitest run tests/stores/messageAlignmentDefault.test.ts`
Expected: PASS（默认已是 leftright；此为防回退守卫）。

- [ ] **Step 2: 写气泡失败测试**

Create `apps/desktop/tests/components/ChatMessageBubble.test.ts`。先确认现状会失败（断言新 token 类，旧代码用 `rounded-[20px]`）。挂载需要的最小 props 依赖较多，采用「断言计算出的 bubble class 字符串」的轻量方式——把断言放在渲染后的气泡元素 class 上。参照既有 `tests/components/*` 的 mount 方式，给 ChatMessage 传最小可渲染 props（沿用仓库内已有的 ChatMessage 测试夹具；若无，挂载后查 `.message-body-text` 节点）：
```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChatMessage from '@/features/chat/components/ChatMessage.vue'

// 最小 props：渲染一条纯文本他人消息 + 一条自己消息。
// 具体 props 形状以 ChatMessage.vue 的 defineProps 为准（实现时对齐）。
function mountText(opts: { mine: boolean }) {
  return mount(ChatMessage, { props: { /* …minimal message props, isMine: opts.mine… */ } as never })
}

describe('chat bubble macOS tokens', () => {
  it('uses bubble radius + other-bubble token for received messages', () => {
    const wrapper = mountText({ mine: false })
    const bubble = wrapper.get('.message-body-text')
    expect(bubble.classes().join(' ')).toContain('rounded-[var(--radius-bubble)]')
    expect(bubble.classes().join(' ')).toContain('bg-[var(--color-bubble-other-bg)]')
  })
})
```
> 注：ChatMessage 的完整 props 形状在实现时从 `defineProps` 抄全；若挂载成本过高，退化为对 `textBubbleClass` 计算属性的单元断言（把 `textBubbleClass` 逻辑保持纯粹即可直接断言其输出数组）。

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm --filter @muon/desktop exec vitest run tests/components/ChatMessageBubble.test.ts`
Expected: FAIL（当前是 `rounded-[20px]` + `bg-[var(--N200)]`）。

- [ ] **Step 4: 换 token**

`ChatMessage.vue:138-141` 改为：
```ts
const textBubbleClass = computed(() => [
  'w-fit max-w-full rounded-[var(--radius-bubble)] px-4 py-2.5',
  isRightAligned.value
    ? 'self-end bg-[var(--color-bubble-own-bg)] text-[var(--color-bubble-own-fg)]'
    : 'bg-[var(--color-bubble-other-bg)] text-[var(--color-bubble-other-fg)]',
]);
```
注意：自己气泡现在白字，行 838-841 的 `<p>` 上原有 `text-foreground/90` 在右对齐时会与 `text-[var(--color-bubble-own-fg)]` 冲突。把行 840 的 `text-foreground/90` 删掉（颜色统一由 `textBubbleClass` 决定）：
```vue
          class="message-selectable-text message-body-text whitespace-pre-wrap break-words"
          :class="textBubbleClass"
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @muon/desktop exec vitest run tests/components/ChatMessageBubble.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/desktop/src/features/chat/components/ChatMessage.vue apps/desktop/tests/components/ChatMessageBubble.test.ts apps/desktop/tests/stores/messageAlignmentDefault.test.ts
git commit -m "feat(chat): macOS iMessage bubble tokens (own=accent, other=system gray)"
```

---

### Task 9: 聊天周边圆角 token 化

把聊天里残留的硬编码圆角（悬浮动作条 `rounded-[10px]`）换成 token，并把硬编码边框色换成 token，保持与 macOS 圆角档一致。header/composer 已用语义类（`bg-sidebar`/`bg-input`/`border-border`），随 token 级联，无需改。

**Files:**
- Modify: `apps/desktop/src/features/chat/components/MessageActionBar.vue:291`
- Create: `apps/desktop/tests/components/MessageActionBarRadius.test.ts`（若挂载成本高，退化为源码文本守卫，见下）

**Interfaces:**
- Consumes: `--radius-md`（6px，控件圆角）、`--color-border`。

- [ ] **Step 1: 写守卫测试（源码文本，避开重型挂载）**

Create `apps/desktop/tests/components/MessageActionBarRadius.test.ts`:
```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(
  resolve(__dirname, '../../src/features/chat/components/MessageActionBar.vue'),
  'utf-8',
)

describe('MessageActionBar radius', () => {
  it('uses the radius token, not a hardcoded rounded-[10px]', () => {
    expect(SRC).not.toContain('rounded-[10px]')
    expect(SRC).toContain('rounded-md')
  })
  it('uses the border token, not a hardcoded rgba border', () => {
    expect(SRC).not.toContain('border-[rgba(31,35,41,0.08)]')
    expect(SRC).toContain('border-border')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @muon/desktop exec vitest run tests/components/MessageActionBarRadius.test.ts`
Expected: FAIL（当前含 `rounded-[10px]` 和 `border-[rgba(31,35,41,0.08)]`）。

- [ ] **Step 3: 换 token**

`MessageActionBar.vue:291` 改为：
```
    class="action-bar flex items-center overflow-visible rounded-md border border-border bg-popover shadow-[var(--shadow-s1-down)]"
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @muon/desktop exec vitest run tests/components/MessageActionBarRadius.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/features/chat/components/MessageActionBar.vue apps/desktop/tests/components/MessageActionBarRadius.test.ts
git commit -m "refactor(chat): token-ize message action bar radius + border"
```

---

### Task 10: 基座验收（G1–G5）

跑全量验证、再生 UI 视觉基线、真机走查 macOS 观感，确认 G1–G5 全过，更新 spec 状态。

**Files:**
- Modify: `packages/ui/tests/visual/__screenshots__/`（再生基线 PNG）
- Modify: `docs/superpowers/specs/2026-06-25-macos-native-redesign-design.md`（状态行）

- [ ] **Step 1: 全量单测 + 类型 + token 检查**

Run:
```bash
pnpm --filter @muon/desktop test:unit
pnpm --filter @muon/desktop type-check
pnpm --filter @muon/ui check:tokens
```
Expected: 全 PASS（`Token completeness check PASSED`）。

- [ ] **Step 2: 再生 UI 视觉基线（token 改了，atom 快照会变）**

Run: `pnpm --filter @muon/ui test:visual:update`
Expected: 重新生成 `__screenshots__/` 下 light+dark 基线。**人工 diff**：确认 atom（按钮/开关等）现在是 macOS 蓝、圆角符合预期、暗色正常。

- [ ] **Step 3: 构建并真机走查（G2/G3/G4/G5）**

Run: `pnpm --filter @muon/desktop build && pnpm --filter @muon/desktop dev`
逐条核对：
  - **G2**：mac 窗口为圆角 + `hiddenInset` + 毛玻璃；红绿灯位置正常；（如有 Win 机）Win chrome 未回退。
  - **G3**：切系统亮/暗 → app + 原生菜单同步；切系统强调色 → 按钮/自己气泡/选中条跟随；**暗色冷启动无白闪**。
  - **G4**：app rail + 会话侧栏透出毛玻璃，主内容不透明。
  - **G5**：聊天自己消息靠右=强调色气泡、别人靠左=系统灰气泡；亮/暗双主题均「macOS 感」。

- [ ] **Step 4: 更新 spec 状态行**

`docs/superpowers/specs/2026-06-25-macos-native-redesign-design.md` 第 4 行 `状态：📝 设计中（待实现）` 改为：
```
状态：✅ 基座已实现（分支 feat/macos-native-redesign）；Wave 2-4 待铺开
```

- [ ] **Step 5: 提交**

```bash
git add packages/ui/tests/visual/__screenshots__ docs/superpowers/specs/2026-06-25-macos-native-redesign-design.md
git commit -m "test(ui): refresh visual baselines under macOS tokens; mark foundation done"
```

---

## Self-Review

**Spec 覆盖核对（§ → Task）：**
- §2.1 设计语言 token（色彩/强调色/圆角）→ T1（accent+blue）、T2（bubble+radius）。字体：`--font-sans` 已含 `-apple-system`，无需改（YAGNI，spec §8 口径）；display 字体未被基座任一面消费，故不引入。
- §2.2 原生窗口 chrome → T3（buildMainWindowOptions：hiddenInset/vibrancy/去 WCO）+ T6（安静标题栏）。
- §2.3 nativeTheme 桥 + 强调色 + 启动闪白 → T4（桥+accent）+ T5（预挂载 dark + 动态背景）。
- §2.4 vibrancy 材质 → T7。
- §2.5 聊天试点 → T8（气泡）+ T9（周边圆角）。messageAlignment 默认已 leftright → T8 加守卫。
- §2.6 跨切面硬编码（聊天波触及部分）→ T9（action bar）。其余模块的内联 hex（docs/server 等）属 Wave 2-4，不在基座。
- 验收门 G1–G5 → T10 全覆盖（G1 级联=check:tokens+视觉基线；G2/G3/G4/G5 真机走查）。
- **Gap（有意延后到 Rollout，非基座）**：spec §2.6 的 docs/server 内联 hex、方角 server 控件；spec 风险项「打包 `out/renderer/index.html` 陈旧」——T5 改源码 `index.html`/`main.ts`，T10 的 `build` 会重新产出正确骨架，但若 CI 用陈旧产物需另查（记于 PR）。

**占位扫描：** 无 TBD/TODO。T8 Step 2 的 ChatMessage props 形状标注「实现时对齐 defineProps」并给了退化方案（断言 `textBubbleClass` 纯输出），非占位——是对重型组件挂载的明确降级路径。

**类型/命名一致性：** `buildMainWindowOptions`（T3）签名与 T5 调用一致（`{platform,dark,accentHex}`）；`resolveThemeSource`/`normalizeAccentColor`（T4）与测试一致；`--system-accent`（T1 定义回退、T4 注入、T5 不涉及）一致；`--color-bubble-*`/`--radius-bubble`（T2 产出、T8 消费）一致；`applyAccent`/`useNativeAppearance`（T4）测试与实现一致。

> 实现顺序即任务序（T1→T10）。T8 依赖 T2 的 token；T5 依赖 T3 的 builder；T7 的 vibrancy 依赖 T3 的 `vibrancy:'sidebar'`。严格顺序执行可避免接口悬空。
