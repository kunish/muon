# Message Domain Types & Feature-Layer SDK Decoupling

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop leaking `matrix-js-sdk`'s `MatrixEvent` into chat features. Introduce **Message** (`ChatMessage | SystemMessage`) as the only timeline shape feature code sees, projected by a pure function in `src/matrix/projections/`. Migrate `useMessages` to return `Ref<Message[]>` (deleting the `timelineVersion` workaround), then migrate the four-or-five message-consuming components, then introduce `useCurrentUser` so the most common `getClient()` use (`getUserId()`) goes away.

**Architecture:**
- New module `src/matrix/projections/messages.ts` exposes `toMessage(event: MatrixEvent, room: Room): Message | null` — pure, no session deps. Returns `null` for events that aren't displayable (currently filtered by `isDisplayableTimelineEvent` inside `getTimeline`).
- New module `src/matrix/projections/index.ts` re-exports projections and `Message` types.
- `src/matrix/messages/timeline.ts` gains a higher-level `getMessages(roomId, limit): Message[]` that calls `getTimeline` internally and maps through `toMessage`. The raw `getTimeline` becomes module-internal.
- `useMessages` returns `Ref<Message[]>`, drops `timelineVersion`, drops the explicit `room.decrypted` / `room.localEchoUpdated` listeners (those now flow through the snapshot model via `room.timeline`).
- `useCurrentUser` (new composable in `src/shared/composables/useCurrentUser.ts`) wraps `getClient().getUserId()` behind a `Ref<string | null>`. Re-binds on `signIn`, clears on `signOut` via the lifecycle event seam from candidate #2.
- `chatStore.replyingTo` / `editingEvent` change type from `MatrixEvent | null` to `ChatMessage | null`.
- Public `src/matrix/index.ts` removes `getTimeline` from exports (replaced by `getMessages`). `getClient` stays exported for the moment — its full eradication is candidate #3b (follow-up plan).

**Tech Stack:** TypeScript, Vue 3, matrix-js-sdk, Vitest. No new dependencies.

**Prerequisite:** Candidate #2's plan (`2026-05-17-lifecycle-events.md`) is recommended but not strictly required. `useCurrentUser` can stand alone (subscribe to lifecycle events if they exist, else fall back to a one-shot `getClient().getUserId()` read with a manual refresh on sign-in). Plan Step 5.x explicitly handles both worlds.

**Glossary updates (already applied in `CONTEXT.md`):** **Message**, **ChatMessage**, **SystemMessage**, **RoomSummary** (backfilled).

**Locked design decisions:**
- **Q1 (a) Snapshot model**: `Message` is an immutable plain object. SDK in-place mutation → re-project → new array. See `docs/adr/0003-message-projection-design.md`.
- **Q2 union shape**: `Message = ChatMessage | SystemMessage`; `isMine` is NOT a field on `ChatMessage` — UI infers via `senderId === currentUserId`. Projection stays pure.
- **Q2 location**: `src/matrix/projections/messages.ts`. Pure module; no `getClient()` import.
- **Q3 (a) full getClient eradication, phased**: this plan removes `getClient().getUserId()` calls (most common). `getClient().getRoom()` / action-call eradication is candidate #3b — out of scope here.
- **Q4 (a) bottom-up migration**: define types + projection → migrate `useMessages` → migrate component consumers one by one.
- **Q4 confirmation**: `timelineVersion` workaround is dead code after Phase 2 lands.

**Out of scope:**
- `getClient().getRoom(roomId)` sweep and `RoomDetail` projection — candidate #3b follow-up plan.
- Action-call sweep (`getClient().redactEvent`, `leave`, `sendEvent`) — most already wrapped by `src/matrix/messages/` / `rooms.ts`; the remaining direct calls are candidate #3b.
- Removing `getClient` from `src/matrix/index.ts` public exports — final phase of #3b.
- Projecting `matrixEvents` payloads (e.g. `room.message` event currently carries `{ event: MatrixEvent }`). Feature subscribers will project at receive time via `toMessage`. Re-shaping the event bus payloads is candidate #3b.

---

## File Map

### Create
- `src/matrix/projections/messages.ts` — `Message`, `ChatMessage`, `SystemMessage`, `ReplyContext`, `toMessage(event, room): Message | null`.
- `src/matrix/projections/index.ts` — re-exports.
- `src/shared/composables/useCurrentUser.ts` — `useCurrentUser(): { userId: Ref<string | null> }` bound to lifecycle events.
- `tests/unit/matrix/projections/messages.test.ts` — projection unit tests covering: plain text, formatted body, redacted, reply, reaction summary attachment, sticker, system event variants, sendStatus pass-through.
- `tests/unit/shared/composables/useCurrentUser.test.ts` — binds on signIn, clears on signOut.

### Modify
- `src/matrix/messages/timeline.ts`
  - Add `export function getMessages(roomId, limit = 50): Message[]` that internally calls `getTimeline` and maps through `toMessage`, filtering out `null`s.
  - Demote `getTimeline` to module-internal (still exported within `messages/` for `getMessages` to call). Remove from `src/matrix/index.ts` public exports.
- `src/matrix/messages/index.ts`
  - Re-export `getMessages`. Remove `getTimeline` from the public surface (still importable inside the module).
- `src/matrix/index.ts`
  - Re-export `Message`, `ChatMessage`, `SystemMessage`, `ReplyContext` from `./projections`.
  - Replace `getTimeline` re-export with `getMessages`.
- `src/features/chat/composables/useMessages.ts`
  - Return type: `Ref<Message[]>` (was `Ref<MatrixEvent[]>`).
  - Remove `timelineVersion` ref entirely — it's dead.
  - Replace `getTimeline(roomId, limit)` calls with `getMessages(roomId, limit)`.
  - Remove `import type { TimelineRelationSummaries }` reshuffling if relationSummaries flows differently (see Step 2.3 for the reaction/threadReply pass-through decision).
  - Remove explicit `matrixEvents.on('room.decrypted', ...)` and `matrixEvents.on('room.localEchoUpdated', ...)` IF the projection's re-run on `room.timeline` already covers those (it should — `room.decrypted` emits `room.timeline` per `src/matrix/events.ts:53-54`; `room.localEchoUpdated` emits its own event that we DO still need to listen to since it doesn't re-emit timeline). Re-verify: keep `room.localEchoUpdated` listener; drop `room.decrypted` listener (covered via `room.timeline` cascade).
- `src/features/chat/stores/chatStore.ts`
  - Change `replyingTo: Ref<ChatMessage | null>` (was `MatrixEvent | null`). Same for `editingEvent`.
  - `setReplyingTo(message: ChatMessage | null)`, `setEditingEvent(message: ChatMessage | null)`.
  - Drop `import type { MatrixEvent } from 'matrix-js-sdk'`.
- `src/features/chat/components/MessageList.vue`
  - Adjust prop / local types from `MatrixEvent[]` to `Message[]`.
  - The hidden-filter `messages.value.filter(ev => !store.isHidden(ev.getId() || ''))` becomes `messages.value.filter(m => !store.isHidden(m.id))`.
  - `currentUserId` source switches from `getClient().getUserId()` to `useCurrentUser().userId.value` (Phase 4).
- `src/features/chat/components/MessageBubble.vue` and `ChatMessage.vue`
  - Replace every `props.event.getX()` access with `props.message.x` / direct field access.
  - The handful of places that call `props.event.getContent()?.info?.['xyz.muon.emoji']` etc. become `props.message.content.info?.['xyz.muon.emoji']`.
  - `isMine` becomes `computed(() => props.message.senderId === currentUserId.value)` where `currentUserId` comes from `useCurrentUser`.
- `src/features/chat/components/ThreadPanel.vue`
  - `replies: ShallowRef<Message[]>` (was `MatrixEvent[]`). Use `getThreadReplies(roomId, rootId).map(ev => toMessage(ev, room))` initially, or — preferred — add `getThreadMessages(roomId, rootId): Message[]` to `src/matrix/messages/reactions.ts` next to `getThreadReplies`.
  - Local helpers `getSenderName(event)` / `getTime(event)` become field reads.
- `src/features/chat/components/StarredMessages.vue` — same pattern.
- `src/features/chat/components/ForwardDialog.vue`
  - `event?: MatrixEvent` prop becomes `message?: ChatMessage`. Caller passes a `ChatMessage`.
- `src/features/chat/composables/useNotificationSound.ts`
  - `room.message` payload from `matrixEvents` is still `{ event: MatrixEvent }` (out of scope to change the bus). Inside the handler, call `toMessage(event, room)` once and use the projected `ChatMessage` for `senderNameFor` / `notificationBodyFor`. Drops the SDK accessors from this file.
- `src/features/chat/stores/digestStore.ts`
  - Same pattern: project on receive.

### Phase-gated (later steps)
- `src/features/chat/composables/useUnifiedInbox.ts:132` — `getClient().getUserId()` → `useCurrentUser().userId.value`.
- `src/features/chat/composables/useTyping.ts:14` — same.
- `src/features/chat/components/MessageList.vue:58` — same.
- `src/features/chat/components/ChatMessage.vue:108` — same.
- `src/features/chat/components/UserInfoPanel.vue:184` — same.
- Any other `getClient().getUserId()` hits Phase 5 sweep finds.

### Verify (no changes expected in this plan)
- `src/matrix/rooms.ts` — `RoomSummary` already domain-shaped. No projection needed.
- `src/matrix/messages/content.ts` — `getSystemEventInfo` already produces `SystemEventInfo`; the `SystemMessage` projection consumes it directly.

---

## Steps

### Phase 1 — Define `Message` types and the `toMessage` projection

- [ ] **1.1 — Create `src/matrix/projections/messages.ts`**
  ```ts
  import type { MatrixEvent, Room } from 'matrix-js-sdk'
  import type { MessageContent } from '@matrix/types'
  import type { ReactionSummary, SystemEventInfo } from '@matrix/messages'
  import { getSystemEventInfo, isSystemEvent } from '@matrix/messages'

  export interface ReplyContext {
    eventId: string
    senderId: string
    body: string
  }

  export interface ChatMessage {
    kind: 'chat'
    id: string
    roomId: string
    senderId: string
    timestamp: number
    msgType: string
    body: string
    formattedBody?: string
    content: MessageContent
    isRedacted: boolean
    replyTo?: ReplyContext
    reactions: ReactionSummary[]
    threadReplyCount?: number
    sendStatus?: 'sending' | 'sent' | 'not_sent'
  }

  export interface SystemMessage {
    kind: 'system'
    id: string
    roomId: string
    timestamp: number
    info: SystemEventInfo
  }

  export type Message = ChatMessage | SystemMessage

  export function toMessage(event: MatrixEvent, room: Room): Message | null { /* ... */ }
  ```
  - `toMessage` returns `null` if the event is not displayable (filter aligned with existing `isDisplayableTimelineEvent` semantics). The caller (`getMessages`) filters out `null`s.
  - System events: when `isSystemEvent(event)`, return `SystemMessage` with `info: getSystemEventInfo(event, room)`.
  - Reply context: read `event.getContent()?.['m.relates_to']?.['m.in_reply_to']?.event_id`; if present, resolve the target event from `room.getLiveTimeline()` and project its `senderId` + `body`. **Important:** keep this resolution lazy / cheap — if the target isn't loaded, `replyTo` is omitted. UI already handles missing reply context.
  - Reactions: pass through what `getTimelineRelationSummaries` produces for this event's id (or accept reactions as a separate side-channel — see Step 2.3).
  - `sendStatus`: read `event.status` (SDK property) and map to the union.
- [ ] **1.2 — Create `src/matrix/projections/index.ts`** re-exporting types and `toMessage`.
- [ ] **1.3 — Unit tests in `tests/unit/matrix/projections/messages.test.ts`**
  - Plain text: round-trips body / senderId / timestamp.
  - Formatted body: HTML preserved.
  - Redacted: `isRedacted: true`, `body: ''`.
  - Reply: `replyTo` populated when target is in timeline; omitted otherwise.
  - Sticker (`m.sticker`): `msgType` and `content` carry url/info.
  - System event variants (member join, name change): `kind: 'system'`, `info` matches `SystemEventInfo`.
  - Sending local echo: `sendStatus: 'sending'`.

**Checkpoint:** All tests pass. No consumers yet — pure addition.

### Phase 2 — `useMessages` consumes `Message[]`

- [ ] **2.1 — Add `getMessages(roomId, limit): Message[]` in `src/matrix/messages/timeline.ts`**
  - Implementation: `const room = getClient().getRoom(roomId); if (!room) return []; return getTimeline(roomId, limit).map(ev => toMessage(ev, room)).filter((m): m is Message => m !== null)`.
  - Add `getMessages` to `src/matrix/messages/index.ts` and `src/matrix/index.ts` public exports.
  - Keep `getTimeline` exported in `messages/index.ts` until Phase 6 (still imported by useMessages tests if any).
- [ ] **2.2 — Migrate `src/features/chat/composables/useMessages.ts`**
  - `messages = shallowRef<Message[]>([])` instead of `MatrixEvent[]`.
  - Replace all `getTimeline(...)` calls with `getMessages(...)`.
  - Delete `timelineVersion` ref. Confirm via grep that nothing outside this file referenced it (it was returned from `useMessages` — Step 3.x will update callers).
  - Remove `matrixEvents.on('room.decrypted', onTimelineUpdate)` and matching `off`. Reason: `events.ts:53-54` already emits `room.timeline` after `room.decrypted`, so the projection re-derivation flows through the existing `room.timeline` listener.
  - **Keep** `matrixEvents.on('room.localEchoUpdated', ...)` — `events.ts:66` does NOT cascade to `room.timeline` for local echoes.
  - `markAsRead()`: replace `lastEvent.getId()` with `lastMessage.id`.
- [ ] **2.3 — Reactions / threadReplyCount placement decision**
  - Option (a): `ChatMessage.reactions` and `ChatMessage.threadReplyCount` are populated inside `toMessage` by reading from `room.getLiveTimeline()` and the SDK's relation aggregator. Each projection call walks the relations — small constant cost per event.
  - Option (b): Keep `relationSummaries` as a separate return from `useMessages` (current shape); UI joins by id. Existing UI already does this for some cases.
  - Pick (a) — locality wins. `getMessages` calls `toMessage` which calls `room.getRelations(event.getId(), 'm.annotation', 'm.reaction')` etc. The `getTimelineRelationSummaries` function can be deleted or kept as a public helper for non-timeline contexts. Step 2.3a removes `relationSummaries` from `useMessages`'s return shape.
  - Tests in 1.3 already cover this; expand if needed.
- [ ] **2.4 — Update `useMessages` return shape**
  - `return { messages, isLoading, hasMore, loadMore, refresh: loadTimeline }`. No `relationSummaries`, no `timelineVersion`.

**Checkpoint:** Run the app; chat timeline still renders. Type errors flood in across `MessageList.vue` / `MessageBubble.vue` / `ChatMessage.vue` — those are Phase 3. Don't ship from here yet.

### Phase 3 — Migrate the message-rendering components

- [ ] **3.1 — `MessageList.vue`**
  - Update local types to `Message[]`.
  - `messages.value.filter(ev => !store.isHidden(ev.getId() || ''))` → `messages.value.filter(m => !store.isHidden(m.id))`.
  - Pass `Message` to child `MessageBubble` / `ChatMessage`.
- [ ] **3.2 — `MessageBubble.vue`** (largest blast)
  - Prop: `event: MatrixEvent` → `message: ChatMessage` (or `Message` if it also renders system rows; check current usage and split into `MessageBubble` + `SystemMessageRow` if cleaner).
  - All `props.event.getId()` / `getType()` / `getContent()` / `getSender()` / `getTs()` / `isRedacted()` → `props.message.id` / `msgType` / `content` / `senderId` / `timestamp` / `isRedacted`.
  - Reply lookup: instead of resolving inside the bubble via SDK reads, consume `props.message.replyTo` directly.
- [ ] **3.3 — `ChatMessage.vue`**
  - Same pattern. The handful of `getClient()` calls here are `getUserId()` (Phase 4) and `getRoom()` (deferred to #3b).
- [ ] **3.4 — `ThreadPanel.vue` + `StarredMessages.vue` + `ForwardDialog.vue`**
  - Add `getThreadMessages(roomId, rootId): Message[]` next to `getThreadReplies` in `src/matrix/messages/reactions.ts`.
  - Migrate each component to consume `Message`. `getThreadReplies` can stay exported for backward compat in this plan; delete in Phase 6.

**Checkpoint:** Type-clean. Manual: open a chat, send a message, react, edit a previous message, decrypt-on-arrival (encrypted room). All renderings update without `timelineVersion`.

### Phase 4 — `useCurrentUser` and eradicate `getClient().getUserId()`

- [ ] **4.1 — Create `src/shared/composables/useCurrentUser.ts`**
  ```ts
  import { ref } from 'vue'
  import { getClient } from '@matrix/index' // tolerated only inside this composable
  import { registerSessionSubscriber } from '@/auth/lifecycleEvents' // if #2 has landed

  const userId = ref<string | null>(null)

  // If lifecycle events exist:
  registerSessionSubscriber({
    onSignIn: ({ session }) => { userId.value = session.userId },
    onSignOut: () => { userId.value = null },
  })

  // If #2 has NOT landed yet: seed from getClient() on first access; refresh when called manually.
  // (Plan executor: pick the branch that matches the current state of the worktree.)

  export function useCurrentUser() {
    return { userId }
  }
  ```
- [ ] **4.2 — Sweep `getClient().getUserId()` call sites**
  - `grep -rEn 'getClient\(\)\.getUserId\(\)' src/` outside `src/matrix/`. Replace each with `const { userId } = useCurrentUser(); /* userId.value */`.
  - Known hits: `useUnifiedInbox:132`, `useTyping:14`, `MessageList:58`, `ChatMessage:108`, `UserInfoPanel:184`, `chatStore` reactive computations (verify), and possibly more (`grep` is the source of truth).
- [ ] **4.3 — Tests for `useCurrentUser`**
  - When `signIn` fires with a session → `userId.value` becomes the session userId.
  - When `signOut` fires → `userId.value === null`.
  - Two consumers see the same ref (shared module-level state).

**Checkpoint:** `grep -rEn 'getClient\(\)\.getUserId\(\)' src/ | grep -v /matrix/` returns zero.

### Phase 5 — chatStore composer types + final sweep

- [ ] **5.1 — Update `chatStore.replyingTo` / `editingEvent`**
  - Types change to `Ref<ChatMessage | null>`. Setters take `ChatMessage | null`.
  - Callers in composer components (`MessageInput.vue` or wherever `setReplyingTo(event)` is called) now pass a `ChatMessage` — should be a near-mechanical change since they receive the bubble's `message` prop.
- [ ] **5.2 — Verify all chat-feature MatrixEvent imports gone**
  - `grep -rEn 'MatrixEvent' src/features/ src/app/ --include="*.ts" --include="*.vue"` — anything matching is a residual leak. Either fix it (preferred) or document why it stays.
  - Acceptable exception: `useNotificationSound` / `digestStore` receive raw events from `matrixEvents` payloads (per "Out of scope" — bus payload reshape is #3b). They project locally; this is fine.

### Phase 6 — Cleanup

- [ ] **6.1 — Remove `getTimeline` from `src/matrix/index.ts` public surface.** `getMessages` is the public API.
- [ ] **6.2 — Remove `getTimelineRelationSummaries` from public surface if Step 2.3a inlined it into `toMessage`.** If anything outside `messages/` still uses it, leave it.
- [ ] **6.3 — Remove `getThreadReplies` from public surface if `getThreadMessages` replaces it everywhere.**
- [ ] **6.4 — Lint + typecheck + test**: `pnpm lint && pnpm typecheck && pnpm test`.
- [ ] **6.5 — Note follow-up in `docs/optimization-roadmap.md` §2.4** that this plan addressed the `MatrixEvent` leak and partial `getClient()` cleanup; remaining `getClient()` work tracked as candidate #3b.

**Checkpoint:** `grep -rEn 'MatrixEvent|import.*matrix-js-sdk' src/features/ --include="*.ts" --include="*.vue"` returns only the two acceptable exceptions noted above (or zero, if Step 5.2 fixed them too).

---

## Verification

- [ ] `grep -rEn 'timelineVersion' src/` returns zero hits.
- [ ] `grep -rEn 'MatrixEvent' src/features/chat/components/ src/features/chat/stores/ --include="*.ts" --include="*.vue"` returns zero hits (composables `useNotificationSound`, `digestStore` projecting on receive is acceptable).
- [ ] `grep -rEn 'getClient\(\)\.getUserId\(\)' src/ --include="*.ts" --include="*.vue" | grep -v /matrix/ | grep -v useCurrentUser` returns zero hits.
- [ ] Manual: in an encrypted room, send a message from another client. UI shows the decrypted body without a manual refresh / `timelineVersion` bump.
- [ ] Manual: edit one of your previous messages. The bubble updates without explicit refresh.
- [ ] Unit tests cover the projection paths listed in Step 1.3 and 4.3.

---

## Risk Notes

- **Reaction summary perf**: option (a) in Step 2.3 calls `room.getRelations(...)` per event during projection. For a 200-message timeline this is 200 relation lookups every refresh. The existing `getTimelineRelationSummaries` does the same walk in one pass and was already part of `useMessages`. If profiling shows per-event lookups dominate, fold reactions into a single relation walk inside `getMessages` and inject results into each `ChatMessage` — same end state, fewer SDK calls.
- **Reply context resolution**: if the replied-to event isn't loaded (long history pagination), `replyTo` is omitted. UI today shows a placeholder; behavior is unchanged. Tests must cover the "reply target absent" path.
- **`useCurrentUser` without lifecycle events**: if candidate #2 has NOT landed when this plan runs, Step 4.1 needs the seed-from-getClient fallback. Document this clearly so the plan executor picks the right branch. Do not silently degrade — a missing `userId` should be explicit (`null`).
- **`sendStatus` semantics**: matrix-js-sdk's `event.status` is `null` for live events and one of `'sending' | 'sent' | 'not_sent' | 'queued' | 'cancelled' | 'encrypting'` for local echoes. The projection must map this onto the narrower `'sending' | 'sent' | 'not_sent'` union — `'queued'` and `'encrypting'` collapse to `'sending'`, `'cancelled'` to `'not_sent'`. Cover in tests.
- **System message coverage**: `SystemEventInfo` currently lives in `src/matrix/messages/content.ts`. Confirm it covers every system event the bubble renders today before flipping `MessageBubble` to consume `SystemMessage`. If gaps exist, extend `getSystemEventInfo` first.
- **Backward-compat exports during migration**: Phases 2-3 land separately. Between them, `getTimeline` is still exported and any test importing it still works. Phase 6 cleanup is the irrevocable step — postpone until everything is green.
