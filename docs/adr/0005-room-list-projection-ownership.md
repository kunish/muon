# RoomList is a matrix-module projection, not a feature store

The single source of truth for "the joined-rooms list as seen by the desktop" lives in `src/matrix/projections/roomList.ts` — a `ShallowRef<RoomSummary[]>` plus bind/unbind handlers wired into the lifecycle subscriber API. View-layer composables (`useConversations`, `useUnifiedInbox`, and future siblings) consume this ref read-only and apply their own view-specific derivations on top.

## Why

Two natural homes:

1. **Feature-layer Pinia store** (`src/features/chat/stores/roomListStore.ts`). Obvious for state shared across chat-feature composables.
2. **Matrix-module projection** (`src/matrix/projections/roomList.ts`). Consistent with how `RoomSummary` (already), `Message` (per `2026-05-17-message-domain-types.md`), and `RoomDetail` (per `2026-05-17-getclient-eradication.md`) are owned by the matrix module.

We picked (2) because the room list is structurally a projection of Matrix SDK state — same as `RoomSummary` itself, which lives in `src/matrix/types.ts`. Putting the cached/reactive form in the matrix module keeps the SDK boundary intact: the matrix module owns "the projected current state of the world," features compose views on top. Putting it in `src/features/chat/` would mean the chat feature owns a reactive view of state that other features (notifications, server) also legitimately want to read — re-creating the cross-feature coupling that `2026-05-17-lifecycle-events.md` is already cleaning up.

## Why view-specific UX policy (stable ordering) stays in view code

`useConversations.historicalRoomOrder` exists so the sidebar does not visibly shuffle when nothing meaningful has changed. That is a sidebar-rendering policy — `useUnifiedInbox` deliberately ignores it and sorts by latest event timestamp. Pushing stable-ordering into the projection store would force both views to inherit one policy and couple data ownership to one consumer's UX. Stable ordering stays in `useConversations`.

## Consequence

- The 200ms TTL cache in `getRoomSummaries()` and the `invalidateRoomSummariesCache()` escape hatch become unnecessary and are removed. The projection store is always current; one-shot callers of `getRoomSummaries()` (e.g., the login seed path) read fresh.
- Adding a future room-list consumer (a future search palette, a future workspace digest) is a `useRoomListSummaries()` import and zero `matrixEvents` plumbing.

## When to revisit

If profiling reveals that the single shared projection is too coarse — e.g., the inbox would benefit from a different derived shape that does not need full re-derivation when a non-DM room receives a typing event — split the projection by criterion (DM-only, mentions-only) rather than letting consumers re-derive independently.
