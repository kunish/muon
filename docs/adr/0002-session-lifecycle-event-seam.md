# Session lifecycle events: subscription timing and emit order

The lifecycle module exposes `signIn` and `signOut` events that feature-layer stores and composables (`useConversations`, `useUnifiedInbox`, `serverStore`) subscribe to via `registerSessionSubscriber({ onSignIn, onSignOut })`. This ADR records two design choices that are hard to reverse without breaking subscribers.

## Decision 1 — Subscribers register at module-load time

Each subscribing module calls `registerSessionSubscriber` at top level, not inside a Vue composable / store factory.

**Why:** Composables and stores in this codebase already hold module-level shared state (`rooms`, `summaries`, `channelTree`, `historicalRoomOrder`). The session lifecycle binding is conceptually the same scope as that state — there is exactly one binding per module, not one per Vue instance. Registering inside a composable would either (a) gate registration behind the first instance mount (current `listenersBound` flag pattern, which is what we are removing) or (b) register once per mount and rely on dedup. Both hide the lifecycle ownership.

**Consequence:** Importing the module is a side-effecting act. Lazy-loaded routes will not register until first import, so they will miss the `signIn` fired during `bootstrap()` — but they self-refresh on their first mount anyway, so behavior is unchanged.

## Decision 2 — `signOut` fires BEFORE `deactivate()`

In `lifecycle.signOut()`, the order is `lifecycleEvents.emit('signOut', { reason })` → `revokeMatrixSession()` → `deactivate()` → `clearEnterprise()`. Subscribers receive the event while the Matrix client singleton is still alive.

**Why:** A subscriber that needs a final read from the SDK (flush pending state, snapshot the last-seen event id, persist user-scoped state under the still-known `userId`) must have a live `getClient()`. Emitting AFTER `deactivate()` would make `getClient()` throw inside subscribers' handlers.

**Consequence:** Subscribers' `onSignOut` handlers run before sync stops, so they should be quick and side-effect-free against the SDK. If a handler triggers more SDK calls that emit events, those events arrive at the SDK listeners that `deactivate` is about to unbind. Subscribers must not assume a quiet bus.

## When to revisit

If future subscribers need the opposite guarantee — "fire after the SDK is fully torn down so I can rebuild from scratch" — we introduce a second event (`signOutComplete`) rather than flipping this one.
