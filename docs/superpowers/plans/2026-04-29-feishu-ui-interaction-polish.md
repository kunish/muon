# Feishu UI Interaction Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Muon's Feishu-style workspace interactions consistent across rows, menus, cards, and empty states.

**Architecture:** Add shared workspace interaction utilities in `main.css`, then migrate common row/menu/card surfaces to those classes. Keep routing and Matrix business behavior unchanged.

**Tech Stack:** Vue 3, Tailwind CSS v4, reka-ui context menu primitives, Vitest, agent-browser.

---

## File map

### Modify

- `src/app/main.css` — add reusable workspace interaction utilities.
- `src/features/server/components/ChannelSidebar.vue` — full-width sidebar rows, `select-none`, and consistent menu triggers.
- `src/features/chat/components/ConversationContextMenu.vue` — prevent accidental text selection and align manual menu visuals.
- `src/features/server/components/ChannelContextMenu.vue` — align reka context menu visuals and destructive item behavior.
- `src/shared/components/ui/context-menu/ContextMenuContent.vue` — Feishu-style default menu container.
- `src/shared/components/ui/context-menu/ContextMenuItem.vue` — Feishu-style default menu item.
- `src/app/components/workspace/WorkspaceAppRail.vue` — prevent accidental label selection.
- `src/features/server/components/TextChannelItem.vue` — use shared row utility and `select-none`.
- `src/features/contacts/components/ContactsPage.vue` — use shared row utility for group rows.
- `src/features/settings/components/SettingsPage.vue` — use shared row utility for tab rows.
- `src/features/email/components/EmailPage.vue` — use shared row utility for folder rows.
- `src/features/docs/components/DocsPage.vue` — align clickable cards/list rows.
- `src/features/calendar/components/CalendarPage.vue` — align action buttons/calendar cells.
- `src/features/approvals/components/ApprovalsPage.vue` — align empty state surface.
- `src/features/calls/components/CallsPage.vue` — align call history rows and empty state surface.

---

## Task 1: Shared interaction utilities

**Files:**

- Modify: `src/app/main.css`

- [ ] **Step 1: Add workspace interaction classes**

In `src/app/main.css`, inside existing `@layer components`, add these classes after `.workspace-row-selected`:

```css
.workspace-row {
  @apply flex w-full select-none items-center rounded-2xl text-sm transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground;
}

.workspace-row-active {
  @apply bg-primary/12 text-foreground;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 24%, transparent);
}

.workspace-menu {
  @apply z-50 min-w-44 select-none overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-1.5 text-popover-foreground shadow-[0_18px_45px_color-mix(in_srgb,var(--color-foreground)_14%,transparent)] backdrop-blur-xl;
}

.workspace-menu-item {
  @apply relative flex cursor-default select-none items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] outline-none transition-all duration-100 hover:bg-accent focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0;
}

.workspace-menu-item-destructive {
  @apply text-destructive hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] focus:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] focus:text-destructive;
}

.workspace-empty-state {
  @apply flex flex-col items-center justify-center rounded-3xl border border-border/70 bg-card/70 text-muted-foreground;
}
```

- [ ] **Step 2: Run scoped lint**

Run:

```bash
pnpm eslint src/app/main.css
```

Expected: exit 0.

---

## Task 2: Message sidebar row and menu polish

**Files:**

- Modify: `src/features/server/components/ChannelSidebar.vue`
- Modify: `src/features/chat/components/ConversationContextMenu.vue`
- Modify: `src/features/server/components/TextChannelItem.vue`

- [ ] **Step 1: Make message shortcut rows full-width**

In `ChannelSidebar.vue`, change Friends, Tasks, and Knowledge buttons to use this class:

```vue
class="workspace-row mx-3 w-[calc(100%-24px)] gap-3 px-3 py-2 font-medium text-muted-foreground"
```

For Knowledge, keep the active binding but change it to:

```vue
:class="chatStore.activeSidePanel === 'knowledge' && 'workspace-row-active'"
```

- [ ] **Step 2: Make DM rows non-selectable full interaction rows**

In `ChannelSidebar.vue`, change the DM row button class to:

```vue
class="workspace-row group relative gap-2.5 px-3 py-2 text-muted-foreground"
:class="normalizeRoomId(dm.roomId) === activeDmRoomId && 'workspace-row-active'"
```

- [ ] **Step 3: Align manual conversation context menu**

In `ConversationContextMenu.vue`, change menu container class to:

```vue
class="workspace-menu ctx-menu fixed"
```

For normal menu buttons, use:

```vue
class="workspace-menu-item mx-0 w-full text-foreground active:scale-[0.98]"
```

For the leave button, use:

```vue
class="workspace-menu-item workspace-menu-item-destructive mx-0 w-full active:scale-[0.98]"
```

- [ ] **Step 4: Align text channel row**

In `TextChannelItem.vue`, change the button class to:

```vue
class="workspace-row group gap-2 px-3 py-2 text-muted-foreground"
```

Change the selected branch to:

```text
? 'workspace-row-active font-medium'
: 'hover:bg-sidebar-accent hover:text-foreground'
```

- [ ] **Step 5: Run checks**

Run:

```bash
pnpm type-check
pnpm eslint src/features/server/components/ChannelSidebar.vue src/features/chat/components/ConversationContextMenu.vue src/features/server/components/TextChannelItem.vue
```

Expected: exit 0.

---

## Task 3: Context menu primitive polish

**Files:**

- Modify: `src/shared/components/ui/context-menu/ContextMenuContent.vue`
- Modify: `src/shared/components/ui/context-menu/ContextMenuItem.vue`
- Modify: `src/features/server/components/ChannelContextMenu.vue`

- [ ] **Step 1: Update default context menu container**

In `ContextMenuContent.vue`, replace the default class string with:

```ts
'workspace-menu animate-in fade-in-0 zoom-in-95'
```

- [ ] **Step 2: Update default context menu item**

In `ContextMenuItem.vue`, replace the default class string with:

```ts
'workspace-menu-item'
```

Keep `inset && 'pl-8'` and `props.class`.

- [ ] **Step 3: Remove duplicated old menu item classes**

In `ChannelContextMenu.vue`, simplify normal `ContextMenuItem` classes to:

```vue
class="cursor-pointer"
```

For destructive delete item, use:

```vue
class="workspace-menu-item-destructive cursor-pointer"
```

Keep all `@select` handlers unchanged.

- [ ] **Step 4: Run checks**

Run:

```bash
pnpm type-check
pnpm eslint src/shared/components/ui/context-menu/ContextMenuContent.vue src/shared/components/ui/context-menu/ContextMenuItem.vue src/features/server/components/ChannelContextMenu.vue
```

Expected: exit 0.

---

## Task 4: Full-app row/card/empty state pass

**Files:**

- Modify: `src/app/components/workspace/WorkspaceAppRail.vue`
- Modify: `src/features/contacts/components/ContactsPage.vue`
- Modify: `src/features/settings/components/SettingsPage.vue`
- Modify: `src/features/email/components/EmailPage.vue`
- Modify: `src/features/docs/components/DocsPage.vue`
- Modify: `src/features/calendar/components/CalendarPage.vue`
- Modify: `src/features/approvals/components/ApprovalsPage.vue`
- Modify: `src/features/calls/components/CallsPage.vue`

- [ ] **Step 1: App rail labels should not select text**

In `WorkspaceAppRail.vue`, add `select-none` to the root `nav` class.

- [ ] **Step 2: Contacts and Settings rows use shared utility**

In `ContactsPage.vue`, make group rows use:

```vue
class="workspace-row mx-2 gap-2 px-3 py-2 text-muted-foreground"
:class="selectedGroupId === group.roomId ? 'workspace-row-active' : ''"
```

In `SettingsPage.vue`, make tab buttons use:

```vue
class="workspace-row mb-1 gap-2 px-3 py-2 text-muted-foreground"
:class="activeTab === tab.id ? 'workspace-row-active' : ''"
```

- [ ] **Step 3: Email folder rows use shared utility**

In `EmailPage.vue`, make folder buttons use:

```vue
class="workspace-row mb-1 gap-2 px-3 py-2 text-muted-foreground"
:class="folder.active ? 'workspace-row-active text-primary' : ''"
```

- [ ] **Step 4: Docs clickable cards and rows use select-none**

In `DocsPage.vue`, add `select-none` to quick access buttons and recent doc rows.

- [ ] **Step 5: Calendar controls use select-none**

In `CalendarPage.vue`, add `select-none` to month navigation buttons, the month label, and clickable day cells.

- [ ] **Step 6: Empty state surfaces use shared utility**

In `ApprovalsPage.vue` and `CallsPage.vue`, replace empty state outer class prefixes with `workspace-empty-state` while preserving their size/spacing classes.

- [ ] **Step 7: Run checks**

Run:

```bash
pnpm type-check
pnpm eslint src/app/components/workspace/WorkspaceAppRail.vue src/features/contacts/components/ContactsPage.vue src/features/settings/components/SettingsPage.vue src/features/email/components/EmailPage.vue src/features/docs/components/DocsPage.vue src/features/calendar/components/CalendarPage.vue src/features/approvals/components/ApprovalsPage.vue src/features/calls/components/CallsPage.vue
```

Expected: exit 0.

---

## Task 5: Final verification

**Files:**

- No planned source edits unless verification finds issues.

- [ ] **Step 1: Run full lint**

Run:

```bash
pnpm lint
```

Expected: exit 0.

- [ ] **Step 2: Run full unit tests**

Run:

```bash
pnpm test:unit
```

Expected: all test files pass.

- [ ] **Step 3: Run type checking**

Run:

```bash
pnpm type-check
```

Expected: exit 0.

- [ ] **Step 4: Verify core routes in browser fallback**

Run:

```bash
set -e
for item in 'dm|选择一个会话开始聊天' 'contacts|联系人' 'settings|个人资料' 'calendar|日历' 'docs|文档' 'approvals|审批' 'email|邮件' 'calls|通话记录'; do
  route=${item%%|*}
  expected=${item#*|}
  agent-browser --session muon-feishu open "http://localhost:1420/$route" >/dev/null
  agent-browser --session muon-feishu eval "localStorage.setItem('muon_auth', JSON.stringify({serverUrl:'http://127.0.0.1:6167', userId:'@visual:localhost', accessToken:'visual-token', deviceId:'VISUAL'})); import('/src/matrix/sync.ts').then((m) => { m.syncState.value = 'PREPARED' })" >/dev/null
  agent-browser --session muon-feishu wait 250 >/dev/null
  text=$(agent-browser --session muon-feishu get text body)
  printf '%s -> ' "$route"
  printf '%s' "$text" | grep -q "$expected"
  echo "$expected"
done
agent-browser --session muon-feishu eval "localStorage.setItem('muon_theme', 'dark'); document.documentElement.classList.add('dark'); document.documentElement.className"
```

Expected: every route prints its marker and final output is `"dark"`.

## Self-review

- Spec coverage: row hover width, text selection prevention, menu visual polish, full-app rows/cards/empty state polish, and verification are covered.
- Placeholder scan: no TBD/TODO/later placeholders remain.
- Type consistency: workspace utility class names are consistent across all tasks.

## Execution choice

The user authorized autonomous execution. Use inline execution in this session. Do not create git commits unless explicitly requested.
