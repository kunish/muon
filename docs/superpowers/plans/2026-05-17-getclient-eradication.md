# `getClient()` Eradication & Matrix Module as True Facade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `src/matrix/` the only place that imports `matrix-js-sdk`. Remove `getClient` from the public matrix facade (`src/matrix/index.ts`). Every feature-layer call site that today reads from or writes to the SDK goes through a matrix-module function — chat, server, projects, contacts, docs, shared, app. End state: `grep -rEn 'getClient|matrix-js-sdk' src/features/ src/app/ src/shared/` returns zero non-acceptance-exempted hits.

**Architecture:**
- New `src/matrix/projections/rooms.ts` defines `RoomDetail` (snapshot domain projection of an SDK `Room`, parallel to `RoomSummary` but richer — power levels, topic, creator, encryption state, member list). `toRoomDetail(room): RoomDetail` is pure, mirrors the `Message` pattern from `2026-05-17-message-domain-types.md` and inherits ADR-0003's snapshot + purity constraints.
- New `src/matrix/actions.ts` (or extended `rooms.ts` / `profile.ts`) exports the small action verbs feature code currently spells with raw SDK calls: `inviteUserToRoom`, `kickUserFromRoom`, `banUserFromRoom`, `redactRoomEvent`, `mxcToHttpUrl(mxc, w, h, method)`, `getHomeserverDomain()`. Most have homes already; this plan just fills gaps and routes callers.
- New `src/matrix/docs/` submodule owns the docs domain types and the SDK adapters. See `docs/adr/0004-docs-feature-matrix-domain.md`. Exports:
  - Types: `DocMetadata`, `DocFolders`, `DocShare`, `DocSyncEvent`.
  - Reads: `getDocMetadata(docId)`, `getDocFolders()`, `getDocShare(docId, userId)`.
  - Writes: `setDocMetadata(docId, metadata)`, `setDocFolders(folders)`, `setDocShare(docId, userId, share)`.
  - Realtime: `subscribeDocSync(docId, handler): () => void` for Yjs transport.
- After all features are migrated, `src/matrix/index.ts` removes `export { getClient } from './client'`. The single internal use that escapes the facade (the `useCurrentUser` composable as written in `2026-05-17-message-domain-types.md` Phase 4) reads it via a module-internal path or via a dedicated `getCurrentUserId()` matrix-module wrapper.
- ESLint `no-restricted-imports` rule prevents `src/features/**` and `src/app/**` from importing `matrix-js-sdk` or `src/matrix/client`. Two-layer defense: removing the public export AND lint enforcement.

**Tech Stack:** TypeScript, Vue 3, matrix-js-sdk, Vitest, ESLint. No new runtime dependencies.

**Prerequisite:** `2026-05-17-message-domain-types.md` (#3) must have landed through Phase 5 — this plan picks up where #3 explicitly left off (everything after `getUserId()` sweep + `Message` migration). `useCurrentUser` is assumed in place.

**Glossary updates needed in `CONTEXT.md`:**
- Add **RoomDetail** (full-fidelity domain projection of an SDK `Room`, parallel to `RoomSummary` but with topic / power levels / member list / creator / encryption state).
- Add **DocMetadata**, **DocFolders**, **DocShare** under a new "Docs" subsection of "Rooms & messages" (or a new top-level "Documents" section).

**Locked design decisions:**
- **Q1**: `RoomDetail` is a snapshot projection (ADR-0003 constraint inherited). Pure, no session deps.
- **Q2 (a)**: docs feature gets a full `src/matrix/docs/` extraction with proper domain types. ADR-0004.
- **Q3**: matrix module wraps every SDK action call currently spelled out in feature code; no `client.xxx` survives outside `src/matrix/`.
- **Q4**: `getClient` removed from `src/matrix/index.ts` at the end of this plan; ESLint rule prevents regression.

**Out of scope:**
- E2EE key verification flows (`src/matrix/verification.ts`) — they call `getClient()` internally, which is fine because they live in the matrix module. No change.
- Push notification setup, presence subsystem — separate domains not currently leaking.
- Migration of the `matrixEvents` event bus payloads to carry projected `Message` / `RoomDetail` instead of SDK objects — call out as candidate #3c if needed; this plan keeps `matrixEvents` typed as today.

---

## File Map

### Create
- `src/matrix/projections/rooms.ts` — `RoomDetail` interface, `toRoomDetail(room): RoomDetail`, related sub-types (`RoomPowerLevels`, `RoomMember` projection if needed).
- `src/matrix/actions.ts` — small action verbs (`inviteUserToRoom`, `kickUserFromRoom`, `banUserFromRoom`, `redactRoomEvent`). If existing modules (`rooms.ts`, `messages/index.ts`) already host a verb, extend rather than duplicate.
- `src/matrix/mxc.ts` — `mxcToHttpUrl(mxcUrl, width?, height?, method?: 'crop' | 'scale')`. Tiny module but used in many spots.
- `src/matrix/server.ts` (or extend `client.ts`) — `getHomeserverDomain(): string`, `getHomeserverBaseUrl(): string` (last needed for some docs share-link generation).
- `src/matrix/docs/types.ts` — `DocMetadata`, `DocFolders`, `DocShare`, `DocSyncEvent`.
- `src/matrix/docs/metadata.ts` — `getDocMetadata`, `setDocMetadata`.
- `src/matrix/docs/folders.ts` — `getDocFolders`, `setDocFolders`.
- `src/matrix/docs/shares.ts` — `getDocShare`, `setDocShare`, `listDocShares`.
- `src/matrix/docs/sync.ts` — `subscribeDocSync(docId, handler): () => void`, `publishDocSync(docId, payload)`. Replaces `matrixSyncProvider` internals.
- `src/matrix/docs/index.ts` — re-exports.
- `src/shared/composables/useRoomDetail.ts` — `useRoomDetail(roomIdRef): Ref<RoomDetail | null>`, re-derives on `matrixEvents` for relevant room events.
- `tests/unit/matrix/projections/rooms.test.ts`
- `tests/unit/matrix/actions.test.ts`
- `tests/unit/matrix/docs/metadata.test.ts`, `folders.test.ts`, `shares.test.ts`
- `tests/unit/shared/composables/useRoomDetail.test.ts`
- `eslint.config.js` — add `no-restricted-imports` rule (modify, listed under Modify).

### Modify
- `src/matrix/index.ts`
  - Add re-exports for `RoomDetail`, action verbs, mxc helper, homeserver helpers, docs domain.
  - **Final phase**: remove `getClient`, `createClient`, `destroyClient` from public exports. They become `src/matrix/`-internal.
- `src/matrix/auth.ts`, `src/matrix/sync.ts`, etc. — switch their `getClient` imports from `@matrix/index` to the relative `./client` path (so they keep working after the public export is removed).
- `src/auth/lifecycle.ts` — uses lifecycle facade verbs already; no change.
- `src/shared/composables/useCurrentUser.ts` (from #3 Phase 4)
  - Replace the lone `getClient().getUserId()` access with `getCurrentUserId()` from matrix module (new tiny wrapper). Or, alternative: have `useCurrentUser` live half-inside `src/matrix/` so it's allowed to touch the client. Pick the wrapper route — simpler and keeps `useCurrentUser` in `shared/`.

#### Feature-by-feature sweeps

- `src/app/components/AppLayout.vue:61` — `getClient().leave(spaceId)` → `leaveRoom(spaceId)` (already exists in `@matrix/index`).
- `src/shared/composables/useMemberActions.ts:10,21` — `kickUserFromRoom`, `banUserFromRoom`.
- `src/shared/composables/useRoomPermissions.ts:10,16` — replace `getClient()?.getRoom(id)` with `getRoomDetail(id)` and read `.powerLevels`; replace `getClient()?.getUserId()` with `useCurrentUser().userId.value`.
- **chat feature (~22 hits)**: each hit becomes either a `useCurrentUser` read, a `getRoomDetail` read, or an existing matrix-module call. Details inline per file in Step 3.x.
- **server feature (~15 hits)**: `useVoiceChannel` reads room state — use `getRoomDetail`; `RoleManager` sets power levels — needs `setRoomPowerLevel` wrapper if not already in `spaces.ts`; `MemberManager:100` `mxcUrlToHttp` → `mxcToHttpUrl`; `ServerOverview` reads space metadata — use `getRoomDetail` or existing `spaces.ts` helpers.
- **projects feature (~9 hits)**: `useProjectStore` / `useWorkItemStore` mostly read/write state events for project metadata — they need their own narrow domain layer just like docs. **Consider scoping**: either include in this plan (Phase 5b) or defer to a #3d follow-up. Recommendation: include as `src/matrix/projects/` since the pattern is identical to docs.
- **contacts feature (~6 hits)**: `useGroupManagement` — direct `client.invite/kick/createRoom` calls → wrappers; `useContacts` / `contactStore` — read user profile / room members → use `getRoomDetail` + a new `getUserProfile(userId)` wrapper if needed.
- **docs feature (~21 hits)**: full migration to `src/matrix/docs/` (Phase 6 dedicated section).

### Verify (no changes expected)
- `src/matrix/types.ts`, `src/matrix/messages/`, `src/matrix/rooms.ts`, etc. — unaffected except internal `getClient` import paths.
- Existing matrix-module exports (`getRoomSummaries`, `editMessage`, `redactMessage`, etc.) — these are the seam working as intended.

---

## Steps

### Phase 1 — `RoomDetail` projection

- [ ] **1.1 — Define `RoomDetail`** in `src/matrix/projections/rooms.ts`
  ```ts
  export interface RoomPowerLevels {
    users: Record<string, number>
    usersDefault: number
    stateDefault: number
    eventsDefault: number
    events: Record<string, number>
    invite: number
    kick: number
    ban: number
    redact: number
  }

  export interface RoomDetail {
    roomId: string
    name: string
    avatar?: string
    topic?: string
    isDirect: boolean
    isEncrypted: boolean
    isSpace: boolean
    creatorId?: string
    memberIds: string[]                // joined members only
    memberCount: number
    myMembership: 'join' | 'invite' | 'leave' | 'ban' | 'knock'
    powerLevels: RoomPowerLevels
  }

  export function toRoomDetail(room: Room): RoomDetail { /* ... */ }
  ```
- [ ] **1.2 — Add `getRoomDetail(roomId): RoomDetail | null`** to `src/matrix/rooms.ts`. Pulls `getClient().getRoom(id)` and runs through `toRoomDetail`.
- [ ] **1.3 — Build `useRoomDetail(roomIdRef): Ref<RoomDetail | null>`** in `src/shared/composables/useRoomDetail.ts`. Subscribes to `matrixEvents` for `room.member`, `room.name`, `room.topic` (or whatever subset is emitted); re-derives.
- [ ] **1.4 — Tests**: projection unit tests covering encrypted vs unencrypted, space vs non-space, missing topic, power level edge cases (events-only override).

### Phase 2 — Action verbs

- [ ] **2.1 — Inventory existing wrappers.** Confirm `leaveRoom`, `redactMessage`, etc. exist in matrix module. Identify gaps.
- [ ] **2.2 — Add missing wrappers:**
  - `inviteUserToRoom(roomId, userId, reason?)` — `client.invite(roomId, userId, reason)`
  - `kickUserFromRoom(roomId, userId, reason?)` — `client.kick(roomId, userId, reason)`
  - `banUserFromRoom(roomId, userId, reason?)` — `client.ban(roomId, userId, reason)`
  - `mxcToHttpUrl(mxc, w?, h?, method?)` in `src/matrix/mxc.ts`
  - `getHomeserverDomain()` in `src/matrix/server.ts`
  - `setRoomPowerLevel(roomId, userId, level)` if not in `spaces.ts`
  - `getUserProfile(userId): { displayName?, avatarUrl? }` if needed by contacts feature
- [ ] **2.3 — Unit tests** with a stub SDK client.

### Phase 3 — Chat feature sweep

For each file in `src/features/chat/` that imports `getClient`:

- [ ] **3.1 — Components reading room state** (`ChannelWelcome.vue:17`, `ChatMessage.vue:340`, `RichTextInput.vue:247`, `ThreadInboxPanel.vue:41`): replace `getClient().getRoom(id)` with `getRoomDetail(id)` and read the field they actually need.
- [ ] **3.2 — Components reading members / power levels** (`MemberListPanel`, `ChatMessage` member actions): use `getRoomDetail` + the `powerLevels` field, or `useRoomDetail` if reactive.
- [ ] **3.3 — Components doing actions** (`ChatMessage.vue:239-340` — likely redact/edit/pin): route through existing `redactMessage` / `editMessage` / `pinMessage` / `unpinMessage`.
- [ ] **3.4 — Composables** (`useNotificationSound`, `useTyping`): `useTyping:14` is `getUserId()` → already done in #3 Phase 4; `useNotificationSound:84` reads room name → `getRoomDetail`.
- [ ] **3.5 — Verify** `grep -rEn 'getClient' src/features/chat/` returns zero hits except inside `useCurrentUser` integration (which is in `src/shared/`, not `src/features/chat/`).

### Phase 4 — server / projects / contacts / shared / app sweep

- [ ] **4.1 — server feature** (~15 hits):
  - `useVoiceChannel` (4 hits) — needs `getRoomDetail` + LiveKit token wrapper if it's calling something not yet in matrix module.
  - `InviteDialog` — `inviteUserToRoom`.
  - `RoleManager` (3 hits) — `setRoomPowerLevel`, `getRoomDetail`.
  - `UserPanel`, `MemberManager`, `MemberContextMenu`, `ServerOverview`, `UserPopover`, `serverStore:240` — `getRoomDetail` / `mxcToHttpUrl` / `useCurrentUser` per call.
- [ ] **4.2 — projects feature** (~9 hits):
  - Decision: extract `src/matrix/projects/` analogous to `src/matrix/docs/`. Same pattern — state events + maybe account data.
  - Define `ProjectMetadata`, `WorkItem` domain types. Migrate `useProjectStore` / `useWorkItemStore` / `WorkItemAssigneePicker`.
- [ ] **4.3 — contacts feature** (~6 hits):
  - `useGroupManagement` — `inviteUserToRoom`, `kickUserFromRoom`, new `createGroupRoom(opts)` wrapper if needed.
  - `useContacts`, `contactStore` — use `getUserProfile` wrapper or read-through to a new `getKnownContacts()` matrix verb.
  - `GroupMemberPicker:156` — `getHomeserverDomain()`.
- [ ] **4.4 — shared** (3 hits):
  - `useMemberActions` — direct wrapper calls.
  - `useRoomPermissions` — `getRoomDetail` + `useCurrentUser`.
- [ ] **4.5 — app** (1 hit):
  - `AppLayout:61` — `leaveRoom`.

### Phase 5 — Docs feature extraction (ADR-0004)

This is the biggest single phase. Run as its own subagent invocation.

- [ ] **5.1 — Define domain types** in `src/matrix/docs/types.ts`:
  ```ts
  export interface DocMetadata {
    docId: string
    title: string
    icon?: string
    coverUrl?: string
    parentFolderId?: string
    permissions: { defaultRole: 'viewer' | 'editor' | 'none' }
  }
  export interface DocFolders { folders: Array<{ id: string, name: string, parentId?: string }> }
  export interface DocShare { userId: string, role: 'viewer' | 'editor' | 'owner' }
  export interface DocSyncEvent { docId: string, origin: string, update: Uint8Array }
  ```
- [ ] **5.2 — Implement read/write functions** in `metadata.ts`, `folders.ts`, `shares.ts`. Each wraps `getClient().sendStateEvent` / `room.currentState.getStateEvents` / `client.getAccountData` / `client.setAccountData` behind a typed verb. Validate inputs with Zod (already in deps).
- [ ] **5.3 — Implement `subscribeDocSync` / `publishDocSync`** in `docs/sync.ts`. Replaces `src/features/docs/services/matrixSyncProvider.ts` internals.
- [ ] **5.4 — Migrate `src/features/docs/stores/docsStore.ts`** (~12 hits) to consume `src/matrix/docs/`. Drop the feature-local `MatrixDocAccountClient` / `MatrixDocMetadataClient` interfaces and casts.
- [ ] **5.5 — Migrate `ShareDialog.vue`** (3 hits) — `getDocShare` / `setDocShare`.
- [ ] **5.6 — Migrate `matrixSyncProvider.ts`** — now a thin adapter on top of `subscribeDocSync` / `publishDocSync`; deletes its `MatrixEventClient` / `MatrixDocRoom` private interfaces.
- [ ] **5.7 — Migrate `useDocSync.ts`** and `currentDocUser.ts` — last two hits.
- [ ] **5.8 — Tests** for all of `src/matrix/docs/`. The narrow surface makes these tests trivial compared to today's docsStore tests that wrestle with SDK shapes.

### Phase 6 — Public export removal & lint enforcement

- [ ] **6.1 — Update `useCurrentUser`** to use a new `getCurrentUserId()` matrix-module verb (single allowed `getClient()` reach inside the matrix module), instead of importing `getClient` from `@matrix/index`.
- [ ] **6.2 — Remove from `src/matrix/index.ts`** the lines exporting `getClient`, `createClient`, `destroyClient`. Internal matrix files keep them via direct `./client` imports.
- [ ] **6.3 — Add ESLint rule** in `eslint.config.js`:
  ```js
  {
    files: ['src/features/**/*.{ts,vue}', 'src/app/**/*.{ts,vue}', 'src/shared/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'matrix-js-sdk', message: 'Feature code must use src/matrix/ projections and verbs, not the SDK directly.' },
          { name: '@matrix/client', message: 'getClient is private to src/matrix/. Use a matrix-module verb or composable.' },
          { name: '@/matrix/client', message: 'Same as above.' },
        ],
      }],
    },
  }
  ```
- [ ] **6.4 — Run `pnpm lint`** — expect zero violations.
- [ ] **6.5 — `grep -rEn 'getClient|matrix-js-sdk' src/features/ src/app/ src/shared/`** returns zero hits.

### Phase 7 — CONTEXT.md updates

- [ ] **7.1 — Add `RoomDetail`** to the "Rooms & messages" section in `CONTEXT.md` (parallel to `RoomSummary`).
- [ ] **7.2 — Add "Documents" subsection** with `DocMetadata`, `DocFolders`, `DocShare`, `DocSyncEvent`.
- [ ] **7.3 — Relationships**: add invariant — "Feature code never imports `matrix-js-sdk` directly. Every SDK read or write goes through `src/matrix/` verbs or projections."

---

## Verification

After all phases:

- [ ] `grep -rEn 'getClient' src/features/ src/app/ src/shared/` returns zero hits.
- [ ] `grep -rEn "from 'matrix-js-sdk'" src/features/ src/app/ src/shared/` returns zero hits.
- [ ] `pnpm lint` passes with the new `no-restricted-imports` rule enabled.
- [ ] Manual full-app smoke test: sign in, see channel list, send a message, react, edit, kick a member from a server, change a doc title, share a doc with a colleague, sign out, sign in as a different user. No regression.
- [ ] `src/matrix/index.ts` no longer exports `getClient` / `createClient` / `destroyClient`.

---

## Risk Notes

- **Scope is large; commit phase-by-phase**. Each phase produces a green-tests checkpoint. Don't merge Phase 6 (the removal) until 1-5 are 100% green; the SDK exports are easy to put back if needed, but features lose their escape hatch the moment they land.
- **Power levels API**: `client.setPowerLevel` has subtle semantics (overrides full users map). Confirm `setRoomPowerLevel` wrapper preserves that contract or document the divergence.
- **`useRoomDetail` re-derive cost**: a room can fire many `room.member` events during a sync. Debounce inside the composable (80ms, mirroring `useMessages`).
- **Docs sync hot path**: `subscribeDocSync` runs every Yjs update — make sure the projection is cheap (likely no projection at all, just a typed transport pass-through). Profile before locking the shape.
- **Projects feature scope creep**: Phase 4.2 introduces `src/matrix/projects/` as a parallel of docs. If the projects feature is in flux (per recent plans `2026-05-05-feishu-project-management-plan.md`), align with the feature owner before locking domain types. Worst case, defer projects to its own #3d plan and update Phase 6 verification to allow `getClient` in `src/features/projects/` until #3d ships.
- **ESLint rule false positives**: some matrix-module tests might import `matrix-js-sdk` to construct fixture clients. Exclude `tests/` from the rule.
- **`MatrixClient` type leakage**: in TS, `import type { MatrixClient }` is sometimes used in narrow interfaces (`useDocSync:20`). After Phase 6, feature code must not need this type either — confirm during the docs migration.
