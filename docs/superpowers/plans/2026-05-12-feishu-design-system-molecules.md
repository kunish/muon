# Feishu-Aligned Design System Molecules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@muon/ui` 实现 Spec 2 定义的 8 个新 molecule 与 4 个 shadcn 原位升级，配齐 Storybook 故事、视觉基线、TDD 行为单测，使 muon 桌面端的表单 / 列表 / 菜单 / 导航 / 附件等高频组件统一对齐飞书风。

**Architecture:** 沿用 Spec 1 三段式（`atoms/<name>/Component.vue` + `atoms/<name>/index.ts` + `components/ui/<name>/index.ts` re-export）。8 个新 molecule 落在 `src/molecules/<name>/`，由 `package.json` `exports` 直接对外暴露；4 个 shadcn 复合组件在 `src/components/ui/<name>/` 原位升级 cva/token，不动 props/emits/子组件名。

**Tech Stack:** Vue 3.5 + TypeScript + class-variance-authority + reka-ui + Tailwind CSS v4（`@theme` token）+ Storybook 8.6 + Playwright（视觉回归）+ Vitest（行为单测）。

**Spec reference:** `docs/superpowers/specs/2026-05-12-feishu-design-system-molecules-design.md`

---

## Phase 0 — Foundation（token 别名 + 目录脚手架）

### Task 0: 新增 Spec 2 语义别名 token

**Files:**
- Modify: `packages/ui/src/tokens/colors.css` (append role-layer 末尾)

- [ ] **Step 1: 在 role layer 末尾追加 7 个语义别名**

打开 `packages/ui/src/tokens/colors.css`，在亮色 `/* Role layer — semantic aliases, light mode */` 区块的末尾 `}` 前追加：

```css
  /* Spec 2 molecule semantic aliases */
  --color-list-item-hover-bg: var(--gray-50);
  --color-list-item-selected-bg: var(--gray-100);
  --color-list-item-active-rail: var(--brand-500);
  --color-menu-item-hover-bg: var(--gray-50);
  --color-file-chip-bg: var(--gray-50);
  --color-file-chip-hover-bg: var(--gray-100);
  --color-breadcrumb-current-fg: var(--gray-900);
```

随后定位到暗色覆盖区块（搜索 `:root.dark` 或 `@layer base` 内的暗色 mapping），追加对应映射（保持暗色协调）：

```css
  --color-list-item-hover-bg: var(--gray-800);
  --color-list-item-selected-bg: var(--gray-700);
  --color-list-item-active-rail: var(--brand-400);
  --color-menu-item-hover-bg: var(--gray-800);
  --color-file-chip-bg: var(--gray-800);
  --color-file-chip-hover-bg: var(--gray-700);
  --color-breadcrumb-current-fg: var(--gray-50);
```

- [ ] **Step 2: 类型检查**

```bash
pnpm --filter @muon/ui type-check
```

Expected: 0 error。

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/tokens/colors.css
git commit -m "feat(ui): add Spec 2 molecule semantic aliases"
```

### Task 0.1: 建 `molecules/` 目录脚手架

**Files:**
- Create: `packages/ui/src/molecules/.gitkeep`

- [ ] **Step 1: 创建空目录占位**

```bash
mkdir -p packages/ui/src/molecules
touch packages/ui/src/molecules/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/molecules/.gitkeep
git commit -m "chore(ui): scaffold molecules/ directory"
```

---

## Phase 1 — 8 个新 Molecule（按 §5 提交顺序）

### Task 1: search-box molecule

**Files:**
- Create: `packages/ui/src/molecules/search-box/index.ts`
- Create: `packages/ui/src/molecules/search-box/SearchBox.vue`
- Create: `packages/ui/src/stories/Molecules/SearchBox.stories.ts`
- Modify: `packages/ui/package.json` (exports map)

- [ ] **Step 1: 写 index.ts (cva + re-export)**

```typescript
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as SearchBox } from './SearchBox.vue'

export const searchBoxVariants = cva(
  'relative flex w-full items-center rounded-md border bg-card text-sm text-foreground transition-colors '
  + 'border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-brand-500/20 '
  + 'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:border-gray-200',
  {
    variants: {
      size: {
        sm: 'h-7 px-2 gap-1.5 text-sm',
        md: 'h-8 px-2.5 gap-2 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type SearchBoxVariants = VariantProps<typeof searchBoxVariants>
```

- [ ] **Step 2: 写 SearchBox.vue**

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { SearchBoxVariants } from '.'
import { useVModel } from '@vueuse/core'
import { Search, X } from 'lucide-vue-next'
import { computed } from 'vue'
import { Kbd } from '../../atoms/kbd'
import { cn } from '../../utils'
import { searchBoxVariants } from '.'

const props = withDefaults(defineProps<{
  modelValue?: string
  defaultValue?: string
  placeholder?: string
  size?: SearchBoxVariants['size']
  kbd?: string[]
  disabled?: boolean
  class?: HTMLAttributes['class']
}>(), {
  size: 'md',
  placeholder: 'Search',
})

const emits = defineEmits<{
  'update:modelValue': [value: string]
  'clear': []
}>()

const value = useVModel(props, 'modelValue', emits, { passive: true, defaultValue: props.defaultValue ?? '' })

const showClear = computed(() => !props.disabled && value.value && String(value.value).length > 0)

function onClear() {
  value.value = ''
  emits('clear')
}
</script>

<template>
  <div :class="cn(searchBoxVariants({ size }), props.class)" :data-testid="$attrs['data-testid']">
    <Search class="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
    <input
      v-model="value"
      type="search"
      :placeholder="placeholder"
      :disabled="disabled"
      class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
      data-testid="search-box-input"
    >
    <button
      v-if="showClear"
      type="button"
      class="inline-flex shrink-0 items-center justify-center rounded-sm text-gray-500 hover:text-gray-700"
      data-testid="search-box-clear"
      @click="onClear"
    >
      <X class="size-3.5" />
    </button>
    <Kbd v-if="kbd && !value" :keys="kbd" size="sm" class="shrink-0" />
  </div>
</template>
```

- [ ] **Step 3: 写 Stories（6 类）**

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import { SearchBox } from '../../molecules/search-box'

const meta: Meta<typeof SearchBox> = {
  title: 'Molecules/SearchBox',
  component: SearchBox,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
    disabled: { control: 'boolean' },
  },
  args: { size: 'md', placeholder: 'Search', disabled: false },
}

export default meta
type Story = StoryObj<typeof SearchBox>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({
    components: { SearchBox },
    setup: () => ({ args }),
    template: '<div class="w-80"><SearchBox v-bind="args" /></div>',
  }),
}

export const Variants: Story = {
  render: () => ({
    components: { SearchBox },
    template: `
      <div class="flex flex-col gap-3 w-80">
        <SearchBox placeholder="Plain" />
        <SearchBox placeholder="With kbd hint" :kbd="['Cmd', 'K']" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { SearchBox },
    template: `
      <div class="flex flex-col gap-3 w-80">
        <SearchBox size="sm" placeholder="Small (28)" />
        <SearchBox size="md" placeholder="Medium (32)" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { SearchBox },
    template: `
      <div class="flex flex-col gap-3 w-80">
        <SearchBox placeholder="Empty" />
        <SearchBox default-value="With text" />
        <SearchBox disabled placeholder="Disabled" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { SearchBox },
    template: `
      <div class="flex flex-col gap-3 w-80">
        <SearchBox placeholder="Default density" />
        <div data-density="compact"><SearchBox placeholder="Compact density" /></div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { SearchBox },
    template: `
      <div class="w-80 rounded-lg border border-border bg-card p-3">
        <SearchBox placeholder="Search messages, files…" :kbd="['Cmd', 'K']" />
      </div>
    `,
  }),
}
```

- [ ] **Step 4: 在 package.json `exports` 追加**

定位到 `packages/ui/package.json` 的 `exports` 块，在 `"./scroll-area"` 之后按字母序插入：

```jsonc
    "./search-box": "./src/molecules/search-box/index.ts",
```

- [ ] **Step 5: 验证 storybook 可启动并显示故事**

```bash
pnpm --filter @muon/ui storybook --no-open &
STORYBOOK_PID=$!
sleep 8
curl -s http://localhost:6006/index.json | grep -o 'Molecules/SearchBox' | head -1
kill $STORYBOOK_PID
```

Expected: 输出 `Molecules/SearchBox`，无 5xx。

- [ ] **Step 6: 类型检查**

```bash
pnpm --filter @muon/ui type-check
```

Expected: 0 error。

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/molecules/search-box packages/ui/src/stories/Molecules/SearchBox.stories.ts packages/ui/package.json
git commit -m "feat(ui): add SearchBox molecule with 6 stories"
```

---

### Task 2: breadcrumb molecule

**Files:**
- Create: `packages/ui/src/molecules/breadcrumb/index.ts`
- Create: `packages/ui/src/molecules/breadcrumb/Breadcrumb.vue`
- Create: `packages/ui/src/stories/Molecules/Breadcrumb.stories.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: 写 index.ts**

```typescript
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Breadcrumb } from './Breadcrumb.vue'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export const breadcrumbVariants = cva(
  'flex items-center gap-1 text-gray-500',
  {
    variants: {
      size: { sm: 'text-xs', md: 'text-sm' },
    },
    defaultVariants: { size: 'md' },
  },
)

export type BreadcrumbVariants = VariantProps<typeof breadcrumbVariants>
```

- [ ] **Step 2: 写 Breadcrumb.vue**

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { BreadcrumbItem, BreadcrumbVariants } from '.'
import { ChevronRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { cn } from '../../utils'
import { breadcrumbVariants } from '.'

const props = withDefaults(defineProps<{
  items: BreadcrumbItem[]
  size?: BreadcrumbVariants['size']
  truncation?: 'middle' | 'end'
  maxSegmentWidth?: number
  class?: HTMLAttributes['class']
}>(), {
  size: 'md',
  truncation: 'middle',
  maxSegmentWidth: 200,
})

const visible = computed(() => {
  if (props.items.length <= 4) return props.items
  if (props.truncation === 'end') return props.items.slice(0, 4).concat([{ label: '…' }])
  return [props.items[0], { label: '…' }, ...props.items.slice(-2)]
})
</script>

<template>
  <nav :class="cn(breadcrumbVariants({ size }), props.class)" aria-label="Breadcrumb">
    <template v-for="(item, i) in visible" :key="i">
      <ChevronRight v-if="i > 0" class="size-3 shrink-0 text-gray-300" aria-hidden="true" />
      <span
        v-if="i === visible.length - 1 || !item.href"
        :class="i === visible.length - 1 ? 'font-medium text-breadcrumb-current-fg' : 'text-gray-500'"
        :style="{ maxWidth: `${maxSegmentWidth}px` }"
        class="truncate"
        :aria-current="i === visible.length - 1 ? 'page' : undefined"
      >{{ item.label }}</span>
      <a
        v-else
        :href="item.href"
        class="truncate text-gray-500 underline-offset-4 hover:underline"
        :style="{ maxWidth: `${maxSegmentWidth}px` }"
      >{{ item.label }}</a>
    </template>
  </nav>
</template>

<style scoped>
.text-breadcrumb-current-fg { color: var(--color-breadcrumb-current-fg); }
</style>
```

- [ ] **Step 3: 写 Stories**

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import type { BreadcrumbItem } from '../../molecules/breadcrumb'
import { Breadcrumb } from '../../molecules/breadcrumb'

const short: BreadcrumbItem[] = [
  { label: 'Workspace', href: '#' },
  { label: 'Engineering', href: '#' },
  { label: 'Design System' },
]
const long: BreadcrumbItem[] = [
  { label: 'Workspace', href: '#' },
  { label: 'Engineering', href: '#' },
  { label: 'Frontend', href: '#' },
  { label: 'Design System', href: '#' },
  { label: 'Molecules', href: '#' },
  { label: 'Breadcrumb' },
]

const meta: Meta<typeof Breadcrumb> = {
  title: 'Molecules/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
  args: { items: short, size: 'md', truncation: 'middle' },
}

export default meta
type Story = StoryObj<typeof Breadcrumb>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({ components: { Breadcrumb }, setup: () => ({ args }), template: '<Breadcrumb v-bind="args" />' }),
}

export const Variants: Story = {
  render: () => ({
    components: { Breadcrumb },
    setup: () => ({ short, long }),
    template: `
      <div class="flex flex-col gap-3">
        <Breadcrumb :items="short" />
        <Breadcrumb :items="long" truncation="middle" />
        <Breadcrumb :items="long" truncation="end" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { Breadcrumb },
    setup: () => ({ short }),
    template: `
      <div class="flex flex-col gap-3">
        <Breadcrumb :items="short" size="sm" />
        <Breadcrumb :items="short" size="md" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { Breadcrumb },
    setup: () => ({ short }),
    template: `
      <div class="flex flex-col gap-3">
        <Breadcrumb :items="short" />
        <Breadcrumb :items="[{ label: 'Single segment' }]" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { Breadcrumb },
    setup: () => ({ short }),
    template: `
      <div class="flex flex-col gap-3">
        <Breadcrumb :items="short" />
        <div data-density="compact"><Breadcrumb :items="short" /></div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { Breadcrumb },
    setup: () => ({ short }),
    template: `
      <div class="w-[640px] rounded-lg border border-border bg-card p-4">
        <Breadcrumb :items="short" />
        <h1 class="mt-2 text-lg font-semibold text-foreground">Design System</h1>
      </div>
    `,
  }),
}
```

- [ ] **Step 4: 在 package.json `exports` 追加**

```jsonc
    "./breadcrumb": "./src/molecules/breadcrumb/index.ts",
```

- [ ] **Step 5: 类型检查 + storybook 启动验证**

```bash
pnpm --filter @muon/ui type-check
pnpm --filter @muon/ui storybook --no-open &
STORYBOOK_PID=$!; sleep 8
curl -s http://localhost:6006/index.json | grep -o 'Molecules/Breadcrumb' | head -1
kill $STORYBOOK_PID
```

Expected: 输出 `Molecules/Breadcrumb`。

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/molecules/breadcrumb packages/ui/src/stories/Molecules/Breadcrumb.stories.ts packages/ui/package.json
git commit -m "feat(ui): add Breadcrumb molecule with 6 stories"
```

---

### Task 3: segmented-control molecule

**Files:**
- Create: `packages/ui/src/molecules/segmented-control/index.ts`
- Create: `packages/ui/src/molecules/segmented-control/SegmentedControl.vue`
- Create: `packages/ui/src/stories/Molecules/SegmentedControl.stories.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: 写 index.ts**

```typescript
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as SegmentedControl } from './SegmentedControl.vue'

export interface SegmentItem {
  value: string
  label: string
}

export const segmentedControlVariants = cva(
  'inline-flex items-center rounded-md text-sm',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 p-0.5',
        inline: 'bg-transparent',
      },
      size: {
        sm: 'h-7',
        md: 'h-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export type SegmentedControlVariants = VariantProps<typeof segmentedControlVariants>
```

- [ ] **Step 2: 写 SegmentedControl.vue**

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { SegmentedControlVariants, SegmentItem } from '.'
import { useVModel } from '@vueuse/core'
import { cn } from '../../utils'
import { segmentedControlVariants } from '.'

const props = withDefaults(defineProps<{
  items: SegmentItem[]
  modelValue?: string
  defaultValue?: string
  variant?: SegmentedControlVariants['variant']
  size?: SegmentedControlVariants['size']
  class?: HTMLAttributes['class']
}>(), { variant: 'default', size: 'md' })

const emits = defineEmits<{ 'update:modelValue': [value: string] }>()
const value = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue ?? props.items[0]?.value,
})

function isActive(v: string) { return value.value === v }
function activate(v: string) { value.value = v }
</script>

<template>
  <div
    :class="cn(segmentedControlVariants({ variant, size }), props.class)"
    role="tablist"
    :data-testid="$attrs['data-testid']"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      role="tab"
      :aria-selected="isActive(item.value)"
      :data-active="isActive(item.value) || undefined"
      :class="cn(
        'inline-flex h-full items-center justify-center rounded-[5px] px-3 transition-colors',
        isActive(item.value)
          ? 'bg-card text-gray-900 font-medium shadow-xs'
          : 'text-gray-500 hover:text-gray-700',
      )"
      @click="activate(item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
```

- [ ] **Step 3: 写 Stories**

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import type { SegmentItem } from '../../molecules/segmented-control'
import { SegmentedControl } from '../../molecules/segmented-control'

const viewItems: SegmentItem[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const meta: Meta<typeof SegmentedControl> = {
  title: 'Molecules/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'inline'] },
    size: { control: 'select', options: ['sm', 'md'] },
  },
  args: { items: viewItems, variant: 'default', size: 'md' },
}

export default meta
type Story = StoryObj<typeof SegmentedControl>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({ components: { SegmentedControl }, setup: () => ({ args }), template: '<SegmentedControl v-bind="args" />' }),
}

export const Variants: Story = {
  render: () => ({
    components: { SegmentedControl },
    setup: () => ({ viewItems }),
    template: `
      <div class="flex flex-col items-start gap-3">
        <SegmentedControl :items="viewItems" variant="default" />
        <SegmentedControl :items="viewItems" variant="inline" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { SegmentedControl },
    setup: () => ({ viewItems }),
    template: `
      <div class="flex flex-col items-start gap-3">
        <SegmentedControl :items="viewItems" size="sm" />
        <SegmentedControl :items="viewItems" size="md" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { SegmentedControl },
    setup: () => ({ viewItems }),
    template: `
      <div class="flex flex-col items-start gap-3">
        <SegmentedControl :items="viewItems" default-value="day" />
        <SegmentedControl :items="viewItems" default-value="week" />
        <SegmentedControl :items="viewItems" default-value="month" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { SegmentedControl },
    setup: () => ({ viewItems }),
    template: `
      <div class="flex flex-col items-start gap-3">
        <SegmentedControl :items="viewItems" />
        <div data-density="compact"><SegmentedControl :items="viewItems" /></div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { SegmentedControl },
    setup: () => ({ viewItems }),
    template: `
      <div class="w-[480px] rounded-lg border border-border bg-card p-4">
        <div class="mb-3 text-sm font-medium text-gray-700">Calendar view</div>
        <SegmentedControl :items="viewItems" default-value="week" />
      </div>
    `,
  }),
}
```

- [ ] **Step 4: package.json exports**

```jsonc
    "./segmented-control": "./src/molecules/segmented-control/index.ts",
```

- [ ] **Step 5: 验证**

```bash
pnpm --filter @muon/ui type-check
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/molecules/segmented-control packages/ui/src/stories/Molecules/SegmentedControl.stories.ts packages/ui/package.json
git commit -m "feat(ui): add SegmentedControl molecule with 6 stories"
```

---

### Task 4: color-swatch molecule

**Files:**
- Create: `packages/ui/src/molecules/color-swatch/index.ts`
- Create: `packages/ui/src/molecules/color-swatch/ColorSwatch.vue`
- Create: `packages/ui/src/stories/Molecules/ColorSwatch.stories.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: 写 index.ts**

```typescript
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as ColorSwatch } from './ColorSwatch.vue'

export const colorSwatchVariants = cva(
  'inline-block rounded-sm cursor-pointer transition-[outline-width]',
  {
    variants: {
      size: {
        sm: 'size-3',
        md: 'size-4',
        lg: 'size-5',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type ColorSwatchVariants = VariantProps<typeof colorSwatchVariants>

export const PRESET_COLORS = [
  'var(--brand-500)', 'var(--red-500)', 'var(--orange-500)',
  'var(--green-500)', 'var(--cyan-500)', 'var(--gray-500)',
  'var(--brand-200)', 'var(--red-200)', 'var(--orange-200)',
  'var(--green-200)', 'var(--cyan-200)', 'var(--gray-200)',
] as const
```

- [ ] **Step 2: 写 ColorSwatch.vue**

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { ColorSwatchVariants } from '.'
import { cn } from '../../utils'
import { colorSwatchVariants } from '.'

const props = withDefaults(defineProps<{
  color: string
  selected?: boolean
  disabled?: boolean
  size?: ColorSwatchVariants['size']
  ariaLabel?: string
  class?: HTMLAttributes['class']
}>(), { size: 'md', selected: false, disabled: false })

const emits = defineEmits<{ select: [color: string] }>()
function onClick() { if (!props.disabled) emits('select', props.color) }
</script>

<template>
  <button
    type="button"
    :aria-pressed="selected"
    :aria-label="ariaLabel ?? `Color ${color}`"
    :disabled="disabled"
    :class="cn(
      colorSwatchVariants({ size }),
      selected ? 'outline outline-2 outline-offset-2 outline-brand-500' : 'outline-none',
      disabled && 'cursor-not-allowed opacity-50',
      props.class,
    )"
    :style="{ backgroundColor: color }"
    :data-testid="$attrs['data-testid']"
    @click="onClick"
  />
</template>
```

- [ ] **Step 3: 写 Stories**

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import { ColorSwatch, PRESET_COLORS } from '../../molecules/color-swatch'

const meta: Meta<typeof ColorSwatch> = {
  title: 'Molecules/ColorSwatch',
  component: ColorSwatch,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    selected: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { color: 'var(--brand-500)', size: 'md', selected: false, disabled: false },
}

export default meta
type Story = StoryObj<typeof ColorSwatch>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({ components: { ColorSwatch }, setup: () => ({ args }), template: '<ColorSwatch v-bind="args" />' }),
}

export const Variants: Story = {
  render: () => ({
    components: { ColorSwatch },
    setup: () => ({ PRESET_COLORS }),
    template: `
      <div class="grid grid-cols-6 gap-2 w-fit">
        <ColorSwatch v-for="c in PRESET_COLORS" :key="c" :color="c" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { ColorSwatch },
    template: `
      <div class="flex items-end gap-2">
        <ColorSwatch color="var(--brand-500)" size="sm" />
        <ColorSwatch color="var(--brand-500)" size="md" />
        <ColorSwatch color="var(--brand-500)" size="lg" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { ColorSwatch },
    template: `
      <div class="flex gap-2">
        <ColorSwatch color="var(--brand-500)" />
        <ColorSwatch color="var(--red-500)" :selected="true" />
        <ColorSwatch color="var(--green-500)" :disabled="true" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { ColorSwatch },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex gap-2">
          <ColorSwatch color="var(--brand-500)" />
          <ColorSwatch color="var(--red-500)" />
        </div>
        <div data-density="compact" class="flex gap-2">
          <ColorSwatch color="var(--brand-500)" />
          <ColorSwatch color="var(--red-500)" />
        </div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { ColorSwatch },
    setup: () => ({ PRESET_COLORS }),
    template: `
      <div class="w-[260px] rounded-lg border border-border bg-card p-4">
        <div class="mb-3 text-sm font-medium text-gray-700">Event color</div>
        <div class="grid grid-cols-6 gap-2">
          <ColorSwatch v-for="(c, i) in PRESET_COLORS" :key="c" :color="c" :selected="i === 0" />
        </div>
      </div>
    `,
  }),
}
```

- [ ] **Step 4: package.json exports**

```jsonc
    "./color-swatch": "./src/molecules/color-swatch/index.ts",
```

- [ ] **Step 5: 验证**

```bash
pnpm --filter @muon/ui type-check
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/molecules/color-swatch packages/ui/src/stories/Molecules/ColorSwatch.stories.ts packages/ui/package.json
git commit -m "feat(ui): add ColorSwatch molecule with 6 stories"
```

---

### Task 5: file-chip molecule

**Files:**
- Create: `packages/ui/src/molecules/file-chip/index.ts`
- Create: `packages/ui/src/molecules/file-chip/FileChip.vue`
- Create: `packages/ui/src/stories/Molecules/FileChip.stories.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: 写 index.ts（含扩展名色映射）**

```typescript
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as FileChip } from './FileChip.vue'

export const fileChipVariants = cva(
  'inline-flex items-center gap-2 rounded-md transition-colors cursor-default '
  + 'bg-file-chip-bg hover:bg-file-chip-hover-bg',
  {
    variants: {
      size: {
        sm: 'h-6 px-2 text-xs',
        md: 'h-8 px-2.5 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type FileChipVariants = VariantProps<typeof fileChipVariants>

export type FileKind = 'doc' | 'sheet' | 'pdf' | 'img' | 'video' | 'audio' | 'zip' | 'other'

const EXT_MAP: Record<string, FileKind> = {
  doc: 'doc', docx: 'doc', txt: 'doc', md: 'doc', rtf: 'doc',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet', numbers: 'sheet',
  pdf: 'pdf',
  png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', svg: 'img',
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio', flac: 'audio',
  zip: 'zip', rar: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip',
}

export const KIND_COLOR: Record<FileKind, string> = {
  doc: 'var(--brand-500)',
  sheet: 'var(--green-500)',
  pdf: 'var(--red-500)',
  img: 'var(--orange-500)',
  video: 'var(--brand-400)',
  audio: 'var(--cyan-500)',
  zip: 'var(--gray-500)',
  other: 'var(--gray-400)',
}

export function inferKind(filename: string): FileKind {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MAP[ext] ?? 'other'
}
```

- [ ] **Step 2: 写 FileChip.vue**

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { FileChipVariants } from '.'
import { Download, File, X } from 'lucide-vue-next'
import { computed } from 'vue'
import { cn } from '../../utils'
import { fileChipVariants, inferKind, KIND_COLOR } from '.'

const props = withDefaults(defineProps<{
  name: string
  size?: FileChipVariants['size']
  byteSize?: string
  removable?: boolean
  downloadable?: boolean
  class?: HTMLAttributes['class']
}>(), { size: 'md', removable: false, downloadable: false })

const emits = defineEmits<{
  remove: []
  download: []
}>()

const kind = computed(() => inferKind(props.name))
const iconColor = computed(() => KIND_COLOR[kind.value])
</script>

<template>
  <span
    :class="cn(fileChipVariants({ size }), props.class)"
    :data-testid="$attrs['data-testid']"
    :data-kind="kind"
  >
    <File class="size-4 shrink-0" :style="{ color: iconColor }" aria-hidden="true" />
    <span class="max-w-[200px] truncate text-foreground">{{ name }}</span>
    <span v-if="byteSize" class="text-[11px] text-gray-500">{{ byteSize }}</span>
    <button
      v-if="downloadable"
      type="button"
      class="ml-1 inline-flex items-center justify-center text-gray-500 hover:text-gray-700"
      data-testid="file-chip-download"
      @click="emits('download')"
    >
      <Download class="size-3.5" />
    </button>
    <button
      v-if="removable"
      type="button"
      class="ml-1 inline-flex items-center justify-center text-gray-500 hover:text-gray-700"
      data-testid="file-chip-remove"
      @click="emits('remove')"
    >
      <X class="size-3.5" />
    </button>
  </span>
</template>

<style scoped>
.bg-file-chip-bg { background-color: var(--color-file-chip-bg); }
.hover\:bg-file-chip-hover-bg:hover { background-color: var(--color-file-chip-hover-bg); }
</style>
```

- [ ] **Step 3: 写 Stories**

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import { FileChip } from '../../molecules/file-chip'

const meta: Meta<typeof FileChip> = {
  title: 'Molecules/FileChip',
  component: FileChip,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
    removable: { control: 'boolean' },
    downloadable: { control: 'boolean' },
  },
  args: { name: 'report.pdf', size: 'md', removable: false, downloadable: false },
}

export default meta
type Story = StoryObj<typeof FileChip>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({ components: { FileChip }, setup: () => ({ args }), template: '<FileChip v-bind="args" />' }),
}

export const Variants: Story = {
  render: () => ({
    components: { FileChip },
    template: `
      <div class="flex flex-wrap gap-2">
        <FileChip name="brief.docx" />
        <FileChip name="budget.xlsx" />
        <FileChip name="contract.pdf" />
        <FileChip name="hero.png" />
        <FileChip name="demo.mp4" />
        <FileChip name="podcast.mp3" />
        <FileChip name="archive.zip" />
        <FileChip name="readme" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { FileChip },
    template: `
      <div class="flex items-end gap-2">
        <FileChip name="report.pdf" size="sm" />
        <FileChip name="report.pdf" size="md" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { FileChip },
    template: `
      <div class="flex flex-wrap gap-2">
        <FileChip name="report.pdf" />
        <FileChip name="report.pdf" byte-size="1.2 MB" />
        <FileChip name="report.pdf" removable />
        <FileChip name="report.pdf" downloadable />
        <FileChip name="very-long-file-name-that-should-truncate.docx" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { FileChip },
    template: `
      <div class="flex flex-col gap-3">
        <div class="flex gap-2"><FileChip name="report.pdf" /></div>
        <div data-density="compact" class="flex gap-2"><FileChip name="report.pdf" /></div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { FileChip },
    template: `
      <div class="w-[480px] rounded-lg border border-border bg-card p-4">
        <div class="mb-2 text-sm text-gray-700">Attachments</div>
        <div class="flex flex-wrap gap-2">
          <FileChip name="design-system.docx" byte-size="240 KB" removable />
          <FileChip name="screenshot.png" byte-size="1.4 MB" removable />
        </div>
      </div>
    `,
  }),
}
```

- [ ] **Step 4: package.json exports**

```jsonc
    "./file-chip": "./src/molecules/file-chip/index.ts",
```

- [ ] **Step 5: 验证**

```bash
pnpm --filter @muon/ui type-check
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/molecules/file-chip packages/ui/src/stories/Molecules/FileChip.stories.ts packages/ui/package.json
git commit -m "feat(ui): add FileChip molecule with 8-kind color mapping"
```

---

### Task 6: list-item molecule

**Files:**
- Create: `packages/ui/src/molecules/list-item/index.ts`
- Create: `packages/ui/src/molecules/list-item/ListItem.vue`
- Create: `packages/ui/src/stories/Molecules/ListItem.stories.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: 写 index.ts**

```typescript
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as ListItem } from './ListItem.vue'

export const listItemVariants = cva(
  'group relative flex w-full items-center gap-3 px-3 cursor-pointer transition-colors '
  + 'hover:bg-list-item-hover-bg '
  + 'data-[selected=true]:bg-list-item-selected-bg '
  + 'data-[selected=true]:before:absolute data-[selected=true]:before:left-0 data-[selected=true]:before:top-1.5 '
  + 'data-[selected=true]:before:bottom-1.5 data-[selected=true]:before:w-1 '
  + 'data-[selected=true]:before:rounded-r-sm data-[selected=true]:before:bg-list-item-active-rail',
  {
    variants: {
      size: {
        sm: 'h-8 text-sm',
        md: 'h-10 text-sm',
        lg: 'h-12 text-sm',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type ListItemVariants = VariantProps<typeof listItemVariants>
```

- [ ] **Step 2: 写 ListItem.vue**

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { ListItemVariants } from '.'
import { cn } from '../../utils'
import { listItemVariants } from '.'

const props = withDefaults(defineProps<{
  selected?: boolean
  size?: ListItemVariants['size']
  title?: string
  description?: string
  class?: HTMLAttributes['class']
}>(), { size: 'md', selected: false })

const emits = defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <div
    :class="cn(listItemVariants({ size }), props.class)"
    :data-selected="selected || undefined"
    :data-testid="$attrs['data-testid']"
    role="button"
    tabindex="0"
    @click="emits('click', $event)"
  >
    <slot name="leading" />
    <div class="min-w-0 flex-1">
      <slot>
        <div class="truncate font-medium text-gray-900">{{ title }}</div>
        <div v-if="description" class="truncate text-xs text-gray-500">{{ description }}</div>
      </slot>
    </div>
    <div class="shrink-0">
      <slot name="trailing" />
    </div>
  </div>
</template>

<style scoped>
.bg-list-item-hover-bg { background-color: var(--color-list-item-hover-bg); }
.hover\:bg-list-item-hover-bg:hover { background-color: var(--color-list-item-hover-bg); }
.data-\[selected\=true\]\:bg-list-item-selected-bg[data-selected="true"] { background-color: var(--color-list-item-selected-bg); }
.data-\[selected\=true\]\:before\:bg-list-item-active-rail[data-selected="true"]::before { background-color: var(--color-list-item-active-rail); }
</style>
```

- [ ] **Step 3: 写 Stories**

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Badge } from '../../components/ui/badge'
import { ListItem } from '../../molecules/list-item'

const meta: Meta<typeof ListItem> = {
  title: 'Molecules/ListItem',
  component: ListItem,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    selected: { control: 'boolean' },
  },
  args: { title: 'Daisy Chen', description: 'Yes, the report is ready', size: 'md', selected: false },
}

export default meta
type Story = StoryObj<typeof ListItem>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({ components: { ListItem }, setup: () => ({ args }), template: '<div class="w-80"><ListItem v-bind="args" /></div>' }),
}

export const Variants: Story = {
  render: () => ({
    components: { ListItem, Avatar, AvatarFallback, Badge },
    template: `
      <div class="w-80 flex flex-col">
        <ListItem title="No leading">
          <template #trailing><Badge variant="secondary">3</Badge></template>
        </ListItem>
        <ListItem title="With avatar" description="last message">
          <template #leading><Avatar size="sm"><AvatarFallback>D</AvatarFallback></Avatar></template>
        </ListItem>
        <ListItem title="With trailing only">
          <template #trailing><Badge>!</Badge></template>
        </ListItem>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { ListItem },
    template: `
      <div class="w-80 flex flex-col">
        <ListItem size="sm" title="Small (h-8)" />
        <ListItem size="md" title="Medium (h-10)" description="with description" />
        <ListItem size="lg" title="Large (h-12)" description="with description" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { ListItem },
    template: `
      <div class="w-80 flex flex-col">
        <ListItem title="Default" />
        <ListItem title="Selected" selected />
        <ListItem title="With description" description="and a second line" />
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { ListItem },
    template: `
      <div class="flex flex-col gap-4">
        <div class="w-80 flex flex-col">
          <ListItem title="Default density A" />
          <ListItem title="Default density B" selected />
        </div>
        <div data-density="compact" class="w-80 flex flex-col">
          <ListItem title="Compact density A" />
          <ListItem title="Compact density B" selected />
        </div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { ListItem, Avatar, AvatarFallback, Badge },
    template: `
      <div class="w-80 rounded-lg border border-border bg-card py-2">
        <ListItem title="Daisy Chen" description="Yes, the report is ready" selected>
          <template #leading><Avatar size="sm"><AvatarFallback>D</AvatarFallback></Avatar></template>
          <template #trailing><Badge variant="secondary">2</Badge></template>
        </ListItem>
        <ListItem title="Eng team" description="Standup notes posted">
          <template #leading><Avatar size="sm"><AvatarFallback>E</AvatarFallback></Avatar></template>
        </ListItem>
        <ListItem title="Marcus Lee" description="Lunch?">
          <template #leading><Avatar size="sm"><AvatarFallback>M</AvatarFallback></Avatar></template>
        </ListItem>
      </div>
    `,
  }),
}
```

- [ ] **Step 4: package.json exports**

```jsonc
    "./list-item": "./src/molecules/list-item/index.ts",
```

- [ ] **Step 5: 验证**

```bash
pnpm --filter @muon/ui type-check
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/molecules/list-item packages/ui/src/stories/Molecules/ListItem.stories.ts packages/ui/package.json
git commit -m "feat(ui): add ListItem molecule with rail indicator + 6 stories"
```

---

### Task 7: menu-item molecule

**Files:**
- Create: `packages/ui/src/molecules/menu-item/index.ts`
- Create: `packages/ui/src/molecules/menu-item/MenuItem.vue`
- Create: `packages/ui/src/stories/Molecules/MenuItem.stories.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: 写 index.ts**

```typescript
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as MenuItem } from './MenuItem.vue'

export const menuItemVariants = cva(
  'flex w-full h-8 items-center gap-1.5 rounded-sm px-2.5 text-sm transition-colors cursor-pointer '
  + 'hover:bg-menu-item-hover-bg '
  + 'disabled:cursor-not-allowed disabled:bg-transparent disabled:text-gray-400',
  {
    variants: {
      variant: {
        default: 'text-gray-900',
        destructive: 'text-destructive hover:text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export type MenuItemVariants = VariantProps<typeof menuItemVariants>
```

- [ ] **Step 2: 写 MenuItem.vue**

```vue
<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue'
import type { MenuItemVariants } from '.'
import { ChevronRight } from 'lucide-vue-next'
import { Kbd } from '../../atoms/kbd'
import { cn } from '../../utils'
import { menuItemVariants } from '.'

const props = withDefaults(defineProps<{
  variant?: MenuItemVariants['variant']
  leadingIcon?: Component
  kbd?: string[]
  hasArrow?: boolean
  disabled?: boolean
  class?: HTMLAttributes['class']
}>(), { variant: 'default', hasArrow: false, disabled: false })

const emits = defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    type="button"
    :class="cn(menuItemVariants({ variant }), props.class)"
    :disabled="disabled"
    :data-testid="$attrs['data-testid']"
    @click="emits('click', $event)"
  >
    <component :is="leadingIcon" v-if="leadingIcon" class="size-3.5 shrink-0" />
    <span class="flex-1 truncate text-left">
      <slot />
    </span>
    <Kbd v-if="kbd" :keys="kbd" size="sm" class="shrink-0 text-gray-500" />
    <ChevronRight v-if="hasArrow" class="size-3 shrink-0 text-gray-400" />
  </button>
</template>

<style scoped>
.hover\:bg-menu-item-hover-bg:hover { background-color: var(--color-menu-item-hover-bg); }
</style>
```

- [ ] **Step 3: 写 Stories**

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import { Copy, Edit, FileText, Trash2 } from 'lucide-vue-next'
import { MenuItem } from '../../molecules/menu-item'

const meta: Meta<typeof MenuItem> = {
  title: 'Molecules/MenuItem',
  component: MenuItem,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive'] },
    hasArrow: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { variant: 'default', hasArrow: false, disabled: false },
}

export default meta
type Story = StoryObj<typeof MenuItem>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({ components: { MenuItem }, setup: () => ({ args }), template: '<div class="w-56 rounded-lg border border-border bg-popover p-1"><MenuItem v-bind="args">Edit</MenuItem></div>' }),
}

export const Variants: Story = {
  render: () => ({
    components: { MenuItem },
    setup: () => ({ Trash2, Edit }),
    template: `
      <div class="w-56 rounded-lg border border-border bg-popover p-1">
        <MenuItem variant="default" :leading-icon="Edit">Default</MenuItem>
        <MenuItem variant="destructive" :leading-icon="Trash2">Destructive</MenuItem>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { MenuItem },
    template: `
      <div class="w-56 rounded-lg border border-border bg-popover p-1">
        <MenuItem>Single size 32px</MenuItem>
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { MenuItem },
    setup: () => ({ Edit }),
    template: `
      <div class="w-56 rounded-lg border border-border bg-popover p-1">
        <MenuItem :leading-icon="Edit">Default</MenuItem>
        <MenuItem :leading-icon="Edit" :kbd="['Cmd', 'E']">With kbd</MenuItem>
        <MenuItem :leading-icon="Edit" has-arrow>With submenu arrow</MenuItem>
        <MenuItem :leading-icon="Edit" disabled>Disabled</MenuItem>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { MenuItem },
    setup: () => ({ Edit }),
    template: `
      <div class="flex gap-4">
        <div class="w-56 rounded-lg border border-border bg-popover p-1">
          <MenuItem :leading-icon="Edit">Default density</MenuItem>
        </div>
        <div data-density="compact" class="w-56 rounded-lg border border-border bg-popover p-1">
          <MenuItem :leading-icon="Edit">Compact density</MenuItem>
        </div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { MenuItem },
    setup: () => ({ FileText, Copy, Edit, Trash2 }),
    template: `
      <div class="w-56 rounded-lg border border-border bg-popover p-1 shadow-md">
        <MenuItem :leading-icon="FileText">New page</MenuItem>
        <MenuItem :leading-icon="Copy" :kbd="['Cmd', 'C']">Copy</MenuItem>
        <MenuItem :leading-icon="Edit" has-arrow>Move to…</MenuItem>
        <div class="my-1 h-px bg-border" />
        <MenuItem variant="destructive" :leading-icon="Trash2">Delete</MenuItem>
      </div>
    `,
  }),
}
```

- [ ] **Step 4: package.json exports**

```jsonc
    "./menu-item": "./src/molecules/menu-item/index.ts",
```

- [ ] **Step 5: 验证**

```bash
pnpm --filter @muon/ui type-check
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/molecules/menu-item packages/ui/src/stories/Molecules/MenuItem.stories.ts packages/ui/package.json
git commit -m "feat(ui): add MenuItem molecule for dropdown/context menus"
```

---

### Task 8: form-field molecule

**Files:**
- Create: `packages/ui/src/molecules/form-field/index.ts`
- Create: `packages/ui/src/molecules/form-field/FormField.vue`
- Create: `packages/ui/src/molecules/form-field/context.ts`
- Create: `packages/ui/src/stories/Molecules/FormField.stories.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: 写 context.ts（provide/inject 用）**

```typescript
import type { InjectionKey } from 'vue'

export interface FormFieldContext {
  fieldId: string
  describedById?: string
  errorId?: string
  invalid: boolean
}

export const FORM_FIELD_KEY: InjectionKey<FormFieldContext> = Symbol('form-field-context')
```

- [ ] **Step 2: 写 index.ts**

```typescript
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as FormField } from './FormField.vue'
export { FORM_FIELD_KEY } from './context'
export type { FormFieldContext } from './context'

export const formFieldVariants = cva(
  'flex gap-1.5 w-full',
  {
    variants: {
      orientation: {
        vertical: 'flex-col',
        horizontal: 'flex-row items-start',
      },
      size: {
        sm: 'text-xs',
        md: 'text-sm',
      },
    },
    defaultVariants: { orientation: 'vertical', size: 'md' },
  },
)

export type FormFieldVariants = VariantProps<typeof formFieldVariants>
```

- [ ] **Step 3: 写 FormField.vue**

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { FormFieldContext } from './context'
import type { FormFieldVariants } from '.'
import { computed, provide, useId } from 'vue'
import { cn } from '../../utils'
import { FORM_FIELD_KEY } from './context'
import { formFieldVariants } from '.'

const props = withDefaults(defineProps<{
  label?: string
  description?: string
  required?: boolean
  helper?: string
  error?: string
  orientation?: FormFieldVariants['orientation']
  size?: FormFieldVariants['size']
  id?: string
  class?: HTMLAttributes['class']
}>(), { orientation: 'vertical', size: 'md', required: false })

const autoId = useId()
const fieldId = computed(() => props.id ?? `field-${autoId}`)
const helperId = computed(() => `${fieldId.value}-helper`)
const errorId = computed(() => `${fieldId.value}-error`)
const invalid = computed(() => !!props.error)

const context = computed<FormFieldContext>(() => ({
  fieldId: fieldId.value,
  describedById: props.error ? errorId.value : (props.helper ? helperId.value : undefined),
  errorId: props.error ? errorId.value : undefined,
  invalid: invalid.value,
}))

provide(FORM_FIELD_KEY, context.value)
</script>

<template>
  <div :class="cn(formFieldVariants({ orientation, size }), props.class)">
    <div :class="orientation === 'horizontal' ? 'w-30 shrink-0 pt-1.5' : ''">
      <label
        v-if="label"
        :for="fieldId"
        class="block text-sm font-medium text-gray-700"
      >
        {{ label }}<span v-if="required" class="ml-0.5 text-destructive">*</span>
      </label>
      <p v-if="description" class="mt-0.5 text-xs text-gray-500">{{ description }}</p>
    </div>
    <div class="flex flex-1 flex-col gap-1">
      <slot :field-id="fieldId" :described-by="context.describedById" :invalid="invalid" />
      <p v-if="error" :id="errorId" class="text-xs text-destructive">{{ error }}</p>
      <p v-else-if="helper" :id="helperId" class="text-xs text-gray-500">{{ helper }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 写 Stories**

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import { Input } from '../../atoms/input'
import { Textarea } from '../../atoms/textarea'
import { FormField } from '../../molecules/form-field'

const meta: Meta<typeof FormField> = {
  title: 'Molecules/FormField',
  component: FormField,
  tags: ['autodocs'],
  argTypes: {
    orientation: { control: 'select', options: ['vertical', 'horizontal'] },
    size: { control: 'select', options: ['sm', 'md'] },
    required: { control: 'boolean' },
  },
  args: { label: 'Workspace name', required: false, orientation: 'vertical', size: 'md' },
}

export default meta
type Story = StoryObj<typeof FormField>

export const Default: Story = {
  render: (args: Record<string, unknown>) => ({
    components: { FormField, Input },
    setup: () => ({ args }),
    template: `
      <div class="w-80">
        <FormField v-bind="args">
          <template #default="{ fieldId }">
            <Input :id="fieldId" placeholder="Acme Inc." />
          </template>
        </FormField>
      </div>
    `,
  }),
}

export const Variants: Story = {
  render: () => ({
    components: { FormField, Input },
    template: `
      <div class="w-80 flex flex-col gap-4">
        <FormField label="Plain" />
        <FormField label="Required" required>
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
        <FormField label="With description" description="Short hint here">
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
        <FormField label="With helper" helper="Use letters, digits, and dashes">
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
        <FormField label="With error" error="Name is required">
          <template #default="{ fieldId }"><Input :id="fieldId" variant="error" /></template>
        </FormField>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: () => ({
    components: { FormField, Input },
    template: `
      <div class="w-80 flex flex-col gap-4">
        <FormField label="Small" size="sm">
          <template #default="{ fieldId }"><Input :id="fieldId" size="sm" /></template>
        </FormField>
        <FormField label="Medium" size="md">
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
      </div>
    `,
  }),
}

export const States: Story = {
  render: () => ({
    components: { FormField, Input },
    template: `
      <div class="w-[480px] flex flex-col gap-4">
        <FormField label="Vertical" required>
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
        <FormField label="Horizontal" orientation="horizontal" required>
          <template #default="{ fieldId }"><Input :id="fieldId" /></template>
        </FormField>
      </div>
    `,
  }),
}

export const Density: Story = {
  render: () => ({
    components: { FormField, Input },
    template: `
      <div class="flex flex-col gap-6">
        <div class="w-80">
          <FormField label="Default density">
            <template #default="{ fieldId }"><Input :id="fieldId" /></template>
          </FormField>
        </div>
        <div data-density="compact" class="w-80">
          <FormField label="Compact density">
            <template #default="{ fieldId }"><Input :id="fieldId" /></template>
          </FormField>
        </div>
      </div>
    `,
  }),
}

export const Composed: Story = {
  render: () => ({
    components: { FormField, Input, Textarea },
    template: `
      <div class="w-[520px] rounded-lg border border-border bg-card p-6 space-y-4">
        <FormField label="Workspace name" required helper="Visible to all members">
          <template #default="{ fieldId }"><Input :id="fieldId" placeholder="Acme Inc." /></template>
        </FormField>
        <FormField label="Workspace URL" description="Lowercase letters, digits, dashes" error="Already taken">
          <template #default="{ fieldId }"><Input :id="fieldId" variant="error" model-value="acme" /></template>
        </FormField>
        <FormField label="Description" orientation="horizontal">
          <template #default="{ fieldId }"><Textarea :id="fieldId" rows="3" /></template>
        </FormField>
      </div>
    `,
  }),
}
```

- [ ] **Step 5: package.json exports**

```jsonc
    "./form-field": "./src/molecules/form-field/index.ts",
```

- [ ] **Step 6: 验证**

```bash
pnpm --filter @muon/ui type-check
```

Expected: 0 error (FormField slot 类型推断由 Vue 3.5 generics 兜底)。

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/molecules/form-field packages/ui/src/stories/Molecules/FormField.stories.ts packages/ui/package.json
git commit -m "feat(ui): add FormField molecule with provide/inject context"
```

---

## Phase 2 — 4 个 shadcn 原位升级

### Task 9: tabs 原位校准

**Files:**
- Modify: `packages/ui/src/components/ui/tabs/TabsList.vue`
- Modify: `packages/ui/src/components/ui/tabs/TabsTrigger.vue`
- Verify: `packages/ui/src/stories/Components/Tabs.stories.ts`

- [ ] **Step 1: 读现状**

```bash
cat packages/ui/src/components/ui/tabs/TabsList.vue
cat packages/ui/src/components/ui/tabs/TabsTrigger.vue
```

- [ ] **Step 2: 校准 underline variant indicator**

定位 TabsTrigger 的 `data-[state=active]` 样式块；underline variant 应为：

```html
data-[state=active]:text-gray-900 data-[state=active]:font-medium
data-[state=active]:after:content-[''] data-[state=active]:after:absolute
data-[state=active]:after:bottom-0 data-[state=active]:after:left-1/2
data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:h-0.5
data-[state=active]:after:w-[18px] data-[state=active]:after:bg-brand-500 data-[state=active]:after:rounded-full
```

segmented variant 高度 h-8 容器 + h-7 trigger，active `bg-card shadow-xs text-gray-900 font-medium`。

- [ ] **Step 3: 类型检查 + 视觉对比（暂用 storybook 手验）**

```bash
pnpm --filter @muon/ui type-check
pnpm --filter @muon/ui storybook --no-open &
STORYBOOK_PID=$!; sleep 8
echo "open http://localhost:6006/?path=/story/components-tabs--default"
kill $STORYBOOK_PID
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/ui/tabs
git commit -m "feat(ui): align Tabs underline indicator + segmented density to Feishu"
```

### Task 10: tooltip 原位校准

**Files:**
- Modify: `packages/ui/src/components/ui/tooltip/TooltipContent.vue`

- [ ] **Step 1: 读现状**

```bash
cat packages/ui/src/components/ui/tooltip/TooltipContent.vue
```

- [ ] **Step 2: 校准 theme-inverse 样式**

TooltipContent 类应为：

```html
class="z-50 overflow-hidden rounded-sm bg-gray-800 dark:bg-gray-900
text-white px-2.5 py-1.5 text-xs leading-4
shadow-md animate-in fade-in-0 zoom-in-95
data-[state=closed]:animate-out data-[state=closed]:fade-out-0
data-[side=top]:slide-in-from-bottom-1 data-[side=bottom]:slide-in-from-top-1
data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1"
```

如已基本就位（commit 历史显示 `b3f4849 feat(ui): switch Tooltip to theme-inverse style`），仅校验数值：高度自适应 ≤ 20px line、padding `6 10`。

- [ ] **Step 3: 验证 + Commit**

```bash
pnpm --filter @muon/ui type-check
git add packages/ui/src/components/ui/tooltip
git commit -m "feat(ui): finalize Tooltip Feishu theme-inverse styling" || echo "no changes (already aligned)"
```

### Task 11: popover 原位升级（新增 `size` prop）

**Files:**
- Modify: `packages/ui/src/components/ui/popover/PopoverContent.vue`
- Modify: `packages/ui/src/components/ui/popover/index.ts` (export size variants)

- [ ] **Step 1: 读现状**

```bash
cat packages/ui/src/components/ui/popover/PopoverContent.vue
cat packages/ui/src/components/ui/popover/index.ts
```

- [ ] **Step 2: 给 PopoverContent.vue 加 `size` prop**

在 `defineProps` 中加入 `size?: 'sm' | 'md' | 'lg'` 默认 `'md'`。template class 加：

```html
:class="[
  size === 'sm' && 'w-60',
  size === 'md' && 'w-80',
  size === 'lg' && 'w-[400px]',
  'rounded-lg shadow-md p-3 bg-popover text-popover-foreground border border-border',
]"
```

确保旧 consumer（未传 `size`）行为不变：md 默认值匹配既有 80（w-80）。

- [ ] **Step 3: 在 index.ts 末尾追加（如缺）**

```typescript
export type PopoverContentSize = 'sm' | 'md' | 'lg'
```

- [ ] **Step 4: 验证 + Commit**

```bash
pnpm --filter @muon/ui type-check
git add packages/ui/src/components/ui/popover
git commit -m "feat(ui): add size prop to PopoverContent (sm/md/lg)"
```

### Task 12: dropdown-menu 原位升级 + menu-item 样式接管

**Files:**
- Modify: `packages/ui/src/components/ui/dropdown-menu/DropdownMenuContent.vue`
- Modify: `packages/ui/src/components/ui/dropdown-menu/DropdownMenuItem.vue`
- Modify: `packages/ui/src/components/ui/dropdown-menu/DropdownMenuLabel.vue`
- Modify: `packages/ui/src/components/ui/dropdown-menu/DropdownMenuSeparator.vue`

- [ ] **Step 1: 读现状**

```bash
ls packages/ui/src/components/ui/dropdown-menu/
cat packages/ui/src/components/ui/dropdown-menu/DropdownMenuContent.vue
```

- [ ] **Step 2: DropdownMenuContent 样式校准**

container class 统一：

```html
class="z-50 min-w-[180px] max-w-[320px] rounded-lg border border-border
bg-popover p-1 shadow-md text-popover-foreground"
```

- [ ] **Step 3: DropdownMenuItem 套用 menu-item 样式 token**

item class 切到与 `menu-item` molecule 同源（不引入 MenuItem 组件以避免 reka-ui slot 冲突；样式 1:1 对齐）：

```html
class="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-2.5 text-sm
text-gray-900 outline-none transition-colors
data-[highlighted]:bg-[var(--color-menu-item-hover-bg)]
data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-400
data-[variant=destructive]:text-destructive"
```

- [ ] **Step 4: DropdownMenuLabel 改 11px uppercase tracking**

```html
class="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500"
```

- [ ] **Step 5: DropdownMenuSeparator 使用 separator atom 风格**

```html
class="-mx-1 my-1 h-px bg-border"
```

- [ ] **Step 6: 验证 + Commit**

```bash
pnpm --filter @muon/ui type-check
pnpm --filter @muon/ui storybook --no-open &
STORYBOOK_PID=$!; sleep 8
echo "verify http://localhost:6006/?path=/story/components-dropdownmenu--default"
kill $STORYBOOK_PID
git add packages/ui/src/components/ui/dropdown-menu
git commit -m "feat(ui): align DropdownMenu items to menu-item molecule styling"
```

---

## Phase 3 — 验收门 G1–G8

### Task 13: G1 token 完备性检查

- [ ] **Step 1: grep 所有新增别名是否在亮/暗双向定义**

```bash
for t in list-item-hover-bg list-item-selected-bg list-item-active-rail menu-item-hover-bg file-chip-bg file-chip-hover-bg breadcrumb-current-fg; do
  count=$(grep -c "color-${t}" packages/ui/src/tokens/colors.css)
  echo "${t}: ${count}"
done
```

Expected: 每个 token 出现至少 2 次（亮 + 暗）。

- [ ] **Step 2: grep 无未引用 token**

```bash
for t in list-item-hover-bg menu-item-hover-bg file-chip-bg breadcrumb-current-fg; do
  refs=$(grep -r "color-${t}\|--color-${t}" packages/ui/src --include='*.vue' --include='*.ts' | wc -l)
  echo "${t} referenced: ${refs}"
done
```

Expected: 每个 token 至少 1 处引用（除 active-rail 通过 selected 态隐式引用）。

### Task 14: G2 story 覆盖完备

- [ ] **Step 1: grep 每个 molecule story 是否含 6 类**

```bash
for f in packages/ui/src/stories/Molecules/*.stories.ts; do
  name=$(basename "$f" .stories.ts)
  for s in Default Variants Sizes States Density Composed; do
    if ! grep -q "export const ${s}" "$f"; then
      echo "MISSING: ${name} -> ${s}"
    fi
  done
done
```

Expected: 无 MISSING 输出。

### Task 15: G4 视觉回归基线生成

- [ ] **Step 1: 启动 Storybook 并生成基线**

```bash
pnpm --filter @muon/ui test:visual --update-snapshots
```

Expected: 新增 `.png` 基线文件到 `packages/ui/tests/visual/__screenshots__/` (亮 + 暗共约 144 张)。

- [ ] **Step 2: Commit 基线**

```bash
git add packages/ui/tests/visual/__screenshots__
git commit -m "test(ui): baseline visual snapshots for Spec 2 molecules"
```

### Task 16: G6 主 app 烟雾测试

- [ ] **Step 1: 启动桌面端**

```bash
pnpm dev:desktop &
DESKTOP_PID=$!
sleep 12
```

- [ ] **Step 2: 手动走 4 个高密度页面**

按以下路径过一遍：
- Settings → 各 tab：确认 form-field/segmented-control/list-item 无错位
- Approval form：确认 tabs / form-field 视觉自洽
- Messages 列表：滚动 + 选中：list-item 左色条、hover 色生效，search-box 顶部
- Docs Home：breadcrumb 路径

记录任何"功能性破损"（重叠 / 溢出 / 不可点击）—— 视觉等比变化不计。

```bash
kill $DESKTOP_PID
```

- [ ] **Step 3: 如无破损 commit 烟雾通过标记**

```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) — Spec 2 G6 smoke pass (kunish)" >> docs/superpowers/specs/2026-05-12-feishu-design-system-molecules-design.md
git add docs/superpowers/specs/2026-05-12-feishu-design-system-molecules-design.md
git commit -m "docs(spec2): record G6 smoke pass"
```

### Task 17: G7 类型 + 构建

- [ ] **Step 1: 仓库级 type-check + build**

```bash
pnpm type-check && pnpm --filter @muon/ui build || true
```

Expected: 0 type error。`@muon/ui` 当前不预编译（spec §2.6），build 步骤若 no-op 输出"No build script" 视为通过。

### Task 18: G3 anchor 截图入库（依赖用户交付）

- [ ] **Step 1: 检查交付**

```bash
ls packages/ui/.storybook/anchors/ | grep -E '06-context-menu\.png|07-message-attachment\.png'
```

如未交付，**跳过本 task** 不阻塞其他 G 门通过（spec §6.2 已标记为未决）。已交付则继续。

- [ ] **Step 2: 入库 anchor**

```bash
git add packages/ui/.storybook/anchors/06-context-menu.png packages/ui/.storybook/anchors/07-message-attachment.png
git commit -m "test(ui): add anchor screenshots for menu-item & file-chip"
```

### Task 19: G5 飞书风 checklist 勾选

- [ ] **Step 1: 手动逐条勾过 §3.5 的 8 条新增 checklist**

打开 `docs/superpowers/specs/2026-05-12-feishu-design-system-molecules-design.md` 找到 §3.5 的 8 条 checkbox，按 storybook 实际渲染结果勾选。

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-12-feishu-design-system-molecules-design.md
git commit -m "docs(spec2): tick G5 Feishu checklist after impl"
```

---

## Self-Review Checklist

**Spec coverage check（plan 自审）：**

| Spec section | Implemented by task |
| --- | --- |
| §1.1 目录 `molecules/` | Task 0.1 |
| §1.2 exports 契约 | Task 1–8 step "package.json exports" |
| §1.4 shadcn 原位升级规则 | Task 9–12 |
| §2.1 form-field | Task 8 |
| §2.2 menu-item | Task 7 |
| §2.3 list-item | Task 6 |
| §2.4 tooltip | Task 10 |
| §2.5 popover (含 size prop) | Task 11 |
| §2.6 tabs | Task 9 |
| §2.7 breadcrumb | Task 2 |
| §2.8 search-box | Task 1 |
| §2.9 dropdown (DropdownMenu) | Task 12 |
| §2.10 segmented-control | Task 3 |
| §2.11 color-swatch | Task 4 |
| §2.12 file-chip | Task 5 |
| §3.1 G1 token 完备性 | Task 13 |
| §3.2 G2 story 覆盖 | Task 14 |
| §3.3 G3 anchor | Task 18（条件依赖） |
| §3.4 G4 视觉回归 | Task 15 |
| §3.5 G5 checklist | Task 19 |
| §3.6 G6 烟雾 | Task 16 |
| §3.7 G7 类型/构建 | Task 17 |
| §3.7 G8 暗色 | Task 15 (Playwright `chromium-dark` 已涵盖) |

**Placeholder scan**: 无"TBD/TODO/implement later"。`code blocks` 每步均给出。

**Type consistency**: `ListItem` slot `leading/trailing` 命名贯穿；`FormField` slot props `{ fieldId, describedBy, invalid }` 在 Stories Composed 中也使用同名；`FileChip` `inferKind/KIND_COLOR/FileKind` 类型一致；`SegmentItem`/`BreadcrumbItem` 接口在 Stories 中复用同名 import。

**Spec 6.2 未决项处理**：
- (1) anchor 截图 → Task 18 条件依赖处理
- (2) ESLint inline-style → 本 spec/plan 不强制，沿 §6.2 决定推迟
- (3) file-chip 色映射 → 已在 Task 5 step 1 落地 KIND_COLOR
- (4) form-field provide/inject → Task 8 step 1 + step 3 已实现，atom 端的 inject 兼容兜底由消费方手动传 `:id="fieldId"` 完成（FormField Stories Default 与 Composed 演示）
- (5) menu-item 注入 DropdownMenu → Task 12 已采用 fallback 方案（样式 1:1 对齐而非组件注入）

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-12-feishu-design-system-molecules.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — 每个 task 派发一个新 subagent，task 之间快速 review，避免主上下文被 12 个组件的实现细节淹没。
2. **Inline Execution** — 在当前会话使用 executing-plans skill，按检查点批量推进。

12 个组件 + 19 个 task 的体量更适合 Subagent-Driven，避免主上下文崩溃。
