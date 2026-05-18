# Message domain types are immutable snapshots projected from SDK events

The matrix module exposes domain types **Message** (`ChatMessage | SystemMessage`) to feature-layer code. Stores, composables, and components never import `matrix-js-sdk`'s `MatrixEvent`. This ADR records two design constraints that future contributors should not casually flip.

## Decision 1 — Snapshot model, not reactive proxies

`useMessages` returns `Ref<Message[]>`. Each `Message` is an immutable plain object. When the SDK mutates the underlying `MatrixEvent` in place (decryption finishing, edits arriving, reactions accumulating, local-echo transitioning from `sending` to `sent`), the matrix module re-runs the projection over the affected room's timeline and pushes a new `Message[]` array; `useMessages` swaps the `Ref`.

**Why:** Vue's `shallowRef<MatrixEvent[]>` does not re-render on in-place SDK mutations because the array identity is unchanged. The existing code worked around this with a manual `timelineVersion = ref(0); timelineVersion.value++` after every refresh — a leakage symptom. Snapshots make Vue's reactivity model align with what the matrix module actually emits. The same shape already works for `RoomSummary`.

**Trade-off:** every per-event change rebuilds an array. We rely on the existing 80ms `useDebounceFn` in `useMessages` to coalesce bursts, and on virtualisation (roadmap §1.1) for large timelines. If profiling later shows the rebuild cost dominates, the escape hatch is a per-room reactive store keyed by event id — but only behind evidence.

## Decision 2 — Projections are pure: no session / `getClient()` access

`toMessage(event, room)` takes only its two arguments. `isMine` is not a field on `ChatMessage`. UI infers ownership by comparing `message.senderId` to `currentUserId` (from the upcoming `useCurrentUser` composable).

**Why:** A pure projection means a `Message` is identical regardless of who is viewing it, which makes unit tests trivial (no session mocking, no client singleton), enables reuse in non-UI contexts (digest, notification body), and prevents the projection layer from becoming a hidden read-amplifier on the client singleton. The single tiny cost — UI components need `currentUserId` to derive `isMine` — is paid once via `useCurrentUser`, not 200 times per timeline.

## When to revisit

If a new feature genuinely needs an SDK-shaped event (verifying signatures, low-level introspection), expose the underlying event through a narrow read function `getRawEvent(messageId)` rather than widening the `Message` interface or letting `getClient()` back into feature code.
