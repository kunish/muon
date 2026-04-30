# Feishu Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Muon's UI shell into a Feishu-style app-first workspace while preserving core messaging, contacts, and settings behavior.

**Architecture:** Add a focused workspace layer under `src/app/components/workspace/` that owns the app rail, route-to-app mapping, page framing, and common workspace surfaces. Keep Matrix data stores and existing feature components as business logic sources, then move the visible shell from server-first navigation to app-first navigation.

**Tech Stack:** Vue 3, Vue Router, Pinia, Tailwind CSS v4 theme tokens, Vitest, Vue Test Utils, Electron dev runtime.

---

## File map

### Create

- `src/app/components/workspace/navigation.ts` — canonical workspace app definitions and route matching helpers.
- `src/app/components/workspace/WorkspaceAppRail.vue` — Feishu-style primary app rail.
- `src/app/components/workspace/WorkspaceLayout.vue` — app-first shell that renders app rail, optional business sidebar, main content, and global overlays.
- `src/app/components/workspace/WorkspacePageFrame.vue` — shared polished frame for secondary app pages.
- `src/app/components/workspace/index.ts` — exports workspace helpers/components.
- `tests/unit/workspace/navigation.test.ts` — route-to-app unit coverage.
- `tests/components/WorkspaceAppRail.test.ts` — app rail render/selection test.

### Modify

- `src/app/main.css` — Feishu Pro light/dark tokens, surface helpers, motion utilities.
- `src/app/components/AppLayout.vue` — replace server-first shell with `WorkspaceLayout`; keep global dialogs.
- `src/features/server/components/ChannelSidebar.vue` — restyle as Message app business sidebar and preserve Matrix navigation.
- `src/features/server/components/UserPanel.vue` — align bottom user control with workspace surfaces.
- `src/features/contacts/components/ContactsPage.vue` — remove duplicated workspace bottom controls and tune sidebar/main surfaces.
- `src/features/settings/components/SettingsPage.vue` — use workspace frame and polished settings sidebar.
- `src/features/calendar/components/CalendarPage.vue` — wrap in workspace frame.
- `src/features/docs/components/DocsPage.vue` — wrap in workspace frame.
- `src/features/approvals/components/ApprovalsPage.vue` — wrap in workspace frame.
- `src/features/email/components/EmailPage.vue` — wrap in workspace frame.
- `src/features/calls/components/CallsPage.vue` — wrap in workspace frame.
- `src/shared/components/ui/button/index.ts` — refine variants for Feishu Pro tokens.
- `src/shared/components/ui/input/Input.vue` — refine input surfaces.
- `src/shared/components/ui/badge/Badge.vue` and `src/shared/components/ui/badge/index.ts` if needed for badge polish.

---

## Task 1: Workspace navigation model

**Files:**

- Create: `tests/unit/workspace/navigation.test.ts`
- Create: `src/app/components/workspace/navigation.ts`
- Create: `src/app/components/workspace/index.ts`

- [ ] **Step 1: Write the failing navigation test**

Create `tests/unit/workspace/navigation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getWorkspaceAppForPath, workspaceApps } from '@/app/components/workspace/navigation'

describe('workspace navigation', () => {
  it('lists app-first workspace entries in display order', () => {
    expect(workspaceApps.map(app => app.id)).toEqual([
      'messages',
      'contacts',
      'calendar',
      'docs',
      'approvals',
      'email',
      'calls',
      'settings',
    ])
  })

  it.each([
    ['/dm', 'messages'],
    ['/dm/!room%3Alocalhost', 'messages'],
    ['/server/!space%3Alocalhost/channel/!room%3Alocalhost', 'messages'],
    ['/contacts', 'contacts'],
    ['/calendar', 'calendar'],
    ['/docs', 'docs'],
    ['/approvals', 'approvals'],
    ['/email', 'email'],
    ['/calls', 'calls'],
    ['/settings', 'settings'],
  ])('maps %s to %s', (path, appId) => {
    expect(getWorkspaceAppForPath(path)?.id).toBe(appId)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm vitest run tests/unit/workspace/navigation.test.ts
```

Expected: FAIL because `@/app/components/workspace/navigation` does not exist.

- [ ] **Step 3: Implement the navigation model**

Create `src/app/components/workspace/navigation.ts`:

```ts
import { Calendar, CheckSquare, FileText, Mail, MessageCircle, Phone, Settings, Users } from 'lucide-vue-next'

export type WorkspaceAppId = 'messages' | 'contacts' | 'calendar' | 'docs' | 'approvals' | 'email' | 'calls' | 'settings'

export interface WorkspaceApp {
  id: WorkspaceAppId
  labelKey: string
  path: string
  match: (path: string) => boolean
  icon: typeof MessageCircle
}

function matchesAny(path: string, prefixes: string[]) {
  return prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

export const workspaceApps: WorkspaceApp[] = [
  { id: 'messages', labelKey: 'sidebar.messages', path: '/dm', icon: MessageCircle, match: path => path === '/' || matchesAny(path, ['/dm', '/chat', '/server']) },
  { id: 'contacts', labelKey: 'sidebar.contacts', path: '/contacts', icon: Users, match: path => matchesAny(path, ['/contacts']) },
  { id: 'calendar', labelKey: 'sidebar.calendar', path: '/calendar', icon: Calendar, match: path => matchesAny(path, ['/calendar']) },
  { id: 'docs', labelKey: 'sidebar.docs', path: '/docs', icon: FileText, match: path => matchesAny(path, ['/docs']) },
  { id: 'approvals', labelKey: 'sidebar.approvals', path: '/approvals', icon: CheckSquare, match: path => matchesAny(path, ['/approvals']) },
  { id: 'email', labelKey: 'sidebar.email', path: '/email', icon: Mail, match: path => matchesAny(path, ['/email']) },
  { id: 'calls', labelKey: 'sidebar.video_meetings', path: '/calls', icon: Phone, match: path => matchesAny(path, ['/calls']) },
  { id: 'settings', labelKey: 'sidebar.settings', path: '/settings', icon: Settings, match: path => matchesAny(path, ['/settings']) },
]

export function getWorkspaceAppForPath(path: string) {
  return workspaceApps.find(app => app.match(path)) ?? workspaceApps[0]
}
```

Create `src/app/components/workspace/index.ts`:

```ts
export * from './navigation'
export { default as WorkspaceAppRail } from './WorkspaceAppRail.vue'
export { default as WorkspaceLayout } from './WorkspaceLayout.vue'
export { default as WorkspacePageFrame } from './WorkspacePageFrame.vue'
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
pnpm vitest run tests/unit/workspace/navigation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Run:

```bash
git diff -- src/app/components/workspace/navigation.ts src/app/components/workspace/index.ts tests/unit/workspace/navigation.test.ts
```

Expected: only the navigation model, export barrel, and test changed.

---

## Task 2: Workspace app rail component

**Files:**

- Create: `tests/components/WorkspaceAppRail.test.ts`
- Create: `src/app/components/workspace/WorkspaceAppRail.vue`

- [ ] **Step 1: Write the failing component test**

Create `tests/components/WorkspaceAppRail.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import WorkspaceAppRail from '@/app/components/workspace/WorkspaceAppRail.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/contacts' }),
  useRouter: () => ({ push }),
}))

vi.mock('@/features/chat/composables/useConversations', () => ({
  useConversations: () => ({ totalUnreadCount: { value: 3 } }),
}))

describe('workspaceAppRail', () => {
  it('renders app-first navigation and marks the active app', () => {
    const wrapper = mount(WorkspaceAppRail)
    expect(wrapper.text()).toContain('消息')
    expect(wrapper.text()).toContain('通讯录')
    expect(wrapper.find('[aria-current="page"]').text()).toContain('通讯录')
  })

  it('navigates when an app entry is clicked', async () => {
    const wrapper = mount(WorkspaceAppRail)
    await wrapper.find('[data-testid="workspace-app-messages"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/dm')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm vitest run tests/components/WorkspaceAppRail.test.ts
```

Expected: FAIL because `WorkspaceAppRail.vue` does not exist.

- [ ] **Step 3: Implement the app rail**

Create `src/app/components/workspace/WorkspaceAppRail.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useConversations } from '@/features/chat/composables/useConversations'
import { cn } from '@/shared/lib/utils'
import { getWorkspaceAppForPath, workspaceApps } from './navigation'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { totalUnreadCount } = useConversations()

const activeApp = computed(() => getWorkspaceAppForPath(route.path))

function openApp(path: string) {
  router.push(path)
}
</script>

<template>
  <nav class="workspace-rail flex h-full w-[72px] shrink-0 flex-col items-center border-r border-sidebar-border bg-server-bar px-2 py-3 shadow-[1px_0_0_color-mix(in_srgb,var(--color-border)_70%,transparent)]">
    <div class="mb-4 flex size-10 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_12px_28px_color-mix(in_srgb,var(--color-primary)_30%,transparent)]">
      M
    </div>

    <div class="flex w-full flex-1 flex-col items-center gap-1.5">
      <button
        v-for="app in workspaceApps"
        :key="app.id"
        class="group relative flex w-full flex-col items-center gap-1 rounded-2xl px-1.5 py-2 text-[11px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="cn(activeApp?.id === app.id ? 'bg-primary/12 text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground')"
        :data-testid="`workspace-app-${app.id}`"
        :aria-current="activeApp?.id === app.id ? 'page' : undefined"
        :title="t(app.labelKey)"
        @click="openApp(app.path)"
      >
        <component :is="app.icon" :size="20" class="shrink-0" />
        <span class="max-w-full truncate">{{ t(app.labelKey) }}</span>
        <span
          v-if="app.id === 'messages' && totalUnreadCount > 0"
          class="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
        >
          {{ totalUnreadCount > 99 ? '99+' : totalUnreadCount }}
        </span>
      </button>
    </div>
  </nav>
</template>
```

- [ ] **Step 4: Run the component test and verify it passes**

Run:

```bash
pnpm vitest run tests/components/WorkspaceAppRail.test.ts
```

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Run:

```bash
git diff -- src/app/components/workspace/WorkspaceAppRail.vue tests/components/WorkspaceAppRail.test.ts
```

Expected: app rail component and tests only.

---

## Task 3: Workspace layout shell

**Files:**

- Create: `src/app/components/workspace/WorkspaceLayout.vue`
- Modify: `src/app/components/AppLayout.vue`

- [ ] **Step 1: Create the layout component**

Create `src/app/components/workspace/WorkspaceLayout.vue`:

```vue
<script setup lang="ts">
import WorkspaceAppRail from './WorkspaceAppRail.vue'

defineProps<{
  showMessageSidebar?: boolean
}>()
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background text-foreground">
    <WorkspaceAppRail />
    <slot name="message-sidebar" />
    <main class="min-w-0 flex-1 bg-background">
      <slot />
    </main>
    <slot name="overlays" />
  </div>
</template>
```

- [ ] **Step 2: Update AppLayout imports**

In `src/app/components/AppLayout.vue`, replace the server rail import block:

```ts
import WorkspaceLayout from '@/app/components/workspace/WorkspaceLayout.vue'
```

Remove the unused `ServerList` import.

- [ ] **Step 3: Update AppLayout route sidebar logic**

In `src/app/components/AppLayout.vue`, keep this computed behavior:

```ts
const hideSidebarRoutes = ['/contacts', '/calls', '/calendar', '/docs', '/approvals', '/email', '/settings']
const showChannelSidebar = computed(() => !hideSidebarRoutes.some(prefix => route.path.startsWith(prefix)))
```

- [ ] **Step 4: Replace the AppLayout template shell**

In `src/app/components/AppLayout.vue`, replace the outer template body with:

```vue
<template>
  <WorkspaceLayout>
    <template #message-sidebar>
      <ChannelSidebar
        v-if="showChannelSidebar"
        @server-settings="showServerSettings = true"
        @invite-people="showInviteDialog = true"
        @leave-server="requestLeaveServer"
        @create-category="showCreateCategoryDialog = true"
        @notification-settings="openNotificationSettings"
      />
    </template>

    <NetworkStatusBar />
    <RouterView />
    <WatermarkOverlay :text="watermarkText" />

    <template #overlays>
      <ServerSettings v-model:open="showServerSettings" />
      <InviteDialog
        v-if="serverStore.currentServerId"
        v-model:open="showInviteDialog"
        :space-id="serverStore.currentServerId"
      />
      <CreateCategoryDialog v-model:open="showCreateCategoryDialog" />
      <Dialog v-model:open="showLeaveConfirm">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{{ t('server.leave_server') }}</DialogTitle>
            <DialogDescription>{{ t('server.leave_server_confirm') }}</DialogDescription>
          </DialogHeader>
          <div class="flex justify-end gap-2">
            <Button variant="ghost" @click="showLeaveConfirm = false">
              {{ t('common.cancel') }}
            </Button>
            <Button variant="destructive" :disabled="isLeavingServer" @click="confirmLeaveServer">
              {{ t('server.leave_server') }}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </template>
  </WorkspaceLayout>
</template>
```

- [ ] **Step 5: Run type check**

Run:

```bash
pnpm type-check
```

Expected: PASS, or only unrelated pre-existing errors. Fix any errors caused by the new workspace imports or slots.

---

## Task 4: Feishu Pro token system and primitives

**Files:**

- Modify: `src/app/main.css`
- Modify: `src/shared/components/ui/button/index.ts`
- Modify: `src/shared/components/ui/input/Input.vue`

- [ ] **Step 1: Update light theme tokens**

In `src/app/main.css`, replace the current `@theme` color block values with Feishu Pro light values:

```css
--color-background: oklch(98.6% 0.006 255);
--color-foreground: oklch(23% 0.018 255);
--color-muted: oklch(95.7% 0.008 255);
--color-muted-foreground: oklch(54% 0.026 255);
--color-primary: oklch(58.5% 0.215 263);
--color-primary-foreground: oklch(100% 0 0);
--color-accent: oklch(94.8% 0.018 255);
--color-accent-foreground: oklch(25% 0.025 255);
--color-destructive: oklch(58% 0.23 27);
--color-destructive-foreground: oklch(99% 0 0);
--color-border: oklch(90.8% 0.012 255);
--color-input: oklch(92.5% 0.012 255);
--color-ring: oklch(58.5% 0.215 263);
--color-card: oklch(100% 0 0);
--color-card-foreground: oklch(23% 0.018 255);
--color-secondary: oklch(63% 0.04 255);
--color-secondary-foreground: oklch(100% 0 0);
--color-popover: oklch(100% 0 0);
--color-popover-foreground: oklch(23% 0.018 255);
--color-sidebar: oklch(97.4% 0.009 255);
--color-sidebar-foreground: oklch(25% 0.02 255);
--color-sidebar-border: oklch(89.8% 0.013 255);
--color-sidebar-accent: oklch(93.5% 0.02 255);
--color-sidebar-accent-foreground: oklch(24% 0.025 255);
--color-sidebar-primary: oklch(58.5% 0.215 263);
--color-sidebar-primary-foreground: oklch(100% 0 0);
--color-sidebar-ring: oklch(58.5% 0.215 263);
--color-server-bar: oklch(96.2% 0.018 255);
--color-success: oklch(63% 0.17 155);
--color-warning: oklch(75% 0.16 78);
--radius: 0.875rem;
```

- [ ] **Step 2: Update dark theme tokens**

In `.dark`, replace the current color values with:

```css
--color-background: oklch(17% 0.018 260);
--color-foreground: oklch(92% 0.01 255);
--color-muted: oklch(22% 0.018 260);
--color-muted-foreground: oklch(66% 0.025 255);
--color-primary: oklch(67% 0.2 263);
--color-primary-foreground: oklch(100% 0 0);
--color-accent: oklch(26% 0.024 260);
--color-accent-foreground: oklch(92% 0.01 255);
--color-destructive: oklch(62% 0.2 25);
--color-destructive-foreground: oklch(99% 0 0);
--color-border: oklch(30% 0.02 260);
--color-input: oklch(27% 0.02 260);
--color-ring: oklch(67% 0.2 263);
--color-card: oklch(20% 0.018 260);
--color-card-foreground: oklch(92% 0.01 255);
--color-secondary: oklch(60% 0.035 255);
--color-secondary-foreground: oklch(100% 0 0);
--color-popover: oklch(21% 0.02 260);
--color-popover-foreground: oklch(92% 0.01 255);
--color-sidebar: oklch(19% 0.018 260);
--color-sidebar-foreground: oklch(90% 0.012 255);
--color-sidebar-border: oklch(29% 0.02 260);
--color-sidebar-accent: oklch(25% 0.025 260);
--color-sidebar-accent-foreground: oklch(92% 0.01 255);
--color-sidebar-primary: oklch(67% 0.2 263);
--color-sidebar-primary-foreground: oklch(100% 0 0);
--color-sidebar-ring: oklch(67% 0.2 263);
--color-server-bar: oklch(15% 0.018 260);
--color-success: oklch(66% 0.16 155);
--color-warning: oklch(78% 0.15 78);
```

- [ ] **Step 3: Add workspace utility classes**

Append to `src/app/main.css` after `@layer base`:

```css
@layer components {
  .workspace-surface {
    @apply border border-border/70 bg-card/92 shadow-[0_18px_45px_color-mix(in_srgb,var(--color-foreground)_8%,transparent)];
  }

  .workspace-panel {
    @apply border border-sidebar-border/80 bg-sidebar/95 shadow-[0_10px_30px_color-mix(in_srgb,var(--color-foreground)_6%,transparent)];
  }

  .workspace-row-selected {
    @apply bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_24%,transparent)];
  }
}
```

- [ ] **Step 4: Refine button variants**

In `src/shared/components/ui/button/index.ts`, update the base and variants:

```ts
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[0_8px_20px_color-mix(in_srgb,var(--color-primary)_24%,transparent)] hover:bg-primary/90 active:scale-[0.98]',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]',
        outline: 'border border-input bg-card hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/85 active:scale-[0.98]',
        ghost: 'hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
```

- [ ] **Step 5: Refine input styling**

In `src/shared/components/ui/input/Input.vue`, keep behavior and replace class construction with a Feishu-style surface:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '@/shared/lib/utils'

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes['class']
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input
    v-model="modelValue"
    :class="cn('flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-foreground)_4%,transparent)] transition-all placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50', props.class)"
  >
</template>
```

- [ ] **Step 6: Run static checks**

Run:

```bash
pnpm type-check
pnpm lint
```

Expected: PASS, or fix newly introduced style/type errors.

---

## Task 5: Message app sidebar polish

**Files:**

- Modify: `src/features/server/components/ChannelSidebar.vue`
- Modify: `src/features/server/components/UserPanel.vue`
- Modify: `src/features/server/components/TextChannelItem.vue`

- [ ] **Step 1: Restyle ChannelSidebar container**

In `ChannelSidebar.vue`, change the aside root class to:

```vue
<aside class="workspace-panel flex h-full min-h-0 w-[308px] shrink-0 flex-col border-l-0 border-y-0 rounded-none bg-sidebar/95 backdrop-blur-xl">
```

- [ ] **Step 2: Restyle DM search and shortcuts**

In the DM mode template, use rounded Feishu rows:

```vue
<div class="p-3">
  <div class="relative">
    <Search :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
    <Input v-model="dmSearch" :placeholder="t('chat.search_conversations')" class="h-9 rounded-2xl border-transparent bg-background/70 pl-9 text-xs" />
  </div>
</div>
```

Use this class for shortcut buttons:

```vue
class="mx-3 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground"
```

- [ ] **Step 3: Restyle DM list items**

For DM buttons, use:

```vue
class="group relative flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-sm transition-all duration-150 hover:bg-sidebar-accent"
:class="normalizeRoomId(dm.roomId) === activeDmRoomId && 'workspace-row-selected'"
```

- [ ] **Step 4: Restyle server mode header and quick entries**

For the server dropdown trigger button, use:

```vue
class="flex w-full items-center justify-between border-b border-sidebar-border/80 px-4 py-3.5 font-semibold text-foreground transition-all hover:bg-sidebar-accent"
:class="open && 'bg-sidebar-accent'"
```

For quick entries, use:

```vue
class="group flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground"
```

- [ ] **Step 5: Restyle UserPanel**

In `UserPanel.vue`, set the root class to:

```vue
<div class="user-panel flex shrink-0 items-center gap-2 border-t border-sidebar-border/80 bg-sidebar/90 px-3 py-2.5 backdrop-blur-xl">
```

Use action button classes:

```vue
class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground active:scale-95"
```

- [ ] **Step 6: Restyle TextChannelItem selected state**

In `TextChannelItem.vue`, change selected class to:

```vue
isSelected
  ? 'workspace-row-selected font-medium'
  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
```

- [ ] **Step 7: Run checks**

Run:

```bash
pnpm type-check
pnpm vitest run tests/unit/workspace/navigation.test.ts tests/components/WorkspaceAppRail.test.ts
```

Expected: PASS.

---

## Task 6: Core page surfaces

**Files:**

- Modify: `src/features/contacts/components/ContactsPage.vue`
- Modify: `src/features/settings/components/SettingsPage.vue`

- [ ] **Step 1: Update ContactsPage shell**

In `ContactsPage.vue`, change the root/sidebar classes:

```vue
<div class="flex h-full min-w-0 bg-background">
  <div class="workspace-panel flex w-[308px] shrink-0 flex-col rounded-none border-l-0 border-y-0 bg-sidebar/95 backdrop-blur-xl">
```

Remove the `VoiceStatusBar` and `UserPanel` imports and bottom usage from ContactsPage; user controls now live in the workspace shell/message context.

- [ ] **Step 2: Update ContactsPage header and group rows**

Use this header class:

```vue
<div class="flex items-center justify-between border-b border-sidebar-border/80 p-3.5">
```

Use this group row class:

```vue
class="mx-2 flex cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 transition-all"
:class="selectedGroupId === group.roomId ? 'workspace-row-selected' : 'hover:bg-sidebar-accent'"
```

- [ ] **Step 3: Update SettingsPage shell**

In `SettingsPage.vue`, change the top-level template to:

```vue
<div class="flex h-full min-w-0 bg-background">
  <nav class="workspace-panel w-[260px] shrink-0 rounded-none border-l-0 border-y-0 p-3">
    <div class="mb-4 flex h-11 items-center gap-2 px-2">
      <Settings :size="20" class="text-primary" />
      <h1 class="text-base font-semibold">{{ t('settings.settings') }}</h1>
    </div>

    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="mb-1 flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm transition-all"
      :class="activeTab === tab.id ? 'workspace-row-selected' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'"
      @click="activeTab = tab.id"
    >
      <component :is="tab.icon" :size="16" />
      {{ tab.label() }}
    </button>
  </nav>

  <div class="min-w-0 flex-1 overflow-y-auto p-6">
    <div class="mx-auto max-w-[860px] rounded-3xl border border-border/70 bg-card/95 p-6 shadow-[0_18px_45px_color-mix(in_srgb,var(--color-foreground)_7%,transparent)]">
      <ProfileSettings v-if="activeTab === 'profile'" />
      <GeneralSettings v-else-if="activeTab === 'general'" />
      <NotificationSettings v-else-if="activeTab === 'notifications'" />
      <AppearanceSettings v-else-if="activeTab === 'appearance'" />
      <ShortcutSettings v-else-if="activeTab === 'shortcuts'" />
      <SecuritySettings v-else-if="activeTab === 'security'" />
      <AboutPage v-else-if="activeTab === 'about'" />
    </div>
  </div>
</div>
```

- [ ] **Step 4: Run checks**

Run:

```bash
pnpm type-check
```

Expected: PASS.

---

## Task 7: Secondary app page frame

**Files:**

- Create: `src/app/components/workspace/WorkspacePageFrame.vue`
- Modify: `src/features/calendar/components/CalendarPage.vue`
- Modify: `src/features/docs/components/DocsPage.vue`
- Modify: `src/features/approvals/components/ApprovalsPage.vue`
- Modify: `src/features/email/components/EmailPage.vue`
- Modify: `src/features/calls/components/CallsPage.vue`

- [ ] **Step 1: Create WorkspacePageFrame**

Create `src/app/components/workspace/WorkspacePageFrame.vue`:

```vue
<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title: string
  subtitle?: string
  icon: Component
}>()
</script>

<template>
  <section class="flex h-full min-w-0 flex-1 flex-col bg-background">
    <header class="flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-card/80 px-7 backdrop-blur-xl">
      <div class="flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <component :is="icon" :size="21" />
        </div>
        <div>
          <h1 class="text-base font-semibold text-foreground">
            {{ title }}
          </h1>
          <p v-if="subtitle" class="text-xs text-muted-foreground">
            {{ subtitle }}
          </p>
        </div>
      </div>
      <slot name="actions" />
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto p-6">
      <div class="mx-auto w-full max-w-[960px]">
        <slot />
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Wrap CalendarPage**

In `CalendarPage.vue`, import `WorkspacePageFrame` and replace the outer header/content shell with:

```vue
<WorkspacePageFrame :title="t('sidebar.calendar')" :subtitle="t('calendar.today_events')" :icon="Calendar">
  <template #actions>
    <button class="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-[0_8px_20px_color-mix(in_srgb,var(--color-primary)_24%,transparent)] hover:bg-primary/90">
      <Plus :size="14" />
      {{ t('calendar.new_event') }}
    </button>
  </template>
  <!-- existing calendar content without its old page header -->
</WorkspacePageFrame>
```

- [ ] **Step 3: Wrap DocsPage**

In `DocsPage.vue`, import `WorkspacePageFrame` and use:

```vue
<WorkspacePageFrame :title="t('docs.title')" :subtitle="t('docs.recent_docs')" :icon="FileText">
  <template #actions>
    <button class="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-[0_8px_20px_color-mix(in_srgb,var(--color-primary)_24%,transparent)] hover:bg-primary/90">
      <Plus :size="14" />
      {{ t('docs.new_doc') }}
    </button>
  </template>
  <!-- existing docs content without its old page header -->
</WorkspacePageFrame>
```

- [ ] **Step 4: Wrap ApprovalsPage**

In `ApprovalsPage.vue`, import `WorkspacePageFrame` and use:

```vue
<WorkspacePageFrame :title="t('approvals.title')" :subtitle="t('approvals.coming_soon')" :icon="CheckSquare">
  <!-- existing approval stats and empty state -->
</WorkspacePageFrame>
```

- [ ] **Step 5: Wrap EmailPage**

In `EmailPage.vue`, use `WorkspacePageFrame` for the app shell but keep the mail folder sidebar inside the frame content:

```vue
<WorkspacePageFrame :title="t('email.title')" :subtitle="t('email.coming_soon')" :icon="Mail">
  <template #actions>
    <button class="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      {{ t('email.compose') }}
    </button>
  </template>
  <!-- existing email sidebar/content, restyled as an inner rounded card -->
</WorkspacePageFrame>
```

- [ ] **Step 6: Wrap CallsPage**

In `CallsPage.vue`, use:

```vue
<WorkspacePageFrame :title="t('calls.history')" :subtitle="t('sidebar.video_meetings')" :icon="Phone">
  <!-- existing empty/history content -->
</WorkspacePageFrame>
```

- [ ] **Step 7: Run checks**

Run:

```bash
pnpm type-check
```

Expected: PASS.

---

## Task 8: Final verification and visual pass

**Files:**

- No planned source edits unless verification finds issues.

- [ ] **Step 1: Run unit/component tests**

Run:

```bash
pnpm vitest run tests/unit/workspace/navigation.test.ts tests/components/WorkspaceAppRail.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run type checking**

Run:

```bash
pnpm type-check
```

Expected: PASS.

- [ ] **Step 3: Run linting**

Run:

```bash
pnpm lint
```

Expected: PASS, or fix only errors introduced by this implementation.

- [ ] **Step 4: Start desktop client**

Run:

```bash
pnpm dev
```

Expected: Vite starts on `http://localhost:1420/`, Cargo runs `target/debug/muon`, and the desktop client opens.

- [ ] **Step 5: Visual inspection checklist**

Inspect these routes in the app or browser fallback:

- `/dm` shows app-first rail and message business sidebar.
- `/contacts` shows app rail plus contacts workspace layout.
- `/settings` shows app rail plus settings sidebar/card.
- `/calendar`, `/docs`, `/approvals`, `/email`, `/calls` use the shared workspace page frame.
- Toggle dark mode and confirm rail/sidebar/cards remain readable.

Expected: Core routes are usable and visually aligned with Modern Feishu Pro.

---

## Self-review

- Spec coverage: workspace shell, app-first rail, messaging-owned Matrix hierarchy, contacts/settings core pages, secondary app frames, light/dark tokens, accessibility states, and verification are covered.
- Placeholder scan: no TBD/TODO/later placeholders remain.
- Type consistency: `WorkspaceAppId`, `WorkspaceApp`, `workspaceApps`, `getWorkspaceAppForPath`, `WorkspaceAppRail`, `WorkspaceLayout`, and `WorkspacePageFrame` names are used consistently across tasks.

## Execution choice

The user authorized autonomous execution. Use inline execution in this session with `superpowers:executing-plans`. Do not create git commits unless the user explicitly asks for commits.
