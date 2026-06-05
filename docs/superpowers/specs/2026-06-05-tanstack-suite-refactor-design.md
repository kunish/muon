# TanStack Suite Refactor Design

**Date:** 2026-06-05
**Status:** Approved design, awaiting written-spec review
**Author / brainstorm partner:** shikun + Claude
**Decision:** Refactor the state, form, and table layers onto the Vue-adapter TanStack suite. Fully eliminate Pinia (client state -> `@tanstack/vue-store`, server state -> `@tanstack/vue-query`), adopt `@tanstack/vue-form` + `zod` for forms and `@tanstack/vue-table` for data tables, keep `vue-router`, and drop Pacer. Sequence the work in five layered phases with Pinia removed only in the final phase.

## Goal

Replace Muon's Pinia-based state management with the TanStack Vue ecosystem, splitting each store into the layer that actually fits its data:

- **Client/UI state** (toggles, drafts, view modes, ephemeral selection) -> `@tanstack/vue-store` using the native `createStore`/`useStore` API.
- **Server state** (data sourced from Dexie/IndexedDB, matrix-js-sdk, or IPC) -> `@tanstack/vue-query`, with a configured `QueryClient` and per-feature query-key factories.

Additionally adopt two TanStack libraries that currently have no equivalent in the codebase:

- `@tanstack/vue-form` + `zod` for form state and validation.
- `@tanstack/vue-table` for headless data tables.

This is a state-architecture migration, not a product behavior change. Chat, docs, calls, calendar, projects, contacts, email, server admin, settings, and auth behavior must stay observably unchanged. The migration is staged so the app builds and ships at the end of every phase, and Pinia is only uninstalled once the last store is migrated.

## Current State

State management today is entirely Pinia. There are **22 `defineStore` stores** (confirmed via `grep -rl defineStore`):

- `apps/desktop/src/app/stores/globalUiStore.ts`
- `apps/desktop/src/shared/stores/settingsStore.ts`
- `apps/desktop/src/features/chat/stores/` — `chatStore.ts`, `decisionStore.ts`, `deferStore.ts`, `digestStore.ts`, `downloadStore.ts`, `inboxStore.ts`, `qaStore.ts`, `retrievalStore.ts`, `scheduledMessageStore.ts`, `stickerStore.ts`, `taskStore.ts`
- `apps/desktop/src/features/contacts/stores/contactStore.ts`
- `apps/desktop/src/features/docs/stores/docsStore.ts`
- `apps/desktop/src/features/email/stores/mailAccountStore.ts`
- `apps/desktop/src/features/projects/composables/useProjectStore.ts`, `useWorkItemStore.ts`
- `apps/desktop/src/features/server/stores/serverStore.ts`
- `apps/desktop/src/features/workplace/stores/workplaceStore.ts`
- `apps/desktop/src/features/calendar/stores/calendarStore.ts`
- `apps/desktop/src/features/calls/stores/callStore.ts`

Size/consumer signals that drive sequencing and risk: `chatStore` is the largest blast radius (523 lines, 29 consumers); `docsStore` is the largest file (1185 lines); `serverStore` is 358 lines / 18 consumers; `callStore` 314 lines; `decisionStore` 188 lines; `calendarStore` 185 lines; `settingsStore` 97 lines / 13 consumers; `globalUiStore` 38 lines / 4 consumers. Remaining stores are small single-feature stores.

Relevant facts:

- `apps/desktop/src/app/plugins/index.ts` registers `VueQueryPlugin` with **no** custom `QueryClient` and no `defaultOptions`. Plugin order is pinia -> settings sync -> i18n locale -> VueQueryPlugin -> i18n -> router.
- `@tanstack/vue-query ^5.x` is installed but has **0 call sites**. Query conventions must be established from scratch.
- `@tanstack/vue-virtual ^3.13.24` is in use (`UnifiedInboxPanel.vue`, `GlobalSearch.vue`) and is **kept as-is**.
- Many stores wrap async work in the `effect` library (`runDesktopSync`/Effect pipelines). These must be unwound into plain `queryFn`/`mutationFn`.
- `apps/desktop/tests/setup.ts` lines 64-66 run a global `beforeEach(() => setActivePinia(createPinia()))`. This is the single test-side migration chokepoint.
- `pnpm-workspace.yaml` catalog already has `@tanstack/vue-query`, `@tanstack/vue-virtual`, `pinia`, `vue-router`, `vue`, `zod`, `effect`, `dexie`. New catalog entries are needed for `@tanstack/vue-store`, `@tanstack/vue-table`, `@tanstack/vue-form`.

`apps/desktop/src/shared/safeStorageStore.ts` and `apps/desktop/src/features/settings/stores/settingsStore.ts` are **not** Pinia stores (no `defineStore`) and are out of scope.

## Store Classification

Each store is classified by what its data actually is, which determines its target layer and phase.

### Pure client state -> `@tanstack/vue-store`

Toggles, drafts, view modes, ephemeral selection. No remote source of truth.

- P1: `globalUiStore`, `shared/stores/settingsStore`, `scheduledMessageStore`, `inboxStore`, `stickerStore`, `taskStore`, `workplaceStore`, `deferStore`
- P4 (final phase): `calendarStore`, `callStore`

`calendarStore` and `callStore` migrate last because `callStore` is a real-time state machine and `calendarStore` carries time-window view state; both are higher-churn UI state best moved once the Query/Store conventions are proven.

### Pure server state -> `@tanstack/vue-query`

- P2: `decisionStore` (188 lines, reads/writes decision data with no meaningful local-only UI state).

### Mixed -> split into Query (server) + Store (client)

Server-sourced data moves to Query; the remaining UI/draft state moves to Store. The original store file is deleted once both halves land.

- P3: `chatStore` (pin/mute -> Query; drafts/UI -> Store; **highest risk**, 29 consumers), `docsStore` (1185 lines), `serverStore` (18 consumers), `qaStore`, `downloadStore`, `retrievalStore`, `digestStore`, `useProjectStore`, `useWorkItemStore`, `contactStore`, `mailAccountStore`.

Counts: 10 client-state + 1 server-state + 11 mixed = 22.

## Target Architecture

### Server-state layer (Query)

New directory `apps/desktop/src/shared/query/`:

- `queryClient.ts` exports a configured `QueryClient` with explicit `defaultOptions` (`staleTime`, `gcTime`, `retry`, `refetchOnWindowFocus`). `app/plugins/index.ts` passes this client to `VueQueryPlugin` instead of the current bare registration.
- Each feature owns a query-key factory colocated with its feature, e.g. `chatKeys.pinned(roomId)`, `serverKeys.members(serverId)`. **No** inline string keys anywhere.
- `effect`/`runDesktopSync` async pipelines are unwound into plain async `queryFn`/`mutationFn`. Reads become `useQuery`; writes become `useMutation` followed by targeted `invalidateQueries` (or `setQueryData` where optimistic update is already expected).

### Client-state layer (Store)

Native `@tanstack/vue-store` only — no wrapper helper. Each store file exports:

- A store instance: `export const xxxStore = new Store(initialState)`.
- Plain function actions that call `xxxStore.setState(...)`, e.g. `export function setSidebarOpen(open: boolean) { xxxStore.setState(s => ({ ...s, sidebarOpen: open })) }`.
- Derived values via `new Derived({ deps, fn })` where computed state is needed.
- Explicit persistence per store where the Pinia version used `useStorage`: subscribe to the store and write to `localStorage` directly, and hydrate the initial state from `localStorage` at module load. This replaces the implicit `@vueuse/core` `useStorage` reactivity.

Consumers read with `useStore(xxxStore, selector)` and call the exported action functions. Every consumer site is updated; there is no Pinia-compatibility shim.

### Forms layer

`@tanstack/vue-form` + `zod`. A `zod` schema defines validation; `useForm` owns field state and submission. Duplicate forms (the group-creation form duplicated across `NewChatDialog.vue` and `contacts/components/CreateGroupDialog.vue`) share one `zod` schema.

Priority targets: `apps/admin/src/AdminApp.vue` (6 forms, strongest case), `auth/components/LoginPage.vue`, `email/components/EmailPage.vue`, `WorkItemCreateDialog.vue`, the shared group form, `CreateChannelDialog.vue`, `ServerOverview.vue`, `ProjectSettings.vue`, `TaskComposerDialog.vue`, `RoleManager.vue`, `ProjectCreateDialog.vue`, plus the field-array forms `settings/CustomFieldEditor.vue` and `settings/WorkflowEditor.vue`.

### Tables layer

`@tanstack/vue-table` (headless) drives column defs, sorting, and row models while keeping existing `@muon/ui` markup. Targets: `apps/admin/src/AdminApp.vue` (4 tables), `projects/components/view/ListView.vue` (real `<table>` with existing sorting), `server/components/MemberManager.vue`.

### What stays

- `vue-router` is kept (TanStack Router has no Vue adapter). Desktop's 22 routes, nested layout, async auth guard, and lazy imports are unchanged; admin's hash-history menu is unchanged.
- `@tanstack/vue-virtual` usage is unchanged.
- Pacer is dropped: `@tanstack/vue-pacer` does not exist, and the single debounce site is covered by `@vueuse/core` or a small local utility.

## Phased Migration

The app must build, type-check, and pass tests at the end of every phase. Pinia and TanStack coexist through P1-P3.

| Phase | Scope | Risk | Verification focus |
| --- | --- | --- | --- |
| **P0 Foundation** | Add `@tanstack/vue-store`, `@tanstack/vue-table`, `@tanstack/vue-form` to the catalog and desktop/admin deps. Create `shared/query/queryClient.ts` and the query-key factory convention. Wire the configured `QueryClient` into `VueQueryPlugin`. Pinia untouched. | Low | App boots; build passes. |
| **P1 Pure UI stores** | Migrate the 8 P1 client-state stores to native `vue-store`, including explicit persistence where `useStorage` was used. Update all consumers. | Low | Per-consumer unit tests; manual smoke of toggles/drafts. |
| **P2 Pure server store** | Migrate `decisionStore` to `vue-query` (key factory + `useQuery`/`useMutation`). | Medium | MSW-backed integration tests. |
| **P3 Mixed stores** | Split the 11 mixed stores into Query + Store halves, deleting each original store file. Start with lower-consumer stores; do `chatStore`/`docsStore`/`serverStore` last within the phase. | High | Per-store regression; targeted tests before deleting each original. |
| **P4 Final removal** | Migrate `calendarStore` and `callStore` to `vue-store`. Remove Pinia from deps and `app/plugins/index.ts`. Delete the `setActivePinia` chokepoint in `tests/setup.ts` and replace it with per-store `setState(initialState)` resets. | Medium | Full `type-check` + `test:unit` + `build`. |

## Test Migration

`apps/desktop/tests/setup.ts` lines 64-66 are the single chokepoint:

```ts
beforeEach(() => {
  setActivePinia(createPinia())
})
```

- During P1-P3, this `beforeEach` stays so still-Pinia stores keep working. Migrated `vue-store` stores reset themselves in their own test files via `xxxStore.setState(initialState)`.
- In P4, after the last store is migrated, delete the `setActivePinia` block and the `pinia`/`createPinia` imports. Introduce a small shared test helper that resets all migrated stores to their initial state in a global `beforeEach`, so test isolation is preserved without Pinia.
- Query-layer tests use a fresh `QueryClient` per test (no shared cache) to keep tests isolated; MSW continues to back the network layer.

## Verification

Per-phase verification (run from repo root):

```bash
pnpm type-check
pnpm test:unit
pnpm build:desktop
```

Admin-affecting phases (P0 form/table foundation, and any phase touching `apps/admin`) additionally run:

```bash
pnpm --filter @muon/admin build
```

Final regression after P4:

```bash
pnpm lint
pnpm build
```

Run `pnpm test:e2e` when a phase changes observable chat/docs/calls routing or interaction beyond internal state wiring.

## Guardrails

- Do not change observable behavior of chat, docs, calls, calendar, projects, contacts, email, server admin, settings, or auth.
- Do not migrate `vue-router` to TanStack Router.
- Do not introduce a `vue-store` wrapper/helper abstraction; use the native API directly.
- Do not introduce inline Query string keys; every key comes from a feature key factory.
- Do not leave Pinia and a migrated store as two sources of truth for the same data — delete the original store file when its replacement lands.
- Do not uninstall Pinia before P4; keep the app shippable at each phase boundary.
- Do not change `@tanstack/vue-virtual` usage.
- Do not revert or delete unrelated dirty worktree changes.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| `chatStore` (29 consumers) split breaks chat behavior | Migrate it last in P3; land the Store half and Query half behind the same public call surface; run chat component tests before deleting the original. |
| `effect`/`runDesktopSync` pipelines hide error/retry semantics when unwound to `queryFn` | Preserve existing error propagation explicitly; configure `retry` in `queryClient.ts` to match prior behavior; no silent catch-all. |
| `useStorage` -> explicit `localStorage` loses reactivity or key compatibility | Reuse the exact same storage keys; hydrate at module load and subscribe-to-persist; add a unit test asserting round-trip persistence. |
| Pinia/TanStack coexistence causes double sources of truth mid-migration | A store is either fully Pinia or fully migrated within a phase; never split a single store's data across both systems across a phase boundary. |
| Test isolation regresses when `setActivePinia` is removed | Replace with an explicit all-stores reset helper in `beforeEach` and a per-test fresh `QueryClient`. |
| Form/table adoption scope creeps beyond listed targets | Limit `vue-form`/`vue-table` to the enumerated files; other forms/tables are out of scope for this refactor. |

## Non-Goals

- Migrating to React or to TanStack Router/Start.
- Rewriting `@tanstack/vue-virtual` usage.
- Adopting Pacer or any debounce/throttle library beyond the existing `@vueuse` utility.
- Changing Matrix SDK, Dexie schema, or IPC contracts.
- Converting every form/table in the app; only the enumerated targets are in scope.
- Behavioral/product changes of any kind.
