# `shared/` Boundary Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `src/shared/` the only seam for cross-feature reuse (per `docs/adr/0006-no-cross-feature-imports.md`). Promote the things that are reused across features but live inside one. Add `eslint-plugin-boundaries` so any future cross-feature import fails CI.

End state: `grep -rEn "from '@/features/" src/features/` returns zero hits where the source feature differs from the target feature.

**Architecture:**
- The 21 current cross-feature imports collapse to zero. The reused parts move to `shared/` or are factored into a primitive that both ends consume.
- ESLint enforces the boundary with `eslint-plugin-boundaries`. Each top-level directory under `src/` is an element type; the rule disallows `feature → feature` edges.
- `CONTEXT.md` gains a short "Code layout" subsection that names the four layers (`matrix/`, `shared/`, `features/`, `app/`) and pins down the import direction.

**Tech Stack:** TypeScript, Vue 3, ESLint, `eslint-plugin-boundaries`. One new dev dependency.

**Prerequisites:** None hard. **Soft dependencies:**
- Candidate #4 (`2026-05-19-room-list-single-ownership.md`) removes the `chat/composables/useConversations` → `server/...` import (3 of the 5 `server → chat` edges). If #4 lands first, this plan has less to do. If it doesn't, this plan adds a temporary `boundaries` exception for those imports and removes it when #4 lands.
- Candidate #3 (`2026-05-17-message-domain-types.md`) does not interact.

**Glossary updates:** None — `shared/`, `features/`, `matrix/` are directory names, not domain terms. The "Code layout" subsection in `CONTEXT.md` is documentation, not glossary.

**Locked design decisions:**
- **Q1 (a)**: strict "no cross-feature imports ever." No feature-public-API exception. ADR-0006.
- **Q2 mixed**: promote what's truly shared; factor primitives where the reused thing is too entangled to move whole.
- **Q3 (a)**: `contacts/` stays a feature. Its widely-reused parts move out. ADR-0006.
- **Q4 (a)**: `eslint-plugin-boundaries` for enforcement.
- **Q5 (b)**: promote / refactor first, then enable lint as `error` from day one. No transitional warning state.

**Out of scope:**
- Splitting `ConversationList.vue` into a generic primitive and a chat-specific shell. The plan extracts only the row primitive (`ConversationItem.vue`) to `shared/`; the outer `ConversationList` stays in `chat/` and `server` keeps its own outer shell. A deeper RoomList UI primitive can come later.
- Reworking `chatStore` for cross-feature mention bridges. DocEditor's actual chat imports are `MediaViewer` and `useMediaViewer`, not store-shaped — no bridge needed.
- Reducing the number of features. ADR-0006's "When to revisit" calls out merging as the right move if two features fundamentally overlap; this plan doesn't merge any.

---

## File Map

### Create
- `src/shared/components/GroupMemberPicker.vue` — moved from `contacts/components/`.
- `src/shared/components/MediaViewer.vue` — moved from `chat/components/`.
- `src/shared/components/ConversationItem.vue` — extracted row primitive (moved from `chat/components/`).
- `src/shared/composables/useContacts.ts` — moved from `contacts/composables/`.
- `src/shared/composables/useGroupManagement.ts` — moved from `contacts/composables/`.
- `src/shared/composables/useMediaViewer.ts` — moved from `chat/composables/`.
- `src/shared/lib/avatarGradient.ts` — moved from `chat/lib/`.
- `src/shared/stores/callLaunchStore.ts` — moved from `calls/stores/`.
- `src/shared/data/projects/db.ts` — moved from `projects/db/projectDb.ts`.
- `src/shared/data/projects/types.ts` — moved from `projects/types.ts` (only the schema / type definitions; runtime composables stay in projects feature).
- `src/shared/data/projects/index.ts` — re-exports.

### Modify
- `eslint.config.js` — add `eslint-plugin-boundaries` config with element types and the cross-feature deny rule (full config in Step 5.1).
- `package.json` — add `eslint-plugin-boundaries` to `devDependencies`. Run `pnpm install`.
- `tsconfig.json` — no change (path aliases already work for `@shared/*`).
- All importers — update import paths from `@/features/X/...` to `@/shared/...` or `@shared/...`. Full sweep in Step 4.
- `CONTEXT.md` — append "Code layout" subsection (Step 6).

### Files moved (delete originals after re-importing)
- `src/features/contacts/components/GroupMemberPicker.vue`
- `src/features/contacts/composables/useContacts.ts`
- `src/features/contacts/composables/useGroupManagement.ts`
- `src/features/chat/components/MediaViewer.vue`
- `src/features/chat/components/ConversationItem.vue`
- `src/features/chat/composables/useMediaViewer.ts`
- `src/features/chat/lib/avatarGradient.ts`
- `src/features/calls/stores/callLaunchStore.ts`
- `src/features/projects/db/projectDb.ts`
- `src/features/projects/types.ts` (split: keep feature-specific bits in `projects/`, move schemas to `shared/data/projects/types.ts`)

---

## Steps

### Phase 1 — Audit & confirm scope

- [ ] **1.1 — Capture current cross-feature import graph**
  - `grep -rEn "from '@/features/" src/features/ --include="*.ts" --include="*.vue" > /tmp/before.txt`
  - Expected count today: **21 imports across 10 distinct pairs** (per grilling investigation: chat↔contacts ×5, server↔chat ×5, organization↔contacts ×2, contacts↔calls ×2, docs↔chat ×2, plus 5 singletons).
- [ ] **1.2 — Confirm `projects/types.ts` is split-safe**
  - Read `projects/types.ts`. Confirm it contains Zod schemas + interfaces that calendar (or any future feature) might want. If it also contains projects-private stuff, the move splits: schemas + types → `shared/data/projects/`, runtime helpers stay.

### Phase 2 — Promote the "obviously shared" files

For each move: copy file to new location, update its internal imports to point at the right relative paths from `shared/`, leave a re-export shim at the old path temporarily (deleted in Phase 5).

- [ ] **2.1 — Move `GroupMemberPicker.vue`** to `src/shared/components/`. Update internal imports inside the component if it references contacts internals.
- [ ] **2.2 — Move `useContacts.ts` and `useGroupManagement.ts`** to `src/shared/composables/`. Same internal-import-path fix.
- [ ] **2.3 — Move `MediaViewer.vue` and `useMediaViewer.ts`** to `src/shared/components/` and `src/shared/composables/`. Update any internal references.
- [ ] **2.4 — Move `avatarGradient.ts`** to `src/shared/lib/`.
- [ ] **2.5 — Move `callLaunchStore.ts`** to `src/shared/stores/`.

**Checkpoint:** Type errors flood in at the old `@/features/...` import sites. Phase 4 fixes them. App boots only when Phase 4 sweep is complete.

### Phase 3 — Factor `ConversationItem` primitive + project DB

- [ ] **3.1 — Extract `ConversationItem.vue` to `shared/`**
  - The current `chat/components/ConversationItem.vue` is the row inside `ConversationList`. Move it. Its prop interface should be already generic enough (it takes a `RoomSummary` plus interaction events).
  - If it currently imports chat-private state (like `useChatStore` for the right-click context menu), refactor: emit events for the host (chat's ConversationList or server's sidebar) to handle. This is the meatiest piece of the plan — budget time.
  - After the extraction, both `chat/components/ConversationList.vue` and `server/components/ChannelSidebar.vue` (the latter currently imports the whole ConversationList) become consumers of `ConversationItem.vue`. Update `ChannelSidebar.vue` to compose its own list of `ConversationItem` rows instead of importing the entire `ConversationList.vue`.
- [ ] **3.2 — Move project DB layer to `shared/data/projects/`**
  - `projects/db/projectDb.ts` → `shared/data/projects/db.ts`.
  - Split `projects/types.ts`: schemas and base interfaces (`Project`, `WorkItem`, `Workflow`, `CustomField`, their Zod schemas) → `shared/data/projects/types.ts`. Anything UI-specific (column configs, filter shapes) stays in projects feature.
  - Both projects feature and calendar feature import from `@shared/data/projects/`.

**Checkpoint:** ConversationItem extraction is the highest-risk piece. Run the app, send a message, right-click a conversation row — verify the context menu still works. Verify ChannelSidebar still renders.

### Phase 4 — Rewire all importers

- [ ] **4.1 — Sweep importers of the moved files**
  - For each file moved in Phase 2 / 3, grep its old import path and replace with the new one across `src/`.
  - For example: `grep -rEn "from '@/features/contacts/components/GroupMemberPicker" src/ | wc -l` → run a sed replacement to point at `@shared/components/GroupMemberPicker.vue`. Repeat per move.
  - The 21 cross-feature import sites become zero (assuming candidate #4 handles `useConversations` — otherwise handle in Step 4.3).
- [ ] **4.2 — Delete the re-export shims** at the old paths inside features.
- [ ] **4.3 — Handle `server → chat/composables/useConversations` (3 sites)**
  - If candidate #4 has landed: `server` imports `roomListSummaries` from `@matrix/index` directly. Drop the `useConversations` import.
  - If candidate #4 has NOT landed: add a `boundaries-element-types` exception ONLY for these 3 import lines with a `// TODO(#4): remove after RoomList projection lands` comment. Verify the exception is narrow (filename-scoped, not directory-scoped).
- [ ] **4.4 — `pnpm typecheck`** — fix everything until green.
- [ ] **4.5 — `grep -rEn "from '@/features/" src/features/`** returns zero hits.

**Checkpoint:** Full app runs. All cross-feature imports gone. Lint not yet enforcing.

### Phase 5 — Enable `eslint-plugin-boundaries`

- [ ] **5.1 — Install** `pnpm add -D eslint-plugin-boundaries`.
- [ ] **5.2 — Update `eslint.config.js`** with element types and the deny rule:
  ```js
  import antfu from '@antfu/eslint-config'
  import boundaries from 'eslint-plugin-boundaries'

  export default antfu({
    vue: true,
    typescript: true,
    formatters: true,
    ignores: [/* existing ignores */],
  }, {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'matrix', pattern: 'src/matrix/**/*' },
        { type: 'shared', pattern: 'src/shared/**/*' },
        { type: 'app', pattern: 'src/app/**/*' },
        { type: 'feature', pattern: 'src/features/*/**/*', capture: ['featureName'] },
        { type: 'auth', pattern: 'src/auth/**/*' },
        { type: 'enterprise', pattern: 'src/enterprise/**/*' },
        { type: 'electron', pattern: 'src/electron/**/*' },
      ],
    },
    rules: {
      'boundaries/element-types': ['error', {
        default: 'allow',
        rules: [
          // Features can import from matrix, shared, app (for shell), auth, enterprise, electron, and themselves.
          // Features CANNOT import from another feature.
          {
            from: ['feature'],
            disallow: [['feature', { featureName: '!${from.featureName}' }]],
            message: 'Feature "${file.featureName}" may not import from feature "${dependency.featureName}". Promote the shared part into src/shared/.',
          },
        ],
      }],
    },
  })
  ```
  - Verify the `capture: ['featureName']` micromatch + template substitution works in `eslint-plugin-boundaries` v5 (the canonical example in their README mirrors this).
- [ ] **5.3 — Run `pnpm lint`** — expect zero violations (Phase 4 cleared them). If a violation appears, that's a bug in the migration; fix the underlying import, not the rule.
- [ ] **5.4 — Add the rule check to CI** if not already covered by the existing lint step. Verify `pnpm lint` runs on PRs.

**Checkpoint:** Try adding a temporary `import './other-feature/foo'` somewhere — lint fails with the configured message. Revert.

### Phase 6 — Document the policy

- [ ] **6.1 — Append "Code layout" subsection** to `CONTEXT.md`:
  ```md
  ## Code layout

  The desktop client has four layers. Imports flow downward only.

  - **`src/app/`** — Vue app shell, router, top-level layout. Imports from features, shared, matrix.
  - **`src/features/<name>/`** — Self-contained features. May import from `shared/`, `matrix/`, `app/` (rarely), and themselves only. May NOT import from any other feature; see ADR-0006.
  - **`src/shared/`** — Cross-feature reusables: composables, components, lib, services, stores, data. Imports from `matrix/` only (and external packages).
  - **`src/matrix/`** — Matrix SDK adapter + domain projections. The only place that imports `matrix-js-sdk`. Pure on the way out (no Vue refs except where projections explicitly expose them).
  - **`src/auth/`, `src/enterprise/`, `src/electron/`** — Cross-cutting infrastructure. `auth` orchestrates session lifecycle; `enterprise` owns Muon-API plumbing; `electron` owns the desktop bridge.

  See `docs/adr/0006-no-cross-feature-imports.md` for the rationale and `eslint.config.js` for the enforcement.
  ```
- [ ] **6.2 — Add a sentence to README or CONTRIBUTING.md** pointing at the rule, so newcomers don't fight the lint error blindly.

---

## Verification

- [ ] `grep -rEn "from '@/features/" src/features/` returns zero hits (or only documented exceptions per Step 4.3).
- [ ] `pnpm lint` passes with the boundaries rule enabled.
- [ ] `pnpm typecheck` passes.
- [ ] App boots, sign in, send a message, open a doc with embedded image (uses shared MediaViewer), open NewChatDialog (uses shared GroupMemberPicker), open ContactsPage → call-launch (uses shared callLaunchStore), open Calendar (consumes shared project DB).
- [ ] Adding a deliberate cross-feature import in a scratch branch reproduces the lint error with the configured message.

---

## Risk Notes

- **`ConversationItem.vue` extraction is the highest-risk piece** (Step 3.1). It currently reads `useChatStore` for context-menu state. Two cleanup patterns: (a) make `ConversationItem` purely presentational, emit `context-menu` events, host (ConversationList or ChannelSidebar) wires up its own state; (b) accept that the row is too entangled and instead extract a *much smaller* primitive (just the avatar + name + preview, ~30 lines) and let both list shells do their own composition. Pick (a) if the entanglement is shallow; fall back to (b) if (a) reveals deep coupling.
- **`projectDb` move** changes the IndexedDB connection module path. Dexie connection identity is keyed on the database name string, so the move itself is safe — no migration needed. But verify imports in `tests/` and any persisted localStorage that referenced the old module path (unlikely; flag if found).
- **Candidate #4 timing** (Step 4.3): if #4 ships after this plan, the temporary `boundaries` exception for `server → chat/useConversations` must be removed. Add it to #4's plan as a follow-up TODO.
- **`eslint-plugin-boundaries` versioning**: pin the version. Capture syntax (`{ featureName: '!${from.featureName}' }`) was stable from v3 onward; verify in the installed version's docs.
- **Re-export shims (Step 2 transitional)**: keep them only until Phase 4 sweep finishes. Don't merge with the shims still present — they confuse future readers about where the canonical location is.
- **Vue SFC `<script setup>` import paths**: the sweep must update both `<script setup>` imports and any options-API `import` statements. Single-file components are easy to miss; rely on the grep, not on manual file-walking.
- **Cross-cutting tests**: tests that import features will hit the same rule. Add `tests/**` to a per-file override that allows all imports (tests legitimately reach into multiple features for integration coverage).
