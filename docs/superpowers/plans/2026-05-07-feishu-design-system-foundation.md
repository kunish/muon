# Feishu Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Spec 1 of the F0-design-system sub-project — token foundation, 12 Feishu-aligned atom components, Storybook scaffolding, and visual regression baselines, all inside `packages/ui`.

**Architecture:** Upgrade the existing `@muon/ui` workspace package (do not create a new package). Extend its Tailwind v4 `@theme` block with a palette layer and remap role tokens. Add an `atoms/` directory that owns Feishu-spec components; the legacy `components/ui/*` files continue to re-export from `atoms/` so existing app imports stay untouched. Storybook 9 + Vue 3 + Vite is added to `packages/ui` for visualisation, anchor reference, and screenshot-based visual regression run via Playwright.

**Tech Stack:** Tailwind CSS v4, Vue 3 Composition API, reka-ui (headless primitives), class-variance-authority (variants), clsx + tailwind-merge (`cn`), lucide-vue-next (icons), Storybook 9 (`@storybook/vue3-vite`), Playwright (screenshot diff), Vitest (atom unit tests).

**Spec reference:** `docs/superpowers/specs/2026-05-07-feishu-design-system-foundation-design.md`

---

## File Structure (locked decomposition)

### Created
```
packages/ui/src/tokens/
├─ colors.css           palette (gray, brand, red, green, orange, cyan ×11) + role + dark
├─ typography.css       font stacks + size/lh scale + weight scale
├─ spacing.css          4-8 rhythm scale
├─ radius.css           xs/sm/md/lg/xl/full
├─ shadow.css           xs/sm/md/lg/xl
├─ density.css          control heights + list-item-h + toolbar-h
└─ motion.css           durations + easing functions

packages/ui/src/atoms/
├─ button/Button.vue, index.ts
├─ input/Input.vue, index.ts
├─ textarea/Textarea.vue, index.ts
├─ badge/Badge.vue, index.ts
├─ avatar/Avatar.vue, index.ts
├─ icon/Icon.vue, index.ts
├─ separator/Separator.vue, index.ts
├─ kbd/Kbd.vue, index.ts            (new)
├─ spinner/Spinner.vue, index.ts    (new)
├─ switch/Switch.vue, index.ts
├─ checkbox/Checkbox.vue, index.ts
└─ radio/Radio.vue, index.ts        (new)

packages/ui/.storybook/
├─ main.ts              Storybook config
├─ preview.ts           global decorators + theme switcher
└─ anchors/             5-8 Feishu reference images (user-supplied)

packages/ui/src/stories/
├─ Foundation/
│   ├─ Tokens.stories.ts            color swatches, type scale, spacing ruler
│   └─ Anchors.stories.ts           reference visualizer
└─ Atoms/
    ├─ Button.stories.ts            6 stories: Default/Variants/Sizes/States/WithIcon/Density
    ├─ Input.stories.ts
    ├─ Textarea.stories.ts
    ├─ Badge.stories.ts
    ├─ Avatar.stories.ts
    ├─ Icon.stories.ts
    ├─ Separator.stories.ts
    ├─ Kbd.stories.ts
    ├─ Spinner.stories.ts
    ├─ Switch.stories.ts
    ├─ Checkbox.stories.ts
    └─ Radio.stories.ts

packages/ui/scripts/
└─ check-tokens.ts      Token completeness check (G1 verification)

packages/ui/tests/
├─ Button.loading.test.ts
├─ Switch.controlled.test.ts
├─ Checkbox.controlled.test.ts
├─ Radio.controlled.test.ts
└─ Kbd.platform.test.ts

packages/ui/playwright.config.ts    Storybook screenshot config (separate from root)
packages/ui/tests/visual/
└─ atoms.visual.spec.ts             screenshot baseline runner
```

### Modified
```
packages/ui/package.json            new scripts (storybook, build-storybook, test:visual,
                                    check:tokens), exports for atoms/*
packages/ui/src/styles.css          replace single @theme block with @import of tokens/*.css
packages/ui/src/components/ui/<atom>/index.ts   re-export from atoms/<atom>
packages/ui/tsconfig.json           include stories/, atoms/
src/app/main.css                    audit & remove duplicated tokens, leave workspace-* alone
```

### Untouched (locked exclusions)
```
src/app/components/workspace/*      workspace-* migration is Spec 3
apps/admin/*                        React app, out of Spec 1 scope
electron/*                          no native changes
```

---

## Phase A — Token Foundation

Locks the Feishu palette + role mapping inside Tailwind v4 `@theme`. No UI changes yet.

### Task A1: Split `styles.css` into a token import shell

**Files:**
- Modify: `packages/ui/src/styles.css`
- Create: `packages/ui/src/tokens/colors.css`
- Create: `packages/ui/src/tokens/typography.css`
- Create: `packages/ui/src/tokens/spacing.css`
- Create: `packages/ui/src/tokens/radius.css`
- Create: `packages/ui/src/tokens/shadow.css`
- Create: `packages/ui/src/tokens/density.css`
- Create: `packages/ui/src/tokens/motion.css`

- [ ] **Step 1: Move existing `@theme` content out**

Open `packages/ui/src/styles.css`. Cut everything from `@theme {` through the closing `}` of the dark block. Keep `@import 'tailwindcss'` and `@import 'tw-animate-css'` at the top. Replace cut content with:

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@import './tokens/colors.css';
@import './tokens/typography.css';
@import './tokens/spacing.css';
@import './tokens/radius.css';
@import './tokens/shadow.css';
@import './tokens/density.css';
@import './tokens/motion.css';
```

- [ ] **Step 2: Create `tokens/colors.css` with palette + role + dark**

Write the cut color tokens into `packages/ui/src/tokens/colors.css`. Add palette layer above the role layer. Final content:

```css
/* Palette layer (raw scales, no semantics) */
@theme {
  /* brand — muon identity preserved (#2d5af7 ≠ Feishu #3370FF, locked by spec §0) */
  --brand-50:  #eef2ff;
  --brand-100: #dee5fd;
  --brand-200: #b8c8fb;
  --brand-300: #8aa4f8;
  --brand-400: #5b80f7;
  --brand-500: #2d5af7;
  --brand-600: #2249d2;
  --brand-700: #1c3aa7;
  --brand-800: #182f85;
  --brand-900: #14266b;
  --brand-950: #0a1542;

  /* gray — Feishu-leaning cool neutral */
  --gray-50:  #f8f9fa;
  --gray-100: #f1f3f5;
  --gray-200: #e5e7eb;
  --gray-300: #ced3da;
  --gray-400: #9da3af;
  --gray-500: #5f6673;
  --gray-600: #464d59;
  --gray-700: #2f343d;
  --gray-800: #1f242b;
  --gray-900: #14181d;
  --gray-950: #0a0c10;

  /* red — destructive */
  --red-50:  #fff1f1;
  --red-100: #ffdede;
  --red-200: #ffbcbc;
  --red-300: #ff9090;
  --red-400: #ff6868;
  --red-500: #e54545;
  --red-600: #c93535;
  --red-700: #a52828;
  --red-800: #802020;
  --red-900: #631a1a;
  --red-950: #390e0e;

  /* green — success */
  --green-50:  #ecfdf3;
  --green-100: #cdf9dd;
  --green-200: #98f0bb;
  --green-300: #5fe293;
  --green-400: #2bcd6e;
  --green-500: #00b42a;
  --green-600: #009122;
  --green-700: #00731f;
  --green-800: #00591b;
  --green-900: #034317;
  --green-950: #00280c;

  /* orange — warning */
  --orange-50:  #fff7e8;
  --orange-100: #ffeac4;
  --orange-200: #ffd28a;
  --orange-300: #ffb44a;
  --orange-400: #ff971f;
  --orange-500: #ff7d00;
  --orange-600: #d96400;
  --orange-700: #ad4e00;
  --orange-800: #823a00;
  --orange-900: #5e2a00;
  --orange-950: #321400;

  /* cyan — info */
  --cyan-50:  #ecfdfd;
  --cyan-100: #cdfafa;
  --cyan-200: #94f2f1;
  --cyan-300: #56e3e2;
  --cyan-400: #1fcfcd;
  --cyan-500: #0fc6c2;
  --cyan-600: #0aa19e;
  --cyan-700: #0a7e7c;
  --cyan-800: #0c625f;
  --cyan-900: #0a4948;
  --cyan-950: #002827;
}

/* Role layer — semantic aliases, light mode */
@theme {
  --color-background: #ffffff;
  --color-foreground: #111827;
  --color-muted: var(--gray-100);
  --color-muted-foreground: var(--gray-500);
  --color-primary: var(--brand-500);
  --color-primary-foreground: #ffffff;
  --color-accent: var(--gray-100);
  --color-accent-foreground: #111827;
  --color-destructive: var(--red-500);
  --color-destructive-foreground: #ffffff;
  --color-border: var(--gray-200);
  --color-input: var(--gray-300);
  --color-ring: var(--brand-500);
  --color-card: #ffffff;
  --color-card-foreground: #111827;
  --color-secondary: var(--cyan-500);
  --color-secondary-foreground: #ffffff;
  --color-popover: #ffffff;
  --color-popover-foreground: #111827;
  --color-sidebar: var(--gray-50);
  --color-sidebar-foreground: #111827;
  --color-sidebar-border: var(--gray-200);
  --color-sidebar-accent: var(--gray-100);
  --color-sidebar-accent-foreground: #111827;
  --color-sidebar-primary: var(--brand-500);
  --color-sidebar-primary-foreground: #ffffff;
  --color-sidebar-ring: var(--brand-500);
  --color-server-bar: var(--gray-100);
  --color-success: var(--green-500);
  --color-warning: var(--orange-500);
  --color-info: var(--cyan-500);
  --color-chart-1: var(--brand-500);
  --color-chart-2: var(--cyan-500);
  --color-chart-3: var(--green-500);
  --color-chart-4: var(--orange-500);
  --color-chart-5: var(--gray-500);
}

/* Role layer — dark overrides */
.dark {
  --color-background: #17181c;
  --color-foreground: #e1e2e8;
  --color-muted: #1f1f23;
  --color-muted-foreground: var(--gray-400);
  --color-primary: var(--brand-500);
  --color-primary-foreground: #ffffff;
  --color-accent: #25262b;
  --color-accent-foreground: #e1e2e8;
  --color-destructive: var(--red-400);
  --color-destructive-foreground: #ffffff;
  --color-border: color-mix(in srgb, var(--gray-700) 60%, transparent);
  --color-input: #0f1113;
  --color-ring: var(--brand-500);
  --color-card: #1f1f23;
  --color-card-foreground: #e1e2e8;
  --color-secondary: var(--cyan-400);
  --color-secondary-foreground: #003543;
  --color-popover: #25262b;
  --color-popover-foreground: #e1e2e8;
  --color-sidebar: #1a1d21;
  --color-sidebar-foreground: #e1e2e8;
  --color-sidebar-border: color-mix(in srgb, var(--gray-700) 60%, transparent);
  --color-sidebar-accent: #25262b;
  --color-sidebar-accent-foreground: #e1e2e8;
  --color-sidebar-primary: var(--brand-500);
  --color-sidebar-primary-foreground: #ffffff;
  --color-sidebar-ring: var(--brand-500);
  --color-server-bar: #0f1113;
  --color-success: var(--green-400);
  --color-warning: var(--orange-400);
  --color-info: var(--cyan-400);
  --color-chart-1: var(--brand-500);
  --color-chart-2: var(--cyan-400);
  --color-chart-3: var(--green-400);
  --color-chart-4: var(--orange-400);
  --color-chart-5: var(--gray-400);
}
```

- [ ] **Step 3: Create `tokens/typography.css`**

```css
@theme {
  --font-sans: 'PingFang SC', 'HarmonyOS Sans SC', 'Source Han Sans SC',
               'Helvetica Neue', Arial, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;

  --text-xs:    0.75rem;     /* 12px */
  --text-xs--line-height:    1.125rem; /* 18px */
  --text-sm:    0.8125rem;   /* 13px — control text */
  --text-sm--line-height:    1.25rem;  /* 20px */
  --text-base: 0.875rem;     /* 14px — body text (was 16px) */
  --text-base--line-height: 1.375rem;  /* 22px */
  --text-lg:    1rem;        /* 16px — card title */
  --text-lg--line-height:    1.5rem;   /* 24px */
  --text-xl:    1.125rem;    /* 18px — H2 */
  --text-xl--line-height:    1.625rem; /* 26px */
  --text-2xl:   1.25rem;     /* 20px — H1 */
  --text-2xl--line-height:   1.75rem;  /* 28px */
  --text-3xl:   1.5rem;      /* 24px — marketing */
  --text-3xl--line-height:   2rem;     /* 32px */

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
}
```

- [ ] **Step 4: Create `tokens/spacing.css`**

```css
@theme {
  /* Tailwind v4 spacing scale uses --spacing-* */
  --spacing-0\.5: 0.125rem;  /* 2px */
  --spacing-1:    0.25rem;   /* 4px */
  --spacing-1\.5: 0.375rem;  /* 6px */
  --spacing-2:    0.5rem;    /* 8px */
  --spacing-2\.5: 0.625rem;  /* 10px */
  --spacing-3:    0.75rem;   /* 12px */
  --spacing-4:    1rem;      /* 16px */
  --spacing-5:    1.25rem;   /* 20px */
  --spacing-6:    1.5rem;    /* 24px */
  --spacing-8:    2rem;      /* 32px */
  --spacing-10:   2.5rem;    /* 40px */
  --spacing-12:   3rem;      /* 48px */
}
```

> Note: Tailwind v4 ships its own default spacing; this redeclaration locks our values explicitly. Override only where Feishu rhythm differs (currently same as Tailwind defaults — kept for documentation).

- [ ] **Step 5: Create `tokens/radius.css`**

```css
@theme {
  --radius-xs:   0.125rem;  /* 2px */
  --radius-sm:   0.25rem;   /* 4px */
  --radius-md:   0.375rem;  /* 6px */
  --radius-lg:   0.5rem;    /* 8px */
  --radius-xl:   0.75rem;   /* 12px */
  --radius-full: 9999px;

  /* Legacy single --radius retained as alias to --radius-sm */
  --radius: var(--radius-sm);
}
```

- [ ] **Step 6: Create `tokens/shadow.css`**

```css
@theme {
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
  --shadow-sm: 0 2px 4px 0 rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 8px -1px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 24px -4px rgba(0, 0, 0, 0.10);
  --shadow-xl: 0 16px 40px -8px rgba(0, 0, 0, 0.12);
}

.dark {
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.30);
  --shadow-sm: 0 2px 4px 0 rgba(0, 0, 0, 0.36);
  --shadow-md: 0 4px 8px -1px rgba(0, 0, 0, 0.44);
  --shadow-lg: 0 8px 24px -4px rgba(0, 0, 0, 0.52);
  --shadow-xl: 0 16px 40px -8px rgba(0, 0, 0, 0.60);
}
```

- [ ] **Step 7: Create `tokens/density.css`**

```css
@theme {
  --control-h-sm: 1.75rem;   /* 28px */
  --control-h-md: 2rem;      /* 32px */
  --control-h-lg: 2.25rem;   /* 36px */
  --control-h-xl: 2.5rem;    /* 40px */

  --list-item-h:  2rem;      /* 32px */
  --toolbar-h:    2.5rem;    /* 40px */
  --sidebar-rail: 3.5rem;    /* 56px */
}

[data-density='compact'] {
  --control-h-sm: 1.5rem;    /* 24px */
  --control-h-md: 1.75rem;   /* 28px */
  --control-h-lg: 2rem;      /* 32px */
  --control-h-xl: 2.25rem;   /* 36px */
  --list-item-h:  1.75rem;   /* 28px */
}
```

- [ ] **Step 8: Create `tokens/motion.css`**

```css
@theme {
  --duration-fast:    120ms;
  --duration-base:    180ms;
  --duration-slow:    240ms;
  --duration-slower:  320ms;

  --ease-standard:    cubic-bezier(0.4, 0, 0.2, 1);
  --ease-emphasized:  cubic-bezier(0.2, 0, 0, 1);
  --ease-decelerate:  cubic-bezier(0, 0, 0.2, 1);
  --ease-accelerate:  cubic-bezier(0.4, 0, 1, 1);
}
```

- [ ] **Step 9: Verify build still works**

Run: `pnpm --filter @muon/ui exec tsc --noEmit && pnpm build:web`
Expected: no errors. Token-only changes should leave types untouched.

- [ ] **Step 10: Commit**

```bash
git add packages/ui/src/styles.css packages/ui/src/tokens/
git commit -m "feat(ui): split tokens into palette, role, and feature files"
```

### Task A2: Audit and remove duplicated tokens in `src/app/main.css`

**Files:**
- Modify: `src/app/main.css`

- [ ] **Step 1: Identify duplicate `@theme` definitions**

Run: `grep -n '@theme' src/app/main.css`
Expected: any matches indicate the app re-declares tokens that now live in `@muon/ui`.

- [ ] **Step 2: Remove duplicate token blocks**

In `src/app/main.css`, delete any `@theme { ... }` block that redefines colors/radius/animate already moved into `tokens/colors.css`. Keep `workspace-*` component layer untouched.

- [ ] **Step 3: Run app build**

Run: `pnpm build:web`
Expected: success.

- [ ] **Step 4: Boot dev server and walk through main routes**

Run: `pnpm dev:desktop` (or `pnpm dev:web` for browser fallback) in a background process.
Visit `/dm`, `/calendar`, `/docs`, `/contacts`, `/settings`. Confirm pages render — colours and density may shift visibly (expected per spec §5.1 G6).

- [ ] **Step 5: Commit**

```bash
git add src/app/main.css
git commit -m "refactor(app): drop tokens duplicated by @muon/ui"
```

### Task A3: Token completeness check script (G1)

**Files:**
- Create: `packages/ui/scripts/check-tokens.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Add script**

Write `packages/ui/scripts/check-tokens.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const TOKENS_DIR = resolve(import.meta.dirname, '../src/tokens')
const SRC_DIR = resolve(import.meta.dirname, '../src')

const REQUIRED_ROLES = [
  'background', 'foreground', 'muted', 'muted-foreground',
  'primary', 'primary-foreground', 'accent', 'accent-foreground',
  'destructive', 'destructive-foreground', 'border', 'input', 'ring',
  'card', 'card-foreground', 'secondary', 'secondary-foreground',
  'popover', 'popover-foreground',
  'success', 'warning', 'info',
]

function readAllTokens(): string {
  return readdirSync(TOKENS_DIR)
    .filter(f => f.endsWith('.css'))
    .map(f => readFileSync(resolve(TOKENS_DIR, f), 'utf-8'))
    .join('\n')
}

function readAllSource(): string {
  function walk(dir: string): string[] {
    const out: string[] = []
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, ent.name)
      if (ent.isDirectory()) out.push(...walk(p))
      else if (/\.(?:vue|ts|css)$/.test(ent.name)) out.push(p)
    }
    return out
  }
  return walk(SRC_DIR).map(p => readFileSync(p, 'utf-8')).join('\n')
}

const tokens = readAllTokens()
const errors: string[] = []

for (const role of REQUIRED_ROLES) {
  if (!new RegExp(`--color-${role}\\s*:`).test(tokens))
    errors.push(`Missing role token: --color-${role}`)
}

const lightRoles = (tokens.match(/--color-[a-z-]+/g) ?? []).filter((v, i, a) => a.indexOf(v) === i)
const darkBlock = tokens.split('.dark').slice(1).join('.dark')
for (const role of lightRoles) {
  if (!darkBlock.includes(`${role}:`))
    errors.push(`Missing dark override: ${role}`)
}

const definedPalette = (tokens.match(/--(?:brand|gray|red|green|orange|cyan)-\d+/g) ?? [])
const allSource = readAllSource()
const unused = definedPalette.filter(p => !new RegExp(p.replace(/-/g, '\\-')).test(allSource + tokens))
if (unused.length)
  console.warn(`[warn] Unused palette tokens: ${[...new Set(unused)].join(', ')}`)

if (errors.length) {
  console.error('Token completeness check FAILED:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('Token completeness check PASSED')
```

- [ ] **Step 2: Wire script in package.json**

In `packages/ui/package.json`, add to `scripts` (create the field if missing):

```json
"scripts": {
  "check:tokens": "tsx scripts/check-tokens.ts"
}
```

- [ ] **Step 3: Run script**

Run: `pnpm --filter @muon/ui check:tokens`
Expected: `Token completeness check PASSED`. Investigate any failure before committing.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/scripts/check-tokens.ts packages/ui/package.json
git commit -m "chore(ui): add token completeness check (G1)"
```

---

## Phase B — Storybook Scaffolding

Set up Storybook 9 + Vue 3 + Vite inside `packages/ui`. De-risk Tailwind v4 compatibility on day 1.

### Task B1: Install Storybook deps

**Files:**
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Install**

Run: `pnpm --filter @muon/ui add -D storybook@^9 @storybook/vue3-vite@^9 @storybook/addon-essentials@^9 @storybook/test@^9 @storybook/addon-themes@^9`
Expected: dependencies added; lockfile updated.

- [ ] **Step 2: Add scripts**

In `packages/ui/package.json`, ensure `scripts` contains:

```json
"scripts": {
  "check:tokens": "tsx scripts/check-tokens.ts",
  "storybook": "storybook dev -p 6006",
  "build-storybook": "storybook build -o storybook-static"
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/package.json ../../pnpm-lock.yaml
git commit -m "chore(ui): add Storybook 9 dev deps"
```

> If pnpm-lock.yaml lives in repo root, the relative path may differ. Use `git add -u && git status` to confirm before committing.

### Task B2: Storybook configuration

**Files:**
- Create: `packages/ui/.storybook/main.ts`
- Create: `packages/ui/.storybook/preview.ts`

- [ ] **Step 1: Write `main.ts`**

```ts
import type { StorybookConfig } from '@storybook/vue3-vite'

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  staticDirs: ['./anchors'],
  docs: { autodocs: 'tag' },
}

export default config
```

- [ ] **Step 2: Write `preview.ts`**

```ts
import type { Preview } from '@storybook/vue3'
import { withThemeByClassName } from '@storybook/addon-themes'
import '../src/styles.css'

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true },
    layout: 'centered',
  },
  decorators: [
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
    }),
  ],
  globalTypes: {
    density: {
      description: 'Density mode',
      defaultValue: 'comfortable',
      toolbar: {
        title: 'Density',
        items: [
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'compact', title: 'Compact' },
        ],
      },
    },
  },
}

export default preview
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/.storybook
git commit -m "feat(ui): add Storybook config with theme + density toolbar"
```

### Task B3: Hello-world story to verify Tailwind v4 ↔ Storybook 9 path

**Files:**
- Create: `packages/ui/src/stories/Foundation/Tokens.stories.ts`

- [ ] **Step 1: Write Tokens story**

```ts
import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

const PALETTES = ['brand', 'gray', 'red', 'green', 'orange', 'cyan'] as const
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const

const PaletteSwatches = defineComponent({
  name: 'PaletteSwatches',
  setup() {
    return () => h('div', { class: 'flex flex-col gap-4 p-4' }, PALETTES.map(p =>
      h('div', { key: p, class: 'flex flex-col gap-1' }, [
        h('div', { class: 'text-sm font-medium' }, p),
        h('div', { class: 'flex gap-1' }, STEPS.map(s =>
          h('div', {
            key: s,
            class: 'flex h-12 w-12 items-end justify-center rounded-sm text-[10px] font-mono text-white/80',
            style: { background: `var(--${p}-${s})` },
          }, s),
        )),
      ]),
    ))
  },
})

const meta: Meta<typeof PaletteSwatches> = {
  title: 'Foundation/Tokens',
  component: PaletteSwatches,
  tags: ['autodocs'],
}

export default meta

export const Palette: StoryObj<typeof PaletteSwatches> = {}
```

- [ ] **Step 2: Boot Storybook**

Run: `pnpm --filter @muon/ui storybook` (in background; let it start; visit `http://localhost:6006`)
Expected: Storybook UI opens; `Foundation/Tokens > Palette` shows 6 rows of 11 swatches; toolbar shows light/dark + density toggles.

If Tailwind v4 fails to load CSS variables, fall back to Storybook 8.x by reinstalling `pnpm --filter @muon/ui add -D storybook@^8 @storybook/vue3-vite@^8 @storybook/addon-essentials@^8 @storybook/test@^8 @storybook/addon-themes@^8` and rerun.

- [ ] **Step 3: Stop background Storybook**

Stop the dev server (or kill the bash background ID). The build is verified by inspection.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/stories/Foundation/Tokens.stories.ts
git commit -m "feat(ui): add Foundation/Tokens story to verify Storybook + Tailwind v4"
```

### Task B4: Anchors reference scaffold (placeholder until user supplies images)

**Files:**
- Create: `packages/ui/.storybook/anchors/README.md`
- Create: `packages/ui/src/stories/Foundation/Anchors.stories.ts`

- [ ] **Step 1: Write README**

```md
# Feishu Anchor Reference Images

Drop 5–8 reference screenshots from Feishu (or your chosen Feishu-style canon) here. Suggested coverage:
- 飞书 IM 列表
- 文档 toolbar
- 日历周视图
- 审批表单
- 设置页

These images become the visual contract for "Feishu-style". Spec §5.2 references this folder.
PR-time review must compare the Storybook component with the matching anchor.
```

- [ ] **Step 2: Write Anchors story**

```ts
import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h, ref, onMounted } from 'vue'

const Anchors = defineComponent({
  name: 'AnchorViewer',
  setup() {
    const images = ref<string[]>([])
    onMounted(async () => {
      const res = await fetch('/anchors-manifest.json').catch(() => null)
      images.value = res?.ok ? await res.json() : []
    })
    return () => h('div', { class: 'flex flex-col gap-6 p-4' }, [
      h('p', { class: 'text-sm text-muted-foreground' },
        'Reference images live in .storybook/anchors. If empty, supply 5–8 screenshots and re-run Storybook.'),
      ...images.value.map(src =>
        h('img', { key: src, src, class: 'max-w-full rounded-sm border border-border' }),
      ),
    ])
  },
})

const meta: Meta<typeof Anchors> = {
  title: 'Foundation/Anchors',
  component: Anchors,
  tags: ['autodocs'],
}

export default meta

export const Reference: StoryObj<typeof Anchors> = {}
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/.storybook/anchors packages/ui/src/stories/Foundation/Anchors.stories.ts
git commit -m "feat(ui): add anchors viewer + README placeholder"
```

> User supplies anchor images in a separate non-code commit (G3 acceptance gate).

---

## Phase C — Atom Implementation (TDD per atom)

Each atom follows this rhythm: write component in `atoms/`, re-export from `components/ui/<atom>/index.ts`, add story, then unit test if required by spec §5.4.

### Task C1: `atoms/button` — primary, variants, loading, disabled-as-shade

**Files:**
- Create: `packages/ui/src/atoms/button/Button.vue`
- Create: `packages/ui/src/atoms/button/index.ts`
- Modify: `packages/ui/src/components/ui/button/index.ts` (re-export)
- Create: `packages/ui/src/stories/Atoms/Button.stories.ts`
- Create: `packages/ui/tests/Button.loading.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/ui/tests/Button.loading.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Button } from '../src/atoms/button'

describe('Button loading state', () => {
  it('renders a spinner in place of leading icon when loading=true', () => {
    const wrapper = mount(Button, {
      props: { loading: true, leadingIcon: 'check' },
      slots: { default: 'Submit' },
    })
    expect(wrapper.find('[data-testid="button-spinner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="button-leading-icon"]').exists()).toBe(false)
  })

  it('keeps the same width when toggling loading', async () => {
    const wrapper = mount(Button, {
      props: { loading: false, leadingIcon: 'check' },
      slots: { default: 'Submit' },
      attachTo: document.body,
    })
    const widthBefore = wrapper.element.getBoundingClientRect().width
    await wrapper.setProps({ loading: true })
    const widthAfter = wrapper.element.getBoundingClientRect().width
    expect(widthAfter).toBe(widthBefore)
    wrapper.unmount()
  })

  it('disables click when loading=true', async () => {
    let clicks = 0
    const wrapper = mount(Button, {
      props: { loading: true, onClick: () => { clicks += 1 } },
      slots: { default: 'Submit' },
    })
    await wrapper.trigger('click')
    expect(clicks).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/ui/tests/Button.loading.test.ts`
Expected: FAIL with `Cannot find module '../src/atoms/button'` or similar.

- [ ] **Step 3: Implement `atoms/button`**

`packages/ui/src/atoms/button/index.ts`:

```ts
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  // base — Feishu-tuned
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium '
  + 'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] '
  + 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] '
  + 'select-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:     'bg-primary text-primary-foreground hover:bg-brand-600 active:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-400',
        secondary:   'bg-gray-100 text-foreground hover:bg-gray-200 active:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400',
        outline:     'border border-input bg-card text-foreground hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200',
        ghost:       'bg-transparent text-foreground hover:bg-gray-100 active:bg-gray-200 disabled:text-gray-400',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-red-600 active:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400',
        link:        'bg-transparent text-primary underline-offset-4 hover:underline disabled:text-gray-400',
        default:     'bg-primary text-primary-foreground hover:bg-brand-600 active:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-400',
      },
      size: {
        sm:    'h-7 px-3 text-xs gap-1.5',
        md:    'h-8 px-4 text-sm',
        lg:    'h-9 px-5 text-sm',
        xl:    'h-10 px-6 text-sm',
        icon:  'h-7 w-7 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
```

`packages/ui/src/atoms/button/Button.vue`:

```vue
<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { Component, HTMLAttributes } from 'vue'
import type { ButtonVariants } from '.'
import { Loader2 } from 'lucide-vue-next'
import { Primitive } from 'reka-ui'
import { cn } from '../../utils'
import { buttonVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
  disabled?: boolean
  loading?: boolean
  leadingIcon?: Component | string
  trailingIcon?: Component | string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  loading: false,
})
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
    :disabled="disabled || loading"
    :data-loading="loading || undefined"
    :data-testid="$attrs['data-testid']"
  >
    <span v-if="loading" data-testid="button-spinner" class="inline-flex">
      <Loader2 class="size-4 animate-spin" />
    </span>
    <component
      :is="leadingIcon"
      v-else-if="leadingIcon && typeof leadingIcon !== 'string'"
      data-testid="button-leading-icon"
      class="size-4"
    />
    <slot />
    <component
      :is="trailingIcon"
      v-if="trailingIcon && typeof trailingIcon !== 'string' && !loading"
      class="size-4"
    />
  </Primitive>
</template>
```

- [ ] **Step 4: Re-export from legacy path**

Replace `packages/ui/src/components/ui/button/index.ts` with:

```ts
export * from '../../../atoms/button'
export { Button as default } from '../../../atoms/button'
```

> Note: legacy `Button.vue` file in `components/ui/button/` becomes orphaned. Delete it after re-export verifies; the re-export covers the public surface.

Run: `git rm packages/ui/src/components/ui/button/Button.vue`

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/ui/tests/Button.loading.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Add story**

`packages/ui/src/stories/Atoms/Button.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/vue3'
import { Check, Plus } from 'lucide-vue-next'
import { Button } from '../../atoms/button'

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl', 'icon'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { variant: 'primary', size: 'md', loading: false, disabled: false },
}

export default meta

type Story = StoryObj<typeof Button>

export const Default: Story = {
  render: args => ({ components: { Button }, setup: () => ({ args }), template: '<Button v-bind="args">Save</Button>' }),
}

export const Variants: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="flex flex-wrap gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="flex items-end gap-2">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button size="xl">XL</Button>
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="flex flex-wrap gap-2">
        <Button>Default</Button>
        <Button class="hover:!bg-brand-600">Hover</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </div>
    `,
  }),
}

export const WithIcon: Story = {
  render: () => ({
    components: { Button },
    setup: () => ({ Plus, Check }),
    template: `
      <div class="flex gap-2">
        <Button :leading-icon="Plus">Create</Button>
        <Button variant="outline" :trailing-icon="Check">Done</Button>
        <Button size="icon" :leading-icon="Plus" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex gap-2"><Button>Comfortable</Button><Button variant="outline">Cancel</Button></div>
        <div data-density="compact" class="flex gap-2"><Button>Compact</Button><Button variant="outline">Cancel</Button></div>
      </div>
    `,
  }),
}
```

- [ ] **Step 7: Boot Storybook and confirm**

Run: `pnpm --filter @muon/ui storybook` (background)
Visit `http://localhost:6006/?path=/story/atoms-button--default`. Confirm 6 stories render.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/atoms/button packages/ui/src/components/ui/button \
        packages/ui/tests/Button.loading.test.ts \
        packages/ui/src/stories/Atoms/Button.stories.ts
git commit -m "feat(ui): Feishu-aligned button atom with loading + 6 variants"
```

### Task C2: `atoms/input` — 32px height, double focus ring, error/success variants

**Files:**
- Create: `packages/ui/src/atoms/input/Input.vue`
- Create: `packages/ui/src/atoms/input/index.ts`
- Modify: `packages/ui/src/components/ui/input/index.ts`
- Create: `packages/ui/src/stories/Atoms/Input.stories.ts`

- [ ] **Step 1: Write `atoms/input`**

`packages/ui/src/atoms/input/index.ts`:

```ts
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Input } from './Input.vue'

export const inputVariants = cva(
  'flex w-full rounded-sm border bg-card px-3 text-sm text-foreground transition-colors '
  + 'placeholder:text-gray-400 placeholder:not-italic '
  + 'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-ring)] '
  + 'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 '
  + 'file:border-0 file:bg-transparent file:text-sm file:font-medium',
  {
    variants: {
      variant: {
        default: 'border-input focus-visible:border-primary',
        error:   'border-destructive focus-visible:border-destructive focus-visible:outline-destructive/50',
        success: 'border-green-500 focus-visible:border-green-500 focus-visible:outline-green-500/50',
      },
      size: {
        sm: 'h-7 text-xs',
        md: 'h-8',
        lg: 'h-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export type InputVariants = VariantProps<typeof inputVariants>
```

`packages/ui/src/atoms/input/Input.vue`:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { InputVariants } from '.'
import { useVModel } from '@vueuse/core'
import { cn } from '../../utils'
import { inputVariants } from '.'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  type?: string
  placeholder?: string
  disabled?: boolean
  defaultValue?: string | number
  modelValue?: string | number
  variant?: InputVariants['variant']
  size?: InputVariants['size']
}>(), {
  type: 'text',
  variant: 'default',
  size: 'md',
})

const emits = defineEmits<{ 'update:modelValue': [value: string | number] }>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input
    v-model="modelValue"
    :class="cn(inputVariants({ variant, size }), props.class)"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
  >
</template>
```

- [ ] **Step 2: Re-export from legacy path**

Replace `packages/ui/src/components/ui/input/index.ts`:

```ts
export * from '../../../atoms/input'
```

Then `git rm packages/ui/src/components/ui/input/Input.vue`.

- [ ] **Step 3: Add story**

`packages/ui/src/stories/Atoms/Input.stories.ts`:

```ts
import type { Meta, StoryObj } from '@storybook/vue3'
import { Input } from '../../atoms/input'

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'error', 'success'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
  args: { variant: 'default', size: 'md', disabled: false, placeholder: 'Type here' },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  render: args => ({ components: { Input }, setup: () => ({ args }), template: '<Input v-bind="args" class="w-64" />' }),
}

export const Variants: Story = {
  render: () => ({
    components: { Input },
    template: `
      <div class="flex flex-col gap-2 w-64">
        <Input placeholder="Default" />
        <Input variant="error" placeholder="Error" />
        <Input variant="success" placeholder="Success" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Input },
    template: `
      <div class="flex flex-col gap-2 w-64">
        <Input size="sm" placeholder="Small" />
        <Input size="md" placeholder="Medium" />
        <Input size="lg" placeholder="Large" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { Input },
    template: `
      <div class="flex flex-col gap-2 w-64">
        <Input placeholder="Default" />
        <Input placeholder="Disabled" disabled />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Input },
    template: `
      <div class="flex flex-col gap-3 w-64">
        <Input placeholder="Comfortable" />
        <div data-density="compact"><Input placeholder="Compact" /></div>
      </div>
    `,
  }),
}
```

- [ ] **Step 4: Boot Storybook**

Visit `Atoms/Input`. Confirm 5 stories render.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/atoms/input packages/ui/src/components/ui/input \
        packages/ui/src/stories/Atoms/Input.stories.ts
git commit -m "feat(ui): Feishu-aligned input atom with size + variant"
```

### Task C3: `atoms/textarea`

**Files:**
- Create: `packages/ui/src/atoms/textarea/{Textarea.vue,index.ts}`
- Modify: `packages/ui/src/components/ui/textarea/index.ts`
- Create: `packages/ui/src/stories/Atoms/Textarea.stories.ts`

- [ ] **Step 1: Implement** (mirrors Input pattern, no fixed height)

`packages/ui/src/atoms/textarea/index.ts`:

```ts
export { default as Textarea } from './Textarea.vue'
```

`packages/ui/src/atoms/textarea/Textarea.vue`:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  placeholder?: string
  disabled?: boolean
  defaultValue?: string
  modelValue?: string
  rows?: number
  variant?: 'default' | 'error' | 'success'
}>(), {
  variant: 'default',
  rows: 3,
})

const emits = defineEmits<{ 'update:modelValue': [value: string] }>()
const modelValue = useVModel(props, 'modelValue', emits, { passive: true, defaultValue: props.defaultValue })

const variantClass = {
  default: 'border-input focus-visible:border-primary',
  error:   'border-destructive focus-visible:border-destructive focus-visible:outline-destructive/50',
  success: 'border-green-500 focus-visible:border-green-500 focus-visible:outline-green-500/50',
}
</script>

<template>
  <textarea
    v-model="modelValue"
    :class="cn(
      'flex w-full rounded-sm border bg-card px-3 py-2 text-sm text-foreground transition-colors',
      'placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-ring)]',
      'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200',
      variantClass[props.variant],
      props.class,
    )"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
  />
</template>
```

- [ ] **Step 2: Re-export legacy path**

Replace `packages/ui/src/components/ui/textarea/index.ts` with `export * from '../../../atoms/textarea'`. Then `git rm packages/ui/src/components/ui/textarea/Textarea.vue`.

- [ ] **Step 3: Add story** (mirrors Input.stories shape; produce 5 stories: Default/Variants/Rows/States/Density). Use the shape from Task C2 step 3 as a template — every story renders `<Textarea>` with the relevant props.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/atoms/textarea packages/ui/src/components/ui/textarea \
        packages/ui/src/stories/Atoms/Textarea.stories.ts
git commit -m "feat(ui): Feishu-aligned textarea atom"
```

### Task C4: `atoms/badge` — radius-xs, weight 500, six tones × three styles

**Files:**
- Create: `packages/ui/src/atoms/badge/{Badge.vue,index.ts}`
- Modify: `packages/ui/src/components/ui/badge/index.ts`
- Create: `packages/ui/src/stories/Atoms/Badge.stories.ts`

- [ ] **Step 1: Implement**

`packages/ui/src/atoms/badge/index.ts`:

```ts
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Badge } from './Badge.vue'

export const badgeVariants = cva(
  'inline-flex items-center rounded-xs px-1.5 py-0.5 text-xs font-medium leading-none transition-colors',
  {
    variants: {
      tone: {
        neutral: '',
        brand:   '',
        success: '',
        warning: '',
        danger:  '',
        info:    '',
      },
      style: {
        solid:   '',
        subtle:  '',
        outline: 'border bg-transparent',
      },
    },
    compoundVariants: [
      { tone: 'neutral', style: 'solid', class: 'bg-gray-700 text-white' },
      { tone: 'neutral', style: 'subtle', class: 'bg-gray-100 text-gray-700' },
      { tone: 'neutral', style: 'outline', class: 'border-gray-300 text-gray-700' },
      { tone: 'brand',   style: 'solid', class: 'bg-brand-500 text-white' },
      { tone: 'brand',   style: 'subtle', class: 'bg-brand-50 text-brand-700' },
      { tone: 'brand',   style: 'outline', class: 'border-brand-500 text-brand-600' },
      { tone: 'success', style: 'solid', class: 'bg-green-500 text-white' },
      { tone: 'success', style: 'subtle', class: 'bg-green-50 text-green-700' },
      { tone: 'success', style: 'outline', class: 'border-green-500 text-green-600' },
      { tone: 'warning', style: 'solid', class: 'bg-orange-500 text-white' },
      { tone: 'warning', style: 'subtle', class: 'bg-orange-50 text-orange-700' },
      { tone: 'warning', style: 'outline', class: 'border-orange-500 text-orange-700' },
      { tone: 'danger',  style: 'solid', class: 'bg-red-500 text-white' },
      { tone: 'danger',  style: 'subtle', class: 'bg-red-50 text-red-700' },
      { tone: 'danger',  style: 'outline', class: 'border-red-500 text-red-600' },
      { tone: 'info',    style: 'solid', class: 'bg-cyan-500 text-white' },
      { tone: 'info',    style: 'subtle', class: 'bg-cyan-50 text-cyan-700' },
      { tone: 'info',    style: 'outline', class: 'border-cyan-500 text-cyan-700' },
    ],
    defaultVariants: { tone: 'neutral', style: 'subtle' },
  },
)

export type BadgeVariants = VariantProps<typeof badgeVariants>
```

`packages/ui/src/atoms/badge/Badge.vue`:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { BadgeVariants } from '.'
import { cn } from '../../utils'
import { badgeVariants } from '.'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  tone?: BadgeVariants['tone']
  style?: BadgeVariants['style']
}>(), { tone: 'neutral', style: 'subtle' })
</script>

<template>
  <span :class="cn(badgeVariants({ tone, style: props.style }), props.class)">
    <slot />
  </span>
</template>
```

- [ ] **Step 2: Migrate legacy `variant` prop**

The old badge uses `variant` (default/secondary/destructive/outline). Provide compat shim — append to `packages/ui/src/components/ui/badge/index.ts`:

```ts
export * from '../../../atoms/badge'

import { badgeVariants as atomBadgeVariants } from '../../../atoms/badge'
export const badgeVariants = atomBadgeVariants
```

> Existing app code that uses `<Badge variant="secondary">` will break with this change. After committing the atom, run a follow-up task to grep/migrate app callsites — covered in Task C13.

Then `git rm packages/ui/src/components/ui/badge/Badge.vue`.

- [ ] **Step 3: Add story** (6 stories: Default, Tones, Styles, Sizes-via-padding, States [hover/disabled is N/A — show with-icon variant], Density). Story file shape mirrors Button.stories.ts.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/atoms/badge packages/ui/src/components/ui/badge \
        packages/ui/src/stories/Atoms/Badge.stories.ts
git commit -m "feat(ui): Feishu-aligned badge atom with tone × style matrix"
```

### Task C5: `atoms/avatar` — square default, new size scale, presence dot

**Files:**
- Create: `packages/ui/src/atoms/avatar/{Avatar.vue,index.ts}`
- Modify: `packages/ui/src/components/ui/avatar/index.ts`
- Create: `packages/ui/src/stories/Atoms/Avatar.stories.ts`

- [ ] **Step 1: Implement** (port the existing 250-line Avatar.vue but adjust size scale & default shape)

Copy `packages/ui/src/components/ui/avatar/Avatar.vue` to `packages/ui/src/atoms/avatar/Avatar.vue`. Inside, change:

```ts
// before
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
const SIZE_PX: Record<AvatarSize, number> = { xs: 20, sm: 32, md: 40, lg: 48, xl: 80, '2xl': 96 }
const SIZE_CLASSES: Record<AvatarSize, string> = {
  'xs': 'h-5 w-5 text-[8px]',
  'sm': 'h-8 w-8 text-[11px]',
  'md': 'h-10 w-10 text-sm',
  'lg': 'h-12 w-12 text-base',
  'xl': 'h-20 w-20 text-2xl',
  '2xl': 'h-24 w-24 text-3xl',
}
```

to (Spec §4.1 sizes):

```ts
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
const SIZE_PX: Record<AvatarSize, number> = { xs: 20, sm: 24, md: 32, lg: 40, xl: 56 }
const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[8px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-14 w-14 text-base',
}
```

And change default `shape` from `circle` to `rounded`. Update SHAPE_CLASSES so `rounded: 'rounded-sm'` (4px) and `circle: 'rounded-full'`.

`packages/ui/src/atoms/avatar/index.ts`:

```ts
export { default as Avatar } from './Avatar.vue'
export type { AvatarPresence, AvatarShape, AvatarSize } from './Avatar.vue'
```

- [ ] **Step 2: Re-export from legacy path**

Replace `packages/ui/src/components/ui/avatar/index.ts`:

```ts
export * from '../../../atoms/avatar'
```

Then `git rm packages/ui/src/components/ui/avatar/Avatar.vue`.

- [ ] **Step 3: Identify consumer breakage**

Run: `grep -rEn "Avatar\\b.*size=['\"]?2xl|size=['\"]?xl" src/ apps/ tests/ 2>/dev/null`
Expected: zero or a small list. The size scale changed `xl(80)` → `xl(56)` and removed `2xl`. For each hit, decide if `lg(40)` or `xl(56)` is the right new value.

> If hits exist, fix them in this task (each is a 1-line prop change). Stay scoped — don't refactor surrounding code.

- [ ] **Step 4: Update existing test fixture**

`tests/components/Avatar.test.ts` references `size: 'xs'` with classes `h-7 w-7` (custom override). The xs token is still 20px — `h-5 w-5`. Test passes a custom class so it still works. Re-run:
Run: `pnpm test:unit -- Avatar.test`
Expected: pass.

- [ ] **Step 5: Add story** (6 stories: Default/Sizes/Shapes/Presence/WithFallback/Density)

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/atoms/avatar packages/ui/src/components/ui/avatar \
        packages/ui/src/stories/Atoms/Avatar.stories.ts
# include any consumer fixes from Step 3
git commit -m "feat(ui): Feishu-aligned avatar with new size scale + square default"
```

### Task C6: `atoms/icon` — wrapper around lucide for sized rendering

**Files:**
- Create: `packages/ui/src/atoms/icon/{Icon.vue,index.ts}`
- Create: `packages/ui/src/stories/Atoms/Icon.stories.ts`

> Note: there is no legacy `components/ui/icon` to merge — this is a new wrapper. App code that uses lucide-vue-next directly continues to work.

- [ ] **Step 1: Implement**

`packages/ui/src/atoms/icon/index.ts`:

```ts
export { default as Icon } from './Icon.vue'
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
```

`packages/ui/src/atoms/icon/Icon.vue`:

```vue
<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  as: Component
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  class?: HTMLAttributes['class']
  ariaLabel?: string
}>(), { size: 'md' })

const SIZE: Record<string, string> = {
  xs: 'size-3',     // 12
  sm: 'size-3.5',   // 14
  md: 'size-4',     // 16
  lg: 'size-5',     // 20
  xl: 'size-6',     // 24
}
</script>

<template>
  <component
    :is="as"
    :class="cn(SIZE[size], 'shrink-0 stroke-[1.5]', props.class)"
    :aria-label="ariaLabel"
    :aria-hidden="ariaLabel ? undefined : true"
  />
</template>
```

- [ ] **Step 2: Add story** (Default/Sizes/Colors[via class]/Stroke/States[hover via parent button]/Density)

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/atoms/icon packages/ui/src/stories/Atoms/Icon.stories.ts
git commit -m "feat(ui): icon atom — sized wrapper around lucide"
```

### Task C7: `atoms/separator`

**Files:**
- Create: `packages/ui/src/atoms/separator/{Separator.vue,index.ts}`
- Modify: `packages/ui/src/components/ui/separator/index.ts`
- Create: `packages/ui/src/stories/Atoms/Separator.stories.ts`

- [ ] **Step 1: Implement**

`packages/ui/src/atoms/separator/index.ts`:

```ts
export { default as Separator } from './Separator.vue'
```

`packages/ui/src/atoms/separator/Separator.vue`:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils'

withDefaults(defineProps<{
  orientation?: 'horizontal' | 'vertical'
  inset?: boolean
  class?: HTMLAttributes['class']
}>(), { orientation: 'horizontal', inset: false })
</script>

<template>
  <div
    role="separator"
    :aria-orientation="orientation"
    :class="cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      inset && (orientation === 'horizontal' ? 'ml-3' : 'mt-3'),
      $attrs.class as any,
    )"
  />
</template>
```

- [ ] **Step 2: Re-export legacy path**

Replace `packages/ui/src/components/ui/separator/index.ts` with `export * from '../../../atoms/separator'`. `git rm packages/ui/src/components/ui/separator/Separator.vue`.

- [ ] **Step 3: Add story** (Default/Horizontal/Vertical/Inset/Density - 5 stories)

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/atoms/separator packages/ui/src/components/ui/separator \
        packages/ui/src/stories/Atoms/Separator.stories.ts
git commit -m "feat(ui): separator atom with inset variant"
```

### Task C8: `atoms/kbd` — new, with macOS symbol mapping (TDD)

**Files:**
- Create: `packages/ui/src/atoms/kbd/{Kbd.vue,index.ts}`
- Create: `packages/ui/tests/Kbd.platform.test.ts`
- Create: `packages/ui/src/stories/Atoms/Kbd.stories.ts`
- Modify: `packages/ui/package.json` (exports)

- [ ] **Step 1: Write the failing test**

`packages/ui/tests/Kbd.platform.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { Kbd } from '../src/atoms/kbd'

describe('Kbd platform symbols', () => {
  it('renders Cmd as ⌘ on macOS', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    const wrapper = mount(Kbd, { props: { keys: ['Cmd', 'K'] } })
    expect(wrapper.text()).toContain('⌘')
    expect(wrapper.text()).toContain('K')
  })

  it('renders Cmd as Ctrl on non-macOS', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' })
    const wrapper = mount(Kbd, { props: { keys: ['Cmd', 'K'] } })
    expect(wrapper.text()).toContain('Ctrl')
    expect(wrapper.text()).toContain('K')
  })

  it('maps Shift, Alt, Enter, Esc symbols on macOS', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    const wrapper = mount(Kbd, { props: { keys: ['Shift', 'Alt', 'Enter', 'Esc'] } })
    const text = wrapper.text()
    expect(text).toContain('⇧')
    expect(text).toContain('⌥')
    expect(text).toContain('⏎')
    expect(text).toContain('⎋')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/ui/tests/Kbd.platform.test.ts`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement**

`packages/ui/src/atoms/kbd/index.ts`:

```ts
export { default as Kbd } from './Kbd.vue'
```

`packages/ui/src/atoms/kbd/Kbd.vue`:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  keys: string[]
  size?: 'sm' | 'md'
  class?: HTMLAttributes['class']
}>(), { size: 'md' })

const isMac = computed(() => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
})

const SYMBOLS_MAC: Record<string, string> = {
  Cmd: '⌘', Meta: '⌘', Ctrl: '⌃', Alt: '⌥', Option: '⌥', Shift: '⇧',
  Enter: '⏎', Return: '⏎', Esc: '⎋', Escape: '⎋', Tab: '⇥', Backspace: '⌫',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
}
const SYMBOLS_OTHER: Record<string, string> = {
  Cmd: 'Ctrl', Meta: 'Win',
  Enter: 'Enter', Return: 'Enter', Esc: 'Esc', Escape: 'Esc',
}

function display(k: string): string {
  return isMac.value ? (SYMBOLS_MAC[k] ?? k) : (SYMBOLS_OTHER[k] ?? SYMBOLS_MAC[k] ?? k)
}

const sizeClass = computed(() => props.size === 'sm' ? 'h-5 px-1 text-[10px]' : 'h-6 px-1.5 text-xs')
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <kbd
      v-for="(k, i) in keys"
      :key="i"
      :class="cn(
        'inline-flex items-center justify-center rounded-sm border border-gray-300 bg-gray-100 font-mono text-gray-700',
        sizeClass,
        props.class,
      )"
    >{{ display(k) }}</kbd>
  </span>
</template>
```

- [ ] **Step 4: Add `kbd` to package exports**

In `packages/ui/package.json` `exports`, add:

```json
"./kbd": "./src/atoms/kbd/index.ts"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/ui/tests/Kbd.platform.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Add story** (Default/Combos/macSymbols/Sizes/Density — 5 stories. Use `Cmd+K`, `Shift+Enter`, etc.)

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/atoms/kbd packages/ui/tests/Kbd.platform.test.ts \
        packages/ui/src/stories/Atoms/Kbd.stories.ts packages/ui/package.json
git commit -m "feat(ui): kbd atom with macOS-aware symbol mapping"
```

### Task C9: `atoms/spinner`

**Files:**
- Create: `packages/ui/src/atoms/spinner/{Spinner.vue,index.ts}`
- Create: `packages/ui/src/stories/Atoms/Spinner.stories.ts`
- Modify: `packages/ui/package.json` (exports)

- [ ] **Step 1: Implement**

`packages/ui/src/atoms/spinner/index.ts`:

```ts
export { default as Spinner } from './Spinner.vue'
```

`packages/ui/src/atoms/spinner/Spinner.vue`:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  class?: HTMLAttributes['class']
  label?: string
}>(), { size: 'md', label: 'Loading' })

const SIZE: Record<string, string> = {
  xs: 'size-3 border-[1.5px]',
  sm: 'size-3.5 border-[1.5px]',
  md: 'size-4 border-2',
  lg: 'size-5 border-2',
  xl: 'size-6 border-[2.5px]',
}
</script>

<template>
  <span
    role="status"
    :aria-label="label"
    :class="cn(
      'inline-block rounded-full animate-spin',
      'border-current border-t-transparent',
      SIZE[size],
      props.class,
    )"
    style="animation-duration: 0.9s"
  />
</template>
```

- [ ] **Step 2: Add `spinner` to package exports**

In `packages/ui/package.json` `exports`, add `"./spinner": "./src/atoms/spinner/index.ts"`.

- [ ] **Step 3: Add story**

5 stories: Default/Sizes/Colors[via text-color]/InsideButton/Density.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/atoms/spinner packages/ui/src/stories/Atoms/Spinner.stories.ts packages/ui/package.json
git commit -m "feat(ui): spinner atom"
```

### Task C10: `atoms/switch` — TDD controlled/uncontrolled

**Files:**
- Create: `packages/ui/src/atoms/switch/{Switch.vue,index.ts}`
- Modify: `packages/ui/src/components/ui/switch/index.ts`
- Create: `packages/ui/tests/Switch.controlled.test.ts`
- Create: `packages/ui/src/stories/Atoms/Switch.stories.ts`

- [ ] **Step 1: Write the failing test**

`packages/ui/tests/Switch.controlled.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Switch } from '../src/atoms/switch'

describe('Switch controlled / uncontrolled', () => {
  it('uncontrolled: toggles internal state on click', async () => {
    const wrapper = mount(Switch, { props: { defaultChecked: false } })
    const btn = wrapper.find('button')
    expect(btn.attributes('aria-checked')).toBe('false')
    await btn.trigger('click')
    expect(btn.attributes('aria-checked')).toBe('true')
  })

  it('controlled: emits update:modelValue and respects parent state', async () => {
    const wrapper = mount(Switch, { props: { modelValue: false } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    // Without parent flipping the prop, aria-checked stays false
    expect(wrapper.find('button').attributes('aria-checked')).toBe('false')
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.find('button').attributes('aria-checked')).toBe('true')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/ui/tests/Switch.controlled.test.ts`
Expected: FAIL with `Cannot find module '../src/atoms/switch'`.

- [ ] **Step 3: Implement**

`packages/ui/src/atoms/switch/index.ts`:

```ts
export { default as Switch } from './Switch.vue'
```

`packages/ui/src/atoms/switch/Switch.vue`:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  modelValue?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  class?: HTMLAttributes['class']
}>(), { size: 'md' })

const emits = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const SIZE_ROOT: Record<string, string> = {
  sm: 'h-3.5 w-6 [&[data-state=checked]>span]:translate-x-2.5',
  md: 'h-4 w-7 [&[data-state=checked]>span]:translate-x-3',
}
const SIZE_THUMB: Record<string, string> = {
  sm: 'size-3',
  md: 'size-3.5',
}
</script>

<template>
  <SwitchRoot
    :model-value="modelValue"
    :default-value="defaultChecked"
    :disabled="disabled"
    :class="cn(
      'inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-300',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]',
      SIZE_ROOT[size],
      props.class,
    )"
    @update:model-value="(v: boolean) => emits('update:modelValue', v)"
  >
    <SwitchThumb
      :class="cn(
        'pointer-events-none block translate-x-0.5 rounded-full bg-white shadow-sm transition-transform',
        SIZE_THUMB[size],
      )"
    />
  </SwitchRoot>
</template>
```

- [ ] **Step 4: Re-export legacy path**

Replace `packages/ui/src/components/ui/switch/index.ts` with `export * from '../../../atoms/switch'`. `git rm packages/ui/src/components/ui/switch/Switch.vue`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/ui/tests/Switch.controlled.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Add story** (Default/Sizes/States[off, on, disabled]/Controlled/Density)

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/atoms/switch packages/ui/src/components/ui/switch \
        packages/ui/tests/Switch.controlled.test.ts \
        packages/ui/src/stories/Atoms/Switch.stories.ts
git commit -m "feat(ui): switch atom with gray-300 off / brand-500 on"
```

### Task C11: `atoms/checkbox` — TDD controlled/uncontrolled + indeterminate

**Files:**
- Create: `packages/ui/src/atoms/checkbox/{Checkbox.vue,index.ts}`
- Modify: `packages/ui/src/components/ui/checkbox/index.ts`
- Create: `packages/ui/tests/Checkbox.controlled.test.ts`
- Create: `packages/ui/src/stories/Atoms/Checkbox.stories.ts`

- [ ] **Step 1: Write the failing test**

`packages/ui/tests/Checkbox.controlled.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Checkbox } from '../src/atoms/checkbox'

describe('Checkbox controlled / uncontrolled', () => {
  it('uncontrolled: toggles on click', async () => {
    const wrapper = mount(Checkbox, { props: { defaultChecked: false } })
    expect(wrapper.find('button').attributes('aria-checked')).toBe('false')
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('button').attributes('aria-checked')).toBe('true')
  })

  it('controlled: emits update:modelValue without flipping local state', async () => {
    const wrapper = mount(Checkbox, { props: { modelValue: false } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    expect(wrapper.find('button').attributes('aria-checked')).toBe('false')
  })

  it('renders indeterminate as horizontal bar (no question mark)', () => {
    const wrapper = mount(Checkbox, { props: { modelValue: 'indeterminate' } })
    expect(wrapper.find('[data-testid="checkbox-indeterminate"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('?')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/ui/tests/Checkbox.controlled.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`packages/ui/src/atoms/checkbox/index.ts`:

```ts
export { default as Checkbox } from './Checkbox.vue'
```

`packages/ui/src/atoms/checkbox/Checkbox.vue`:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CheckboxRoot, CheckboxIndicator } from 'reka-ui'
import { Check } from 'lucide-vue-next'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  modelValue?: boolean | 'indeterminate'
  defaultChecked?: boolean | 'indeterminate'
  disabled?: boolean
  size?: 'sm' | 'md'
  class?: HTMLAttributes['class']
}>(), { size: 'md' })

const emits = defineEmits<{ 'update:modelValue': [value: boolean | 'indeterminate'] }>()

const SIZE: Record<string, string> = {
  sm: 'size-3.5',
  md: 'size-4',
}
</script>

<template>
  <CheckboxRoot
    :model-value="modelValue"
    :default-value="defaultChecked"
    :disabled="disabled"
    :class="cn(
      'inline-flex shrink-0 items-center justify-center rounded-xs border border-gray-300 bg-card transition-colors',
      'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
      'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary',
      'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-200',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]',
      SIZE[size],
      props.class,
    )"
    @update:model-value="(v: boolean | 'indeterminate') => emits('update:modelValue', v)"
  >
    <CheckboxIndicator class="flex items-center justify-center text-white">
      <Check v-if="modelValue === true" class="size-3 stroke-[2.5]" />
      <span v-else-if="modelValue === 'indeterminate'" data-testid="checkbox-indeterminate" class="block h-0.5 w-2 bg-white" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
```

- [ ] **Step 4: Re-export legacy path**

Replace `packages/ui/src/components/ui/checkbox/index.ts` with `export * from '../../../atoms/checkbox'`. `git rm packages/ui/src/components/ui/checkbox/Checkbox.vue`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/ui/tests/Checkbox.controlled.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Add story** (Default/Sizes/States[unchecked/checked/indeterminate/disabled]/Controlled/Density — 5 stories)

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/atoms/checkbox packages/ui/src/components/ui/checkbox \
        packages/ui/tests/Checkbox.controlled.test.ts \
        packages/ui/src/stories/Atoms/Checkbox.stories.ts
git commit -m "feat(ui): checkbox atom with horizontal-bar indeterminate"
```

### Task C12: `atoms/radio` — new, TDD controlled/uncontrolled

**Files:**
- Create: `packages/ui/src/atoms/radio/{Radio.vue,RadioGroup.vue,index.ts}`
- Create: `packages/ui/tests/Radio.controlled.test.ts`
- Create: `packages/ui/src/stories/Atoms/Radio.stories.ts`
- Modify: `packages/ui/package.json` (exports)

- [ ] **Step 1: Write the failing test**

`packages/ui/tests/Radio.controlled.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { RadioGroup, Radio } from '../src/atoms/radio'

describe('Radio controlled / uncontrolled', () => {
  it('uncontrolled: clicking sets checked', async () => {
    const wrapper = mount({
      components: { RadioGroup, Radio },
      template: `
        <RadioGroup>
          <Radio value="a" data-testid="a" />
          <Radio value="b" data-testid="b" />
        </RadioGroup>
      `,
    })
    await wrapper.get('[data-testid="b"]').trigger('click')
    expect(wrapper.get('[data-testid="b"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="a"]').attributes('aria-checked')).toBe('false')
  })

  it('controlled: emits update:modelValue and waits for parent', async () => {
    const updates: string[] = []
    const wrapper = mount({
      components: { RadioGroup, Radio },
      data: () => ({ value: 'a' }),
      methods: { onUpdate(v: string) { updates.push(v) } },
      template: `
        <RadioGroup :model-value="value" @update:model-value="onUpdate">
          <Radio value="a" data-testid="a" />
          <Radio value="b" data-testid="b" />
        </RadioGroup>
      `,
    })
    await wrapper.get('[data-testid="b"]').trigger('click')
    expect(updates).toEqual(['b'])
    // local state still 'a' until parent updates
    expect(wrapper.get('[data-testid="a"]').attributes('aria-checked')).toBe('true')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/ui/tests/Radio.controlled.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`packages/ui/src/atoms/radio/index.ts`:

```ts
export { default as Radio } from './Radio.vue'
export { default as RadioGroup } from './RadioGroup.vue'
```

`packages/ui/src/atoms/radio/RadioGroup.vue`:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { RadioGroupRoot } from 'reka-ui'
import { cn } from '../../utils'

const props = defineProps<{
  modelValue?: string
  defaultValue?: string
  disabled?: boolean
  class?: HTMLAttributes['class']
}>()

const emits = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <RadioGroupRoot
    :model-value="modelValue"
    :default-value="defaultValue"
    :disabled="disabled"
    :class="cn('flex flex-col gap-2', props.class)"
    @update:model-value="(v) => v && emits('update:modelValue', v)"
  >
    <slot />
  </RadioGroupRoot>
</template>
```

`packages/ui/src/atoms/radio/Radio.vue`:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { RadioGroupItem, RadioGroupIndicator } from 'reka-ui'
import { cn } from '../../utils'

const props = withDefaults(defineProps<{
  value: string
  size?: 'sm' | 'md'
  class?: HTMLAttributes['class']
}>(), { size: 'md' })

const SIZE: Record<string, string> = {
  sm: 'size-3.5',
  md: 'size-4',
}
const DOT_SIZE: Record<string, string> = {
  sm: 'size-1.5',
  md: 'size-1.5',
}
</script>

<template>
  <RadioGroupItem
    :value="value"
    :class="cn(
      'inline-flex shrink-0 items-center justify-center rounded-full border border-gray-300 bg-card transition-colors',
      'data-[state=checked]:border-primary',
      'disabled:cursor-not-allowed disabled:bg-gray-100',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]',
      SIZE[size],
      props.class,
    )"
  >
    <RadioGroupIndicator :class="cn('rounded-full bg-primary', DOT_SIZE[size])" />
  </RadioGroupItem>
</template>
```

- [ ] **Step 4: Add `radio` to exports**

In `packages/ui/package.json` exports, add `"./radio": "./src/atoms/radio/index.ts"`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/ui/tests/Radio.controlled.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Add story** (Default/Group/Sizes/Disabled/Controlled — 5 stories)

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/atoms/radio packages/ui/tests/Radio.controlled.test.ts \
        packages/ui/src/stories/Atoms/Radio.stories.ts packages/ui/package.json
git commit -m "feat(ui): radio + radio-group atoms with controlled/uncontrolled"
```

### Task C13: Migrate badge `variant` callsites in app

**Files:**
- Search across: `src/`, `apps/`

- [ ] **Step 1: Find usages**

Run: `grep -rEn 'Badge[^>]*variant=' src/ apps/`
Expected: list of files using the old badge `variant` prop.

- [ ] **Step 2: Map old variants to new tone/style**

| Old | New |
|---|---|
| `variant="default"` | `tone="brand" style="solid"` |
| `variant="secondary"` | `tone="neutral" style="subtle"` |
| `variant="destructive"` | `tone="danger" style="solid"` |
| `variant="outline"` | `tone="neutral" style="outline"` |

For each match, edit the prop. Preserve all other props/classes.

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: no errors.

- [ ] **Step 4: Run unit tests**

Run: `pnpm test:unit`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add -u src apps
git commit -m "refactor(app): migrate Badge variant -> tone/style"
```

---

## Phase D — Visual Regression Baseline

Stand up Playwright against Storybook so each story becomes a snapshot.

### Task D1: Add Storybook test runner / Playwright config

**Files:**
- Create: `packages/ui/playwright.config.ts`
- Create: `packages/ui/tests/visual/atoms.visual.spec.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Add deps**

Run: `pnpm --filter @muon/ui add -D @playwright/test http-server wait-on`
Expected: deps added.

- [ ] **Step 2: Write `playwright.config.ts`**

`packages/ui/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  snapshotDir: './tests/visual/__screenshots__',
  retries: 0,
  use: {
    baseURL: 'http://localhost:6006',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  },
  projects: [
    { name: 'chromium-light', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
      },
    },
  ],
  webServer: {
    command: 'pnpm build-storybook && pnpm exec http-server storybook-static -p 6006 -s',
    url: 'http://localhost:6006',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- [ ] **Step 3: Write the visual spec runner**

`packages/ui/tests/visual/atoms.visual.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const stories = [
  'foundation-tokens--palette',
  'atoms-button--default', 'atoms-button--variants', 'atoms-button--sizes',
  'atoms-button--states', 'atoms-button--with-icon', 'atoms-button--density',
  'atoms-input--default', 'atoms-input--variants', 'atoms-input--sizes',
  'atoms-input--states', 'atoms-input--density',
  'atoms-textarea--default', 'atoms-textarea--variants',
  'atoms-textarea--rows', 'atoms-textarea--states', 'atoms-textarea--density',
  'atoms-badge--default', 'atoms-badge--tones', 'atoms-badge--styles',
  'atoms-badge--sizes', 'atoms-badge--with-icon', 'atoms-badge--density',
  'atoms-avatar--default', 'atoms-avatar--sizes', 'atoms-avatar--shapes',
  'atoms-avatar--presence', 'atoms-avatar--with-fallback', 'atoms-avatar--density',
  'atoms-icon--default', 'atoms-icon--sizes', 'atoms-icon--colors',
  'atoms-icon--stroke', 'atoms-icon--states', 'atoms-icon--density',
  'atoms-separator--default', 'atoms-separator--horizontal',
  'atoms-separator--vertical', 'atoms-separator--inset', 'atoms-separator--density',
  'atoms-kbd--default', 'atoms-kbd--combos', 'atoms-kbd--mac-symbols',
  'atoms-kbd--sizes', 'atoms-kbd--density',
  'atoms-spinner--default', 'atoms-spinner--sizes', 'atoms-spinner--colors',
  'atoms-spinner--inside-button', 'atoms-spinner--density',
  'atoms-switch--default', 'atoms-switch--sizes', 'atoms-switch--states',
  'atoms-switch--controlled', 'atoms-switch--density',
  'atoms-checkbox--default', 'atoms-checkbox--sizes', 'atoms-checkbox--states',
  'atoms-checkbox--controlled', 'atoms-checkbox--density',
  'atoms-radio--default', 'atoms-radio--group', 'atoms-radio--sizes',
  'atoms-radio--disabled', 'atoms-radio--controlled',
] as const

for (const id of stories) {
  test(id, async ({ page }) => {
    await page.goto(`/iframe.html?id=${id}&viewMode=story`)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot(`${id}.png`, { maxDiffPixelRatio: 0.001 })
  })
}
```

- [ ] **Step 4: Add scripts**

In `packages/ui/package.json` `scripts`, add:

```json
"test:visual": "playwright test",
"test:visual:update": "playwright test --update-snapshots"
```

- [ ] **Step 5: Generate baseline**

Run: `pnpm --filter @muon/ui test:visual:update`
Expected: snapshots written under `packages/ui/tests/visual/__screenshots__/`. Some stories may fail to match selectors — use the run report to fix story IDs (Storybook normalises titles to kebab-case).

- [ ] **Step 6: Re-run to confirm green**

Run: `pnpm --filter @muon/ui test:visual`
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/playwright.config.ts packages/ui/tests/visual packages/ui/package.json
git commit -m "feat(ui): Playwright visual regression baseline against Storybook"
```

---

## Phase E — Acceptance Gate Run

Run each spec §5.1 gate end-to-end.

### Task E1: Run G1 + G7 (token completeness + types/build)

- [ ] **Step 1: G1 — token check**

Run: `pnpm --filter @muon/ui check:tokens`
Expected: `Token completeness check PASSED`. Fix any reported gaps before continuing.

- [ ] **Step 2: G7 — types**

Run: `pnpm type-check`
Expected: no errors.

- [ ] **Step 3: G7 — build**

Run: `pnpm build`
Expected: success.

- [ ] **Step 4: Commit nothing**

These are verification steps. No commit unless fixes were needed (those would be committed in their own task).

### Task E2: Run G2 + G4 + G8 (Storybook coverage + visual regression light & dark)

- [ ] **Step 1: G2 — coverage check**

Run: `pnpm --filter @muon/ui storybook --ci & sleep 8 && curl -sf http://localhost:6006/index.json | jq '.entries | keys | length'`
Expected: at least 60 (12 atoms × ≥5 stories + 2 foundation stories). Stop the bg storybook after.

- [ ] **Step 2: G4/G8 — visual regression in both themes**

Run: `pnpm --filter @muon/ui test:visual`
Expected: all snapshots green for both `chromium-light` and `chromium-dark`.

- [ ] **Step 3: Commit nothing** (unless fixes were needed).

### Task E3: Run G3 — anchors check

- [ ] **Step 1: Verify anchors directory**

Run: `ls packages/ui/.storybook/anchors`
Expected: 5–8 PNG/JPG files supplied by the user. If empty, this gate is BLOCKED — coordinate with the user to supply images, then re-run.

- [ ] **Step 2: Boot Storybook and visually confirm**

Run: `pnpm --filter @muon/ui storybook` (background)
Visit `http://localhost:6006/?path=/story/foundation-anchors--reference`. Verify all 5–8 images render.

- [ ] **Step 3: Stop background storybook**

### Task E4: Run G5 — Feishu-style checklist

- [ ] **Step 1: Open the spec checklist**

Open `docs/superpowers/specs/2026-05-07-feishu-design-system-foundation-design.md` §7 (30 lines).

- [ ] **Step 2: Walk through Storybook story-by-story**

For each line, verify in the corresponding Storybook story or token file. Mark any failures as P0 issues; fix in their own follow-up tasks before claiming completion. Do not silently mark items as passing.

- [ ] **Step 3: Record completion**

Write a short note `packages/ui/.storybook/CHECKLIST.md` with date, who walked it, and outcome.

- [ ] **Step 4: Commit checklist record**

```bash
git add packages/ui/.storybook/CHECKLIST.md
git commit -m "chore(ui): record G5 Feishu-style checklist walk"
```

### Task E5: Run G6 — desktop app smoke test

- [ ] **Step 1: Build and boot**

Run: `pnpm build:contracts && pnpm build:rich-text && pnpm dev:desktop`
Expected: Electron app boots.

- [ ] **Step 2: Walk routes**

Visit each: `/dm`, `/dm/<existing room>`, `/contacts`, `/calendar`, `/docs`, `/workplace`, `/approvals`, `/email`, `/calls`, `/projects`, `/settings`. Confirm no overlap, no overflow, no dead clicks. Token-driven changes (smaller body text, denser controls, sharper corners) are expected and OK.

- [ ] **Step 3: Toggle theme**

In the desktop UI, switch light → dark → light. Confirm no contrast collapses or invisible text.

- [ ] **Step 4: If failures found, write P0 fix tasks**

For each functional regression (e.g., overlapping elements at 14px body), open a follow-up task. Do not patch ad-hoc.

- [ ] **Step 5: Commit smoke-test record**

Append to `packages/ui/.storybook/CHECKLIST.md`:

```md
## G6 desktop smoke (date)
Routes walked: /dm, /contacts, /calendar, /docs, /workplace, /approvals, /email, /calls, /projects, /settings
Theme toggle: light <-> dark verified
Outcome: <pass | issues filed>
```

```bash
git add packages/ui/.storybook/CHECKLIST.md
git commit -m "chore(ui): record G6 desktop smoke run"
```

---

## Phase F — Wrap-up

### Task F1: Final pass — README + spec linkage

**Files:**
- Modify: `packages/ui/README.md` (create if absent)
- Modify: `docs/superpowers/plans/2026-05-07-feishu-design-system-foundation.md` (mark complete)

- [ ] **Step 1: Write `packages/ui/README.md`**

Replace or create the file with:

```md
# @muon/ui — Feishu Design System

Foundation + atoms layer per spec
[`docs/superpowers/specs/2026-05-07-feishu-design-system-foundation-design.md`](../../docs/superpowers/specs/2026-05-07-feishu-design-system-foundation-design.md).

## Layers
- `src/tokens/`     — palette + role + dark
- `src/atoms/`      — 12 atoms (Spec 1)
- `src/components/ui/` — legacy paths re-exporting from atoms (consumer compat)

## Develop
- `pnpm storybook` — live Storybook on :6006
- `pnpm test:visual` — Playwright snapshot diff
- `pnpm check:tokens` — token completeness (G1)

## Acceptance gates
See spec §5.1. G1, G2, G4, G7, G8 are scripted; G3, G5, G6 are human-walked.
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/README.md
git commit -m "docs(ui): add design system README"
```

### Task F2: Final review

- [ ] **Step 1: Run all gates one more time**

Run in sequence:
```
pnpm --filter @muon/ui check:tokens
pnpm type-check
pnpm test:unit
pnpm --filter @muon/ui test:visual
pnpm build
```
Expected: all green.

- [ ] **Step 2: Confirm clean tree**

Run: `git status`
Expected: clean. If artifacts (e.g., `storybook-static/`, snapshot diffs from CI runs) appear, add them to `.gitignore` in their own follow-up commit — do not bundle.

- [ ] **Step 3: Hand off to next spec**

Open `docs/superpowers/specs/2026-05-07-feishu-design-system-foundation-design.md` §1 contract: confirm token freeze line is now true (no further `--color-*` role additions in this spec). Future Spec 2 (molecules) starts from this commit.

---

## Self-Review (post-write)

- [x] Spec §1 (sub-project carve) → Plan covers Spec 1 only; §8 occupies “to be brainstormed” spaces. Aligned.
- [x] Spec §2 architecture (extend `@muon/ui`, no new package, atoms/molecules dirs, Storybook in package, legacy compat) → Phase A + B + C cover.
- [x] Spec §3 tokens (palette, role, dark, typography, spacing, radius, shadow, density, motion) → Task A1 steps 2–8.
- [x] Spec §4 atoms (12 atoms with required variants/sizes/states) → Tasks C1–C12.
- [x] Spec §4.4 Storybook story shape (Default / Variants / Sizes / States / WithIcon-IconOnly / Density) → Each atom story task references this shape; minor variations (Avatar shapes, Switch states) are noted.
- [x] Spec §5 acceptance gates G1–G8 → Phase E maps each to a task.
- [x] Spec §5.4 unit tests (button loading, switch/checkbox/radio controlled, kbd platform) → Tasks C1, C8, C10, C11, C12.
- [x] Spec §6 risks (Storybook + Tailwind v4 compat) → Task B3 step 2 includes fallback to Storybook 8.
- [x] Spec §6 risks (14px body breaks layouts) → Task A2 + Task E5 cover smoke walk; G6 acceptance criteria allow token-driven equirevisions, only flag functional breaks.
- [x] Spec brand-500 = `#2d5af7` → Task A1 step 2 colors.css.
- [x] Spec G1 token completeness script → Task A3.
- [x] No "TBD" / "implement later" placeholders.
- [x] Type names match across tasks (`buttonVariants`, `inputVariants`, `badgeVariants`, etc.).
- [x] Avatar size scale change captured with consumer audit (Task C5 Step 3).
- [x] Badge variant→tone migration captured (Task C13).

No gaps found.
