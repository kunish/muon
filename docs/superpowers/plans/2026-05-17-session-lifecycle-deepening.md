# Session Lifecycle Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the recurring `persist → createClient → bindEvents → startSync` four-step (and its inverse) into a single **MatrixSession** facade — `activate(session)` / `deactivate()` / `revokeMatrixSession()` — so `src/auth/lifecycle.ts`, `src/features/auth/components/LoginPage.vue`, and any future entry point stop spelling out the ordering by hand. Make `loginWithPassword` and `register` pure (no side effects, no client singleton mutation), so lifecycle becomes the single call site for activation. Surface the matrix-only fallback in the `bootstrap` return so callers can react.

**Architecture:**
- `src/matrix/index.ts` becomes a real facade: `activate(session)` and `deactivate()` are the **only** public verbs that touch the matrix client singleton. `bindClientEvents` / `unbindClientEvents` / `startSync` / `stopSync` / `createClient` / `destroyClient` / `activateMatrixSession` / `restoreMatrixSession` are demoted to module-internal.
- `loginWithPassword(serverUrl, creds): Promise<MatrixSession>` and `register(serverUrl, params): Promise<MatrixSession>` are pure: build a one-shot client, call the SDK, destroy the one-shot client, return the session. They never persist and never touch the long-lived client singleton.
- `revokeMatrixSession()` is split from local teardown — `signOut()` composes `revokeMatrixSession() → deactivate() → clearEnterprise()`.
- `activate()` throws on second call: re-activation is a structural bug, not a recoverable state.
- `bootstrap()` returns `{ restored: 'enterprise' | 'matrix-only' | false }` and accepts an optional `deps` parameter so tests can substitute `enterprise`, `restoreMatrixOnly`, and `activate` without touching globals.
- `App.vue` and `LoginPage.vue` route every sign-in / sign-up / sign-out through lifecycle verbs. Components no longer import `bindClientEvents` or `startSync`.

**Tech Stack:** TypeScript, Vue 3, Vitest (jsdom), matrix-js-sdk. No new dependencies.

**Glossary (see `CONTEXT.md`):** **MatrixSession**, **MuonSession**, **EnterpriseSession**, **SignIn**, **SignOut**, **Bootstrap**. No new domain terms — `activate` is the operation noun already implied by **SignIn**'s definition ("persisting it, creating the Matrix client, binding events, starting sync").

**Locked design decisions:**
- **Q1**: `activate` / `deactivate` collapse the persist+createClient+bindEvents+startSync trio. SignOut mirrors with stopSync+unbindEvents+destroyClient+clearMatrixStore.
- **Q2 / Q9**: `loginWithPassword` and `register` become pure. Lifecycle gains `signUpWithPassword`. `register`'s `setDisplayName` call moves to after `activate` in the orchestrator (it requires a live client).
- **Q3**: matrix-only Bootstrap fallback is preserved — see `docs/adr/0001-keep-matrix-only-bootstrap-fallback.md`.
- **Q4**: lifecycle SignOut does NOT broadcast to feature-level subscribers — that belongs to a separate seam (candidate #2: Lifecycle events for feature stores).
- **Q5**: facade lives in `src/matrix/index.ts`.
- **Q6**: `activate()` throws on second call. No silent re-init.
- **Q7**: `deactivate()` (local teardown) and `revokeMatrixSession()` (homeserver `/logout`) are separate verbs. `signOut()` composes them.
- **Q8**: `bootstrap(deps?)` accepts injected `enterprise`, `restoreMatrixOnly`, and `activate` deps for testability.
- **Q10**: `bootstrap` returns `{ restored: 'enterprise' | 'matrix-only' | false }`.

**Out of scope:**
- Feature-level cleanup on SignOut (`useConversations`, `useUnifiedInbox`, `serverStore` resets) — tracked separately as candidate #2.
- Removing the matrix-only Bootstrap fallback — see ADR 0001.
- Wider Pinia / store refactors — independent.

---

## File Map

### Create
- `tests/unit/auth/bootstrap.test.ts` — three return paths (`enterprise` / `matrix-only` / `false`), with injected deps.
- `tests/unit/matrix/activate.test.ts` — `activate` happy path; double-`activate` throws; `deactivate` is idempotent (safe to call when not active is a separate concern, see Step 2.2).
- `tests/unit/matrix/loginWithPassword.test.ts` — asserts no persistence, no singleton mutation, returns a `MatrixSession`.

### Modify
- `src/matrix/index.ts` — add `activate`, `deactivate`, `revokeMatrixSession`; remove `bindClientEvents`, `unbindClientEvents`, `startSync`, `stopSync`, `activateMatrixSession`, `restoreMatrixSession`, `logoutMatrix`, `createClient`, `destroyClient` from the public surface.
- `src/matrix/auth.ts`
  - Make `loginWithPassword` pure: build one-shot client, login, destroy, return session. Remove the `matrixSessionStore().write` and second `createClient(session)` at lines 47-48.
  - Make `register` pure: same shape. Remove `setDisplayName` from this function — it migrates to lifecycle.
  - Split `logoutMatrix` into `revokeMatrixSession` (homeserver call only, retains the warn-and-continue swallow) and a local-only teardown that becomes `deactivate`. Keep `unbindClientEvents` invocation inside the local teardown.
- `src/matrix/sync.ts` — no API change. `startSync` / `stopSync` become module-internal.
- `src/matrix/events.ts` — no API change. `bindClientEvents` / `unbindClientEvents` become module-internal.
- `src/auth/lifecycle.ts`
  - Rewrite five verbs to compose facade ops:
    - `bootstrap(deps?)` returns the discriminated union; default deps come from `defaultBootstrapDeps()` (new private helper).
    - `signInWithPassword`, `signInWithEnterprise` are `login/complete → activate`.
    - `signUpWithPassword` is new: `register → activate → setDisplayName?`.
    - `signOut` is `revokeMatrixSession → deactivate → clearEnterprise`.
- `src/app/App.vue:32` — destructure `restored` and react to the union (matrix-only branch can stay silent for now; placeholder for future UI nudge).
- `src/features/auth/components/LoginPage.vue`
  - Line 2: drop `bindClientEvents`, `register`, `startSync` imports.
  - Line 10: import `signUpWithPassword` from `@/auth/lifecycle`.
  - Lines 111-117: replace the sign-up trio with `await signUpWithPassword(...)`.
- `tests/unit/auth/lifecycle.test.ts` (if it exists; else create) — update for new `bootstrap` return; add `signUpWithPassword` coverage.

### Verify (no changes expected)
- `src/enterprise/session.ts` — `restore`, `refresh`, `complete`, `clear` already line up with the new lifecycle composition. No edits.
- `packages/enterprise-contracts` — schemas unaffected.
- `apps/api` — server side unaffected.

---

## Steps

### Phase 1 — Introduce facade verbs alongside existing ones (non-breaking)

- [ ] **1.1 — Add `activate(session)` to `src/matrix/index.ts`**
  - Implementation: `await activateMatrixSession(session); bindClientEvents(); startSync()`. Add a module-level `activated: boolean` guard; throw `Error('Matrix client already activated')` on second call. Reset the flag in `deactivate`.
  - Keep `activateMatrixSession`, `bindClientEvents`, `startSync` exported for now — Phase 5 demotes them.
- [ ] **1.2 — Add `deactivate()` to `src/matrix/index.ts`**
  - Implementation: `stopSync()`, then `unbindClientEvents()`, then `destroyClient()`, then `clearMatrixSessionStore()`. Reset the `activated` flag. Safe to call when not activated — early-return if flag is false (test guards re-running cleanup).
- [ ] **1.3 — Add `revokeMatrixSession()` to `src/matrix/index.ts`**
  - Implementation: lifts the `await getClient().logout(true)` block out of the current `logoutMatrix`, including the warn-and-continue swallow. Does not call any teardown — that's `deactivate`'s job.
- [ ] **1.4 — Unit tests for `activate` / `deactivate` / `revokeMatrixSession`**
  - `tests/unit/matrix/activate.test.ts`: happy path activates singleton; second `activate` throws; `deactivate` after `activate` resets state; `deactivate` before `activate` no-ops.
  - Use a stubbed `createClient` (export a seam) or assert side effects on `getClient()` / `syncState`. Pick whichever fits the existing test patterns in `tests/unit/matrix/`.

**Checkpoint:** All existing tests still pass. `lifecycle.ts` and `LoginPage.vue` unchanged. No production behavior change.

### Phase 2 — Migrate lifecycle to facade verbs

- [ ] **2.1 — Rewrite `signInWithPassword` / `signInWithEnterprise` in `src/auth/lifecycle.ts`**
  - Replace inline `activateMatrixSession → bindClientEvents → startSync` triples with `activate(session)`. For password path, `loginWithPassword` still persists+creates internally — handled in Phase 3. For now wrap: `const session = await loginWithPassword(...); /* activate already happened inside */ bindClientEvents(); startSync();` → leave as-is OR replace with `activate(await loginWithPassword(...))`. Pick the latter once Phase 3 lands; until then keep the current `bindClientEvents()` + `startSync()` pair.
  - For enterprise path, replace with `activate(session.matrix)`.
- [ ] **2.2 — Rewrite `signOut` to compose**
  - `await revokeMatrixSession(); await deactivate(); clearEnterprise(defaultEnterpriseSessionDeps())`.
  - Delete the existing `stopSync()` + `logoutMatrix()` calls.

**Checkpoint:** Hand-test or run integration test: sign in via password, sign out, sign in via enterprise, sign out. No regression.

### Phase 3 — Make `loginWithPassword` and `register` pure

- [ ] **3.1 — `loginWithPassword`**
  - Today (`src/matrix/auth.ts:32-50`): builds a transient client via `createClient({ serverUrl })`, calls `client.login`, then persists + calls `createClient(session)` to install the real singleton.
  - New shape: build a transient client (use `sdkCreateClient` directly, NOT the singleton-setting `createClient`), call `client.login`, do not persist, do not touch the singleton, return the `MatrixSession`. Local helper `oneShotClient(serverUrl)` may make this readable.
- [ ] **3.2 — `register`**
  - Same transformation. Remove the `setDisplayName` call at line 67-68 — it moves to lifecycle's `signUpWithPassword`.
- [ ] **3.3 — Add `signUpWithPassword` to `src/auth/lifecycle.ts`**
  - Shape: `const session = await register(serverUrl, params); await activate(session); if (params.displayName) await setMyDisplayName(params.displayName)`.
  - `setMyDisplayName` is already exported from `@matrix/index` (see `profile.ts`).
- [ ] **3.4 — Update `signInWithPassword`**
  - Shape: `const session = await loginWithPassword(serverUrl, credentials); await activate(session)`.
- [ ] **3.5 — Tests**
  - `tests/unit/matrix/loginWithPassword.test.ts`: returns a session; does not write to `matrixSessionStore`; `getClient()` still throws afterwards (singleton untouched).
  - Update any existing `tests/unit/matrix/auth.test.ts` assertions that depended on the old side-effecting shape.

**Checkpoint:** Sign-up flow on LoginPage still works end-to-end. Display name is set after activation.

### Phase 4 — Migrate `LoginPage.vue` sign-up branch

- [ ] **4.1 — Replace direct trio with lifecycle verb**
  - `src/features/auth/components/LoginPage.vue:2` — remove `bindClientEvents`, `register`, `startSync` from the matrix import.
  - Line 10 — add `signUpWithPassword`.
  - Lines 111-117 — replace `await register(...); bindClientEvents(); startSync();` with `await signUpWithPassword(serverUrl.value, {...})`.

**Checkpoint:** sign-up + sign-in + sign-out all work. No component imports `bindClientEvents` or `startSync`.

### Phase 5 — Bootstrap deps injection and discriminated return

- [ ] **5.1 — Introduce `BootstrapDeps` type and default builder**
  - In `src/auth/lifecycle.ts`, define:
    ```ts
    interface BootstrapDeps {
      enterprise: EnterpriseSessionDeps
      restoreMatrixOnly: () => Promise<MatrixSession | null>
      activate: (s: MatrixSession) => Promise<void>
    }
    function defaultBootstrapDeps(): BootstrapDeps { ... }
    ```
  - `restoreMatrixOnly` wraps the existing `restoreMatrixSession()` (which reads + creates client today). Once Phase 5 lands, `restoreMatrixSession` is moved to module-internal (`src/matrix/auth.ts`) and exported only via this dep.
- [ ] **5.2 — Refactor `bootstrap`**
  - Signature: `export async function bootstrap(deps: BootstrapDeps = defaultBootstrapDeps()): Promise<BootstrapResult>` where `BootstrapResult = { restored: 'enterprise' | 'matrix-only' | false }`.
  - Body:
    ```ts
    const enterprise = await restore(deps.enterprise).catch(() => null)
    if (enterprise) {
      await deps.activate(enterprise.matrix)
      return { restored: 'enterprise' }
    }
    const matrixOnly = await deps.restoreMatrixOnly()
    if (matrixOnly) {
      await deps.activate(matrixOnly)
      return { restored: 'matrix-only' }
    }
    return { restored: false }
    ```
  - Note: with the new shape, the matrix-only branch must NOT call `createClient` inside `restoreMatrixOnly` — that's `activate`'s job. Move the `createClient` out of `restoreMatrixSession` so the dep is read-only. Update `defaultBootstrapDeps()` accordingly.
- [ ] **5.3 — Update `App.vue`**
  - `src/app/App.vue:32`: destructure `restored`. If `restored === 'matrix-only'`, leave a TODO comment pointing at "future UI nudge to re-do enterprise PKCE" (do not implement the UI in this plan). Behavior unchanged for `'enterprise'` and `false`.
- [ ] **5.4 — Tests**
  - `tests/unit/auth/bootstrap.test.ts`: three injected scenarios (enterprise restores → 'enterprise'; matrix-only restores → 'matrix-only'; neither → false). Assert `activate` is called with the right session.

**Checkpoint:** Bootstrap is unit-testable with no Electron / matrix-js-sdk globals. Production startup behaves identically except for the richer return.

### Phase 6 — Demote internal verbs from `src/matrix/index.ts` public surface

- [ ] **6.1 — Remove demoted exports**
  - Delete from `src/matrix/index.ts`: `bindClientEvents`, `unbindClientEvents`, `startSync`, `stopSync`, `createClient`, `destroyClient`, `activateMatrixSession`, `restoreMatrixSession`, `logoutMatrix`. Keep `matrixEvents`, `syncState`, `getClient` (still used by stores/composables — broader cleanup is candidate #3, out of scope here).
- [ ] **6.2 — Sweep remaining callers**
  - `grep -rn "bindClientEvents\|startSync\|activateMatrixSession\|restoreMatrixSession\|logoutMatrix"` across `src/` and `tests/`. Anything outside the matrix module imports should already be gone after Phases 2 / 4. Fix what isn't.
- [ ] **6.3 — Lint + typecheck + test run**
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`. Fix import-path fallout.

**Checkpoint:** The public matrix surface for session activation is exactly `activate` / `deactivate` / `revokeMatrixSession` / `loginWithPassword` / `register` / `readMatrixSessionFromStore`.

---

## Verification

After all phases:

- [ ] `grep -rn "bindClientEvents\|startSync" src --include="*.vue" --include="*.ts"` returns no hits outside `src/matrix/`.
- [ ] `grep -rn "from '@matrix/index'" src --include="*.vue"` shows no component importing the session-mutation verbs (only message / room / store-shaped imports).
- [ ] `lifecycle.signOut()` still revokes the homeserver token and clears both enterprise and matrix storage on a real sign-out (manual test via LoginPage logout path).
- [ ] `bootstrap()` returns `'enterprise'` after a fresh enterprise sign-in + restart, and `'matrix-only'` after a password sign-in + restart.
- [ ] Double-`activate` test throws; reactivation does not silently destroy the old client.

---

## Risk Notes

- **`createClient` is also exported and used by `loginWithPassword` / `register` today** as a singleton-mutating call. After Phase 3, only the matrix module's internal `activate` calls the singleton-mutating form. Make sure the transient one-shot client in `loginWithPassword` uses `sdkCreateClient` directly (rename / re-export if needed) to avoid setting the singleton during a login flow.
- **`activate` throwing on second call is a behavior change.** If any flow currently re-binds after sign-out + sign-in without going through `deactivate`, that flow will start throwing. The fix is correct (you must `deactivate` first); but watch for regressions in: HMR reload paths, deep-link sign-in while a session is already active, and any e2e flow that signs in twice in one process.
- **`signOut` order change.** Today: `stopSync → logout(true) → unbindEvents → destroyClient → clear`. New: `revokeMatrixSession (logout(true)) → deactivate (stopSync + unbindEvents + destroyClient + clear)`. The remote `/logout` call now happens BEFORE `stopSync`. If the homeserver call hangs, sync may continue briefly. Add a timeout to `revokeMatrixSession`'s fetch or `Promise.race` against the local teardown if this is observed.
- **Matrix-only fallback uses `'matrix-only'` discriminant in production.** App.vue currently silences it; once a UI nudge is added (separate change), that change becomes user-visible. Plan for it in the next iteration.
