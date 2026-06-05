# TanStack P1 — globalUiStore Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `globalUiStore` from Pinia to native `@tanstack/vue-store`, converting its 4 consumers and rewriting its unit test, with zero observable behavior change.

**Architecture:** Replace the Pinia setup store with a module-level `new Store<GlobalUiState>(...)` plus plain exported action functions. Consumers read reactive values via `useSelector(store, selector)` (templates) or `store.state.x` (imperative event handlers), and call the imported action functions directly. No wrapper helper. This is the **reference pattern** for the remaining 7 P1 stores.

**Tech Stack:** Vue 3, `@tanstack/vue-store@0.11` (`Store`, `useSelector`), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-05-tanstack-suite-refactor-design.md` (P1 Pure UI stores).

---

## Reference Pattern (applies to all P1 stores)

This is the first P1 migration; the conventions it establishes are reused by the other 7 stores.

**Store module shape** (native, no wrapper):

```ts
import { Store } from '@tanstack/vue-store'

export interface XState { /* fields */ }

function createInitialState(): XState { /* fresh object every call */ return { /* ... */ } }

export const xStore = new Store<XState>(createInitialState())

export function someAction(arg: T): void {
  xStore.setState((s) => ({ ...s, field: arg }))   // updater MUST be (prev) => next
}

/** Test isolation + future logout cleanup. Reconstructs fresh state. */
export function resetXStore(): void {
  xStore.setState(() => createInitialState())
}
```

**Consumer conversion:**
- Template reactive read → `const open = useSelector(xStore, (s) => s.open)` then use `open` in template (auto-unwrapped).
- Imperative read inside an event handler / non-reactive `.ts` → `xStore.state.open` (current snapshot).
- Action call → import the function and call it directly (`someAction()`), drop the `const x = useXStore()` handle.

**Test conversion:** static-import the store + actions + `resetXStore`; `beforeEach(() => resetXStore())`; assert on `xStore.state.field`. No `setActivePinia`, no dynamic `await import()`.

`xStore.state` is the synchronous snapshot getter; `xStore.setState((prev) => next)` takes a function updater; `useSelector(store, selector?, compare?)` returns `Readonly<Ref<TSelected>>`.

---

## File Structure

- `apps/desktop/src/app/stores/globalUiStore.ts` — **rewrite**: native vue-store + actions + `resetGlobalUiStore`.
- `apps/desktop/tests/unit/stores/globalUiStore.test.ts` — **rewrite**: new API, reset-based isolation.
- `apps/desktop/src/app/components/GlobalOverlayHost.vue` — **modify**: `useSelector` reads + action imports.
- `apps/desktop/src/app/composables/useGlobalShortcuts.ts` — **modify**: `globalUiStore.state.*` reads + action imports.
- `apps/desktop/src/app/components/workspace/WorkspaceAppRail.vue` — **modify**: action import for `@click`.
- `apps/desktop/src/features/chat/components/ConversationList.vue` — **modify**: action import for `@click`.

The Pinia export `useGlobalUiStore` is removed; all 4 consumers and the test are updated in lockstep so type-check is green at the end of Task 2.

---

### Task 1: Migrate the store module and rewrite its unit test

**Files:**
- Rewrite: `apps/desktop/src/app/stores/globalUiStore.ts`
- Rewrite test: `apps/desktop/tests/unit/stores/globalUiStore.test.ts`

- [ ] **Step 1: Rewrite the test to the new API (expect it to fail)**

Replace the entire contents of `apps/desktop/tests/unit/stores/globalUiStore.test.ts` with:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  closeGlobalSearch,
  closeNewChat,
  closeTransientOverlays,
  globalUiStore,
  openGlobalSearch,
  openNewChat,
  resetGlobalUiStore,
} from '@/app/stores/globalUiStore'

describe('globalUiStore', () => {
  beforeEach(() => {
    resetGlobalUiStore()
  })

  it('starts with globalSearchOpen and newChatOpen both false', () => {
    expect(globalUiStore.state.globalSearchOpen).toBe(false)
    expect(globalUiStore.state.newChatOpen).toBe(false)
  })

  it('openGlobalSearch sets globalSearchOpen to true', () => {
    openGlobalSearch()
    expect(globalUiStore.state.globalSearchOpen).toBe(true)
  })

  it('closeGlobalSearch sets globalSearchOpen to false', () => {
    openGlobalSearch()
    closeGlobalSearch()
    expect(globalUiStore.state.globalSearchOpen).toBe(false)
  })

  it('openNewChat sets newChatOpen to true', () => {
    openNewChat()
    expect(globalUiStore.state.newChatOpen).toBe(true)
  })

  it('closeNewChat sets newChatOpen to false', () => {
    openNewChat()
    closeNewChat()
    expect(globalUiStore.state.newChatOpen).toBe(false)
  })

  it('closeTransientOverlays closes both search and new chat', () => {
    openGlobalSearch()
    openNewChat()
    expect(globalUiStore.state.globalSearchOpen).toBe(true)
    expect(globalUiStore.state.newChatOpen).toBe(true)

    closeTransientOverlays()
    expect(globalUiStore.state.globalSearchOpen).toBe(false)
    expect(globalUiStore.state.newChatOpen).toBe(false)
  })

  it('global search and new chat can be open at the same time', () => {
    openGlobalSearch()
    openNewChat()
    expect(globalUiStore.state.globalSearchOpen).toBe(true)
    expect(globalUiStore.state.newChatOpen).toBe(true)
  })

  it('closing one overlay does not affect the other', () => {
    openGlobalSearch()
    openNewChat()

    closeGlobalSearch()
    expect(globalUiStore.state.globalSearchOpen).toBe(false)
    expect(globalUiStore.state.newChatOpen).toBe(true)

    openGlobalSearch()
    closeNewChat()
    expect(globalUiStore.state.globalSearchOpen).toBe(true)
    expect(globalUiStore.state.newChatOpen).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @muon/desktop test:unit -- globalUiStore.test.ts`
Expected: FAIL — the module has no exports `globalUiStore`, `openGlobalSearch`, `resetGlobalUiStore`, etc. (it still exports `useGlobalUiStore`).

- [ ] **Step 3: Rewrite the store as native vue-store**

Replace the entire contents of `apps/desktop/src/app/stores/globalUiStore.ts` with:

```ts
import { Store } from '@tanstack/vue-store'

export interface GlobalUiState {
  globalSearchOpen: boolean
  newChatOpen: boolean
}

function createInitialState(): GlobalUiState {
  return {
    globalSearchOpen: false,
    newChatOpen: false,
  }
}

export const globalUiStore = new Store<GlobalUiState>(createInitialState())

export function openGlobalSearch(): void {
  globalUiStore.setState((s) => ({ ...s, globalSearchOpen: true }))
}

export function closeGlobalSearch(): void {
  globalUiStore.setState((s) => ({ ...s, globalSearchOpen: false }))
}

export function openNewChat(): void {
  globalUiStore.setState((s) => ({ ...s, newChatOpen: true }))
}

export function closeNewChat(): void {
  globalUiStore.setState((s) => ({ ...s, newChatOpen: false }))
}

export function closeTransientOverlays(): void {
  closeGlobalSearch()
  closeNewChat()
}

/** Reset to initial state. Used by tests for isolation and by future logout cleanup. */
export function resetGlobalUiStore(): void {
  globalUiStore.setState(() => createInitialState())
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @muon/desktop test:unit -- globalUiStore.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/app/stores/globalUiStore.ts apps/desktop/tests/unit/stores/globalUiStore.test.ts
git commit -m "refactor(store): migrate globalUiStore to vue-store"
```

Note: full type-check is intentionally deferred to Task 2 — the 4 consumers still import the removed `useGlobalUiStore` until then.

---

### Task 2: Convert the 4 consumers and verify

**Files:**
- Modify: `apps/desktop/src/app/components/GlobalOverlayHost.vue`
- Modify: `apps/desktop/src/app/composables/useGlobalShortcuts.ts`
- Modify: `apps/desktop/src/app/components/workspace/WorkspaceAppRail.vue`
- Modify: `apps/desktop/src/features/chat/components/ConversationList.vue`

- [ ] **Step 1: Convert `GlobalOverlayHost.vue`** (template reactive reads + action calls)

Replace the entire file contents with:

```vue
<script setup lang="ts">
import NewChatDialog from '@/features/chat/components/NewChatDialog.vue';
import ConfirmDialogHost from '@/shared/components/ConfirmDialogHost.vue';
import { useSelector } from '@tanstack/vue-store';
import { closeGlobalSearch, closeNewChat, globalUiStore } from '../stores/globalUiStore';
import GlobalSearchDialog from './GlobalSearchDialog.vue';

const globalSearchOpen = useSelector(globalUiStore, (s) => s.globalSearchOpen);
const newChatOpen = useSelector(globalUiStore, (s) => s.newChatOpen);
</script>

<template>
  <ConfirmDialogHost />
  <GlobalSearchDialog v-if="globalSearchOpen" @close="closeGlobalSearch" />
  <NewChatDialog v-if="newChatOpen" @close="closeNewChat" />
</template>
```

- [ ] **Step 2: Convert `useGlobalShortcuts.ts`** (imperative snapshot reads + action calls)

In `apps/desktop/src/app/composables/useGlobalShortcuts.ts`:

Change the import on line 5 from:
```ts
import { useGlobalUiStore } from '../stores/globalUiStore'
```
to:
```ts
import {
  closeGlobalSearch,
  closeNewChat,
  closeTransientOverlays,
  globalUiStore,
  openGlobalSearch,
  openNewChat,
} from '../stores/globalUiStore'
```

Remove the handle on line 23 (`const globalUi = useGlobalUiStore()`) entirely (delete that line).

In `closeTopmostTransient()`, change:
```ts
    if (globalUi.globalSearchOpen) {
      globalUi.closeGlobalSearch()
      return true
    }

    if (globalUi.newChatOpen) {
      globalUi.closeNewChat()
      return true
    }
```
to:
```ts
    if (globalUiStore.state.globalSearchOpen) {
      closeGlobalSearch()
      return true
    }

    if (globalUiStore.state.newChatOpen) {
      closeNewChat()
      return true
    }
```

In `onKeydown()`, change `globalUi.openGlobalSearch()` → `openGlobalSearch()`, `globalUi.closeTransientOverlays()` → `closeTransientOverlays()`, and `globalUi.openNewChat()` → `openNewChat()`.

Change the Escape guard line:
```ts
    if (!globalUi.globalSearchOpen && !globalUi.newChatOpen && isEditableTarget(event.target)) return
```
to:
```ts
    if (!globalUiStore.state.globalSearchOpen && !globalUiStore.state.newChatOpen && isEditableTarget(event.target)) return
```

(The `chatStore` lines in `closeTopmostTransient` stay unchanged — chatStore is not part of P1.)

- [ ] **Step 3: Convert `WorkspaceAppRail.vue`** (action-only)

In `apps/desktop/src/app/components/workspace/WorkspaceAppRail.vue`:

Change the import on line 7 from:
```ts
import { useGlobalUiStore } from '../../stores/globalUiStore';
```
to:
```ts
import { openGlobalSearch } from '../../stores/globalUiStore';
```

Remove line 22 (`const globalUi = useGlobalUiStore();`).

Change the template handler on line 93 from `@click="globalUi.openGlobalSearch"` to `@click="openGlobalSearch"`.

- [ ] **Step 4: Convert `ConversationList.vue`** (action-only)

In `apps/desktop/src/features/chat/components/ConversationList.vue`:

Change the import on line 10 from:
```ts
import { useGlobalUiStore } from '@/app/stores/globalUiStore';
```
to:
```ts
import { openNewChat } from '@/app/stores/globalUiStore';
```

Remove line 21 (`const globalUi = useGlobalUiStore();`).

Change the template handler on line 114 from `@click="globalUi.openNewChat"` to `@click="openNewChat"`.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @muon/desktop type-check`
Expected: PASS — no remaining references to `useGlobalUiStore`.

- [ ] **Step 6: Confirm no stale references remain**

Run: `grep -rn "useGlobalUiStore" apps/desktop/src apps/desktop/tests`
Expected: no output (zero matches).

- [ ] **Step 7: Full unit suite + build + lint**

Run: `pnpm --filter @muon/desktop test:unit`
Expected: PASS, 1264 tests (same count as before — the globalUiStore test still has 8 cases).

Run: `pnpm --filter @muon/desktop build:web`
Expected: build succeeds.

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/app/components/GlobalOverlayHost.vue apps/desktop/src/app/composables/useGlobalShortcuts.ts apps/desktop/src/app/components/workspace/WorkspaceAppRail.vue apps/desktop/src/features/chat/components/ConversationList.vue
git commit -m "refactor(store): convert globalUiStore consumers to vue-store"
```

---

## Self-Review

- **Spec coverage:** Implements the P1 migration of `globalUiStore` (first of the 8 pure-UI stores) to native `@tanstack/vue-store` with `useSelector`, no wrapper helper, behavior preserved. Establishes the reference pattern (store+actions+reset, three consumer-conversion shapes, reset-based test isolation) reused by the remaining 7 stores.
- **No placeholders:** every code step shows full file contents or exact before/after; every run step has a command + expected result.
- **Type consistency:** the store exports used by the test and consumers — `globalUiStore`, `openGlobalSearch`, `closeGlobalSearch`, `openNewChat`, `closeNewChat`, `closeTransientOverlays`, `resetGlobalUiStore` — are exactly those defined in Task 1 Step 3. `useSelector` and `Store` come from `@tanstack/vue-store`. `globalUiStore.state` is the snapshot getter; `setState` takes a `(prev) => next` updater.
- **Behavior preservation:** `closeTransientOverlays` still closes both overlays; the Escape-guard logic reads the same two flags; the two `@click`-only consumers call the same actions. Pinia's `shallowRef(false)` initial values map to `createInitialState()`.
