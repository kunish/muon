# Phase 3: Cross-Conversation Retrieval - Research

**Researched:** 2026-03-06
**Domain:** Matrix cross-conversation keyword retrieval + authorization scoping in Vue/Tauri client
**Confidence:** HIGH

## User Constraints

No `*-CONTEXT.md` found in `.planning/phases/03-cross-conversation-retrieval/` at research time.

- **Locked Decisions:** None provided via CONTEXT.md
- **Claude's Discretion:** Full implementation approach for RETR-01/RETR-02
- **Deferred Ideas:** None provided via CONTEXT.md

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                  | Research Support                                                                                                                                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RETR-01 | User can search messages across conversations by keyword and receive ranked results.         | Matrix `/search` + `matrix-js-sdk` `searchRoomEvents` supports cross-room message search, rank, pagination (`next_batch`), and event context; recommended UI/service structure and test plan included.                            |
| RETR-02 | User only sees retrieval results from conversations they are currently authorized to access. | Matrix spec enforces visibility-at-event-time, but includes left-room history in search; research recommends explicit client-side room scope filter (`joined` rooms only) to satisfy stricter “currently authorized” requirement. |

</phase_requirements>

## Summary

Phase 3 should be implemented on top of Matrix server-side search (`POST /_matrix/client/v3/search`) via `matrix-js-sdk`’s `searchRoomEvents`, **not** via custom indexing/ranking. This is the standard path for keyword retrieval across conversations, gives ranking metadata, and supports pagination with `next_batch` tokens. The project already has in-room search (`SearchMessages.vue`) and robust event-focus navigation (`loadInboxEventContext` + `focusEventId` in route + `MessageList` anchor/focus flow), so cross-conversation retrieval can reuse existing navigation primitives.

The major planning risk is authorization semantics. Matrix server-side search intentionally includes events in rooms the user could see (including left rooms). However, RETR-02 requires **currently authorized** conversations only. Therefore, implementation must explicitly restrict search scope to rooms where `getMyMembership() === 'join'` at query time. This aligns with existing code conventions in this repo and avoids accidental leakage from previously joined rooms.

E2EE is a known boundary: Matrix spec states server-side search does not include end-to-end encrypted room content. For v1 RETR-01/02, do not hand-roll local encrypted indexing in this phase; instead document and surface limitations cleanly in UX/telemetry.

**Primary recommendation:** Use `matrix-js-sdk` `searchRoomEvents` with explicit joined-room filter, `next_batch` pagination, and existing event-jump pipeline.

## Standard Stack

### Core

| Library                         | Version                    | Purpose                                            | Why Standard                                                                                        |
| ------------------------------- | -------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| matrix-js-sdk                   | ^41.0.0                    | Matrix client API, including search APIs           | Official SDK for Matrix; already integrated in project and provides typed search/pagination helpers |
| Vue 3 + Pinia                   | vue ^3.5.29 / pinia ^3.0.4 | Retrieval UI state and result rendering            | Existing app architecture and state model                                                           |
| Matrix Client-Server Search API | Spec v1.17                 | Server-side ranking, grouping, pagination, context | Protocol-native behavior and permission enforcement baseline                                        |

### Supporting

| Library                              | Version                             | Purpose                                        | When to Use                                                    |
| ------------------------------------ | ----------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Vue Router                           | ^5.0.3                              | Route query `focusEventId` for jump-to-message | When selecting a search hit to navigate and focus target event |
| Existing matrix inbox context helper | in-repo (`loadInboxEventContext`)   | Preload around target event before navigation  | Reuse for reliable jump behavior from global retrieval results |
| Vitest + Playwright                  | vitest ^4.0.18 / playwright ^1.58.2 | Unit/component/e2e verification                | Unit for transformation/auth-scoping; e2e for retrieval flows  |

### Alternatives Considered

| Instead of               | Could Use                     | Tradeoff                                                                 |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------ |
| `searchRoomEvents` (SDK) | Direct `/search` HTTP wrapper | Higher maintenance; reimplements SDK response processing/pagination      |
| Server ranking (`rank`)  | Custom client ranking         | Reinvents relevance scoring and edge cases; harder to validate           |
| Joined-room filter       | Trust server-only visibility  | May include left rooms (spec-allowed), which can violate RETR-02 wording |

**Installation:**

```bash
pnpm add matrix-js-sdk
```

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── matrix/
│   └── retrieval.ts          # Cross-room search service wrapper
├── features/chat/
│   ├── components/
│   │   ├── GlobalSearch.vue  # Evolve from room-name search to message retrieval entry
│   │   └── RetrievalResults.vue (optional)
│   └── stores/
│       └── retrievalStore.ts # Query/results/loading/pagination state
└── tests/
    ├── unit/matrix/retrieval.test.ts
    └── components/GlobalSearch.test.ts
```

### Pattern 1: Explicit joined-room scope filter

**What:** Build `rooms` filter from `client.getRooms().filter(r => r.getMyMembership() === 'join')` and pass into search filter.
**When to use:** Every cross-conversation retrieval request for RETR-02.
**Example:**

```typescript
// Source: repo convention in src/matrix/rooms.ts + GlobalSearch.vue
const joinedRoomIds = client
  .getRooms()
  .filter(r => r.getMyMembership() === 'join')
  .map(r => r.roomId)

const res = await client.searchRoomEvents({
  term,
  filter: { rooms: joinedRoomIds, limit: 20 },
})
```

### Pattern 2: SDK-managed pagination (`next_batch`)

**What:** Use `backPaginateRoomEventsSearch(searchResults)` when `searchResults.next_batch` exists.
**When to use:** Infinite scroll / “Load more” for retrieval results.
**Example:**

```typescript
// Source: matrix-js-sdk client.ts (searchRoomEvents/backPaginateRoomEventsSearch)
const searchResults = await client.searchRoomEvents({ term, filter })

if (searchResults.next_batch) {
  await client.backPaginateRoomEventsSearch(searchResults)
}
```

### Pattern 3: Reuse existing focus-navigation pipeline

**What:** Before route navigation, preload event context and navigate with `focusEventId`.
**When to use:** Clicking any retrieval result item.
**Example:**

```typescript
// Source: src/features/chat/components/TaskPanel.vue + src/features/chat/components/MessageList.vue
await loadInboxEventContext(roomId, eventId)
await router.push({
  path: `/chat/${encodeURIComponent(roomId)}`,
  query: { focusEventId: eventId },
})
```

### Anti-Patterns to Avoid

- **Local ad-hoc full-text index in this phase:** high complexity, stale index risk, and scope creep versus RETR-01/02.
- **Ignoring membership filter:** can expose left-room hits, conflicting with RETR-02.
- **Dropping `next_batch` state on re-render:** breaks pagination continuity and creates duplicated/flickering results.
- **Direct component-level SDK calls everywhere:** centralize in retrieval service/store for testability.

## Don't Hand-Roll

| Problem                     | Don't Build                 | Use Instead                                            | Why                                                   |
| --------------------------- | --------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Query relevance ranking     | Custom scoring formula      | Matrix server `rank` ordering                          | Protocol-native relevance and less tuning debt        |
| Search pagination tokens    | DIY cursor protocol         | `next_batch` + `backPaginateRoomEventsSearch`          | Already solved by SDK; avoids token misuse bugs       |
| Event-context jump logic    | New scroll/anchor mechanism | Existing `loadInboxEventContext` + `focusEventId` path | Proven in Phase 1/2 flows, reduces regression risk    |
| Permission model recreation | Custom ACL cache logic      | Server visibility + client joined-room scope           | Avoids subtle auth bugs while matching RETR-02 intent |

**Key insight:** retrieval appears simple, but ranking/pagination/visibility are protocol-level concerns; reuse SDK + existing app primitives.

## Common Pitfalls

### Pitfall 1: “Authorized” interpreted as “ever authorized”

**What goes wrong:** Results include events from rooms user left, because Matrix `room_events` category allows that.
**Why it happens:** Spec behavior is broader than RETR-02 wording.
**How to avoid:** Always inject `filter.rooms = joinedRoomIds` from current membership.
**Warning signs:** Search returns results from room IDs absent from current sidebar/joined set.

### Pitfall 2: Assuming server search covers E2EE messages

**What goes wrong:** Missing results from encrypted rooms look like “buggy search.”
**Why it happens:** Server-side search does not include E2EE rooms.
**How to avoid:** Explicit UX note/empty-state hint and docs; defer local encrypted indexing to future requirement (e.g., RETR-03/v2).
**Warning signs:** Consistent no-hit behavior for known encrypted-room keywords.

### Pitfall 3: Pagination resets on query/state transitions

**What goes wrong:** Duplicate first page or inability to fetch more.
**Why it happens:** `next_batch` token not persisted with result set instance.
**How to avoid:** Keep one search session object per query; reset only when query changes.
**Warning signs:** “Load more” returns same results repeatedly.

### Pitfall 4: Jump-to-result without context preload

**What goes wrong:** UI lands in room but target message is not in rendered window.
**Why it happens:** Missing timeline preload.
**How to avoid:** Reuse `loadInboxEventContext` before route navigation and let `MessageList` focus flow paginate if needed.
**Warning signs:** `focusEventId` remains in URL and scroll never stabilizes on target.

## Code Examples

Verified patterns from official sources and current codebase:

### Cross-room keyword search via SDK

```typescript
// Source: matrix-js-sdk MatrixClient.searchRoomEvents
const res = await client.searchRoomEvents({
  term: query,
  filter: { rooms: joinedRoomIds, limit: 20 },
})
```

### Continue pagination

```typescript
// Source: matrix-js-sdk MatrixClient.backPaginateRoomEventsSearch
if (res.next_batch)
  await client.backPaginateRoomEventsSearch(res)
```

### Existing in-room search pattern (baseline)

```typescript
// Source: src/features/chat/components/SearchMessages.vue
const res = await client.searchRoomEvents({
  term: q,
  filter: { rooms: [props.roomId] },
} as any)
```

### Existing navigation/focus chain

```typescript
// Source: src/matrix/inbox.ts + MessageList.vue
await loadInboxEventContext(roomId, eventId)
await router.push({
  path: `/chat/${encodeURIComponent(roomId)}`,
  query: { focusEventId: eventId },
})
```

## State of the Art

| Old Approach                         | Current Approach                                                   | When Changed                                                                 | Impact                                    |
| ------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------- |
| Local UI filters for room names only | Protocol-backed server-side message search with ranking/pagination | Already available in Matrix spec + SDK; app currently only partially uses it | Enables RETR-01 without bespoke indexing  |
| Implicit authorization assumptions   | Explicit “current membership” room filter                          | Required by RETR-02 semantics                                                | Prevents left-room leakage in results     |
| Ad-hoc navigation                    | Shared event-context preload + focus route param                   | Established in prior phases                                                  | Lower risk for retrieval jump regressions |

**Deprecated/outdated:**

- Building retrieval from scratch over timeline slices for cross-room keyword search is outdated for this phase; use server search endpoint and SDK abstractions.

## Open Questions

1. **Should encrypted-room misses be user-visible as a known limitation in UI copy?**
   - What we know: Server-side search excludes E2EE rooms.
   - What's unclear: Preferred product wording and placement.
   - Recommendation: Add a subtle hint in zero-results/help text for this phase.

2. **Result ranking mode: keep SDK default recent vs explicit rank-first?**
   - What we know: SDK `searchRoomEvents` sets `order_by: recent`; API supports `rank` and `recent`.
   - What's unclear: Product preference for “relevance first” vs “latest first”.
   - Recommendation: Start with SDK default for consistency, add explicit toggle only if required by UX.

3. **Where to host global retrieval UI entry?**
   - What we know: `GlobalSearch.vue` exists for room-name search and can be evolved.
   - What's unclear: Keep modal-only vs add dedicated side panel tab.
   - Recommendation: Reuse existing global modal entry first, avoid new navigation surface in this phase.

## Validation Architecture

### Test Framework

| Property           | Value                                      |
| ------------------ | ------------------------------------------ |
| Framework          | Vitest ^4.0.18 + Playwright ^1.58.2        |
| Config file        | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command  | `pnpm test:unit`                           |
| Full suite command | `pnpm test`                                |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                       | Test Type | Automated Command                                                               | File Exists? |
| ------- | -------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------- | ------------ |
| RETR-01 | Cross-conversation keyword search returns ranked/paged results | unit      | `pnpm vitest run tests/unit/matrix/retrieval.test.ts -t "cross-room search"`    | ❌ Wave 0    |
| RETR-01 | Selecting a result jumps to target event with context          | component | `pnpm vitest run tests/components/GlobalSearch.test.ts -t "jump to result"`     | ❌ Wave 0    |
| RETR-02 | Results limited to current joined rooms only                   | unit      | `pnpm vitest run tests/unit/matrix/retrieval.test.ts -t "joined-room scope"`    | ❌ Wave 0    |
| RETR-02 | Left-room IDs never appear in rendered results                 | component | `pnpm vitest run tests/components/GlobalSearch.test.ts -t "exclude left rooms"` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm vitest run tests/unit/matrix/retrieval.test.ts`
- **Per wave merge:** `pnpm test:unit`
- **Phase gate:** `pnpm test` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/matrix/retrieval.test.ts` — covers RETR-01/RETR-02 query transform, pagination, and room-scoping
- [ ] `tests/components/GlobalSearch.test.ts` — covers result rendering and click-to-jump behavior
- [ ] `tests/mocks/matrix-search.ts` (or extend existing mocks) — deterministic search payloads with `rank`, `next_batch`, and mixed membership rooms

## Sources

### Primary (HIGH confidence)

- Matrix spec Client-Server API (v1.17), `POST /_matrix/client/v3/search`, ordering/pagination/security:
  - https://spec.matrix.org/v1.17/client-server-api/#post_matrixclientv3search
  - https://spec.matrix.org/v1.17/client-server-api/#server-side-search
- Matrix spec Room History Visibility:
  - https://spec.matrix.org/v1.17/client-server-api/#room-history-visibility
- matrix-js-sdk API docs:
  - `MatrixClient.searchRoomEvents`: https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#searchRoomEvents
  - `IEventSearchOpts`: https://matrix-org.github.io/matrix-js-sdk/interfaces/matrix.IEventSearchOpts.html
  - `ISearchResults`: https://matrix-org.github.io/matrix-js-sdk/interfaces/matrix.ISearchResults.html
  - `IRoomEventFilter`: https://matrix-org.github.io/matrix-js-sdk/interfaces/matrix.IRoomEventFilter.html
- matrix-js-sdk source (commit referenced by TypeDoc) showing `order_by: SearchOrderBy.Recent` and pagination helpers:
  - https://raw.githubusercontent.com/matrix-org/matrix-js-sdk/0666d6b4e1be70e51b6d6f27a10e7efb226d5613/src/client.ts

### Secondary (MEDIUM confidence)

- In-repo implementation references:
  - `src/features/chat/components/SearchMessages.vue`
  - `src/features/chat/components/GlobalSearch.vue`
  - `src/matrix/inbox.ts`
  - `src/features/chat/components/MessageList.vue`
  - `src/matrix/rooms.ts`

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — official Matrix spec + official SDK docs + installed dependency version
- Architecture: **HIGH** — validated against current repository structure and established navigation patterns
- Pitfalls: **HIGH** — directly derived from protocol semantics (`left rooms`, E2EE exclusion, pagination tokens)

**Research date:** 2026-03-06
**Valid until:** 2026-04-05 (30 days)
