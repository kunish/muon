# Phase 04: Offline Digest and Decision Capture - Research

**Researched:** 2026-03-06
**Domain:** Matrix-based offline digest, citation traceability, and decision knowledge capture in Vue 3 desktop client
**Confidence:** MEDIUM

## User Constraints

- No `*-CONTEXT.md` found in this phase directory.
- Therefore, there are no additional locked decisions/discretion/deferred items beyond ROADMAP + REQUIREMENTS for this phase.

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                    | Research Support                                                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| DIGE-01 | User can view an offline catch-up digest for activity during their away window.                | Use event-driven materialization (Matrix events + network offline timestamps), persistent digest snapshots, and unread-window slicing. |
| DIGE-02 | User can open source citations from digest entries to verify each summary claim.               | Use citation-first schema (`roomId`, `eventId`, optional quote) and existing `loadInboxEventContext` + `focusEventId` jump chain.      |
| DIGE-03 | User can sort digest focus by personal relevance (my responsibility, my follows, my mentions). | Add deterministic relevance scoring/tags before rendering (`responsibility > follows > mentions` configurable).                        |
| DECI-01 | User can create a decision card with conclusion, context, owner, status, and linked messages.  | Introduce decision store + normalized decision entity + message link table (same citation schema as digest).                           |
| DECI-02 | User can accept or reject AI-suggested action items and blockers extracted from summaries.     | Use structured suggestion payload + explicit user disposition state (`accepted/rejected/pending`) + auditable timestamps.              |
| DECI-03 | User can ask a cross-conversation question and receive an answer with traceable citations.     | Reuse cross-room retrieval scope (joined rooms only), force answer grounding to cited events, and render expandable citations.         |

</phase_requirements>

## Summary

Phase 4 should build on Phase 3’s retrieval and jump-to-source foundations instead of introducing parallel navigation or data flows. The repository already has the critical primitives: joined-room bounded retrieval (`src/matrix/retrieval.ts`), context preloading + fallback navigation (`src/matrix/inbox.ts`, `GlobalSearch.vue`, `TaskPanel.vue`), and event bus hooks (`src/matrix/events.ts`). The safest plan is to compose digest/decision features on these same primitives.

For storage, this phase crosses from "small local preference state" (current localStorage patterns for inbox/defer/task) into "query-heavy historical knowledge" (digest entries, citations, decision cards, AI suggestion dispositions, Q&A traces). The project already depends on Dexie but does not use it yet. Using Dexie for this phase is the standard move to avoid localStorage scaling and indexing pain.

The most important design constraint is **citation-first** data modeling: every digest claim, AI suggestion, and Q&A answer fragment must carry message references from day one. If citations are bolted on later, verification UX and trust degrade fast.

**Primary recommendation:** Build a `digest/decision` domain module with Dexie-backed entities and mandatory citation arrays, reusing existing Matrix context-jump APIs and joined-room authorization boundaries.

## Standard Stack

### Core

| Library       | Version | Purpose                                            | Why Standard                                                               |
| ------------- | ------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| Vue           | 3.5.29  | UI + reactivity                                    | Existing app standard and all current chat features are Vue SFC-based.     |
| Pinia         | 3.0.4   | Domain state/actions                               | Existing stores use setup-style Pinia; aligns with current architecture.   |
| matrix-js-sdk | 41.0.0  | Message retrieval/context                          | Already used for search, timeline context, membership scoping.             |
| Dexie         | 4.3.0   | IndexedDB persistence for digest/decision entities | Already in dependencies; purpose-built for indexed offline data.           |
| zod           | 4.3.6   | Runtime validation of AI outputs/entities          | Already in dependencies; strong typed parsing for untrusted model outputs. |

### Supporting

| Library                 | Version | Purpose                                   | When to Use                                                |
| ----------------------- | ------- | ----------------------------------------- | ---------------------------------------------------------- |
| @tauri-apps/plugin-http | 2.5.7   | Outbound API calls (AI provider, if used) | Any model inference request from desktop client runtime.   |
| date-fns                | 4.1.0   | Time window bucketing/formatting          | Away-window slicing, digest grouping by time.              |
| @vueuse/core            | 14.2.1  | Reactive utilities                        | Debounce/search UX, persistent reactive helpers if needed. |

### Alternatives Considered

| Instead of                | Could Use                      | Tradeoff                                                                              |
| ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| Dexie                     | localStorage (current pattern) | localStorage is simple but poor for indexed, multi-entity, citation-heavy queries.    |
| Dexie                     | idb-keyval                     | idb-keyval is lightweight KV, but this phase needs relational-ish querying/indexes.   |
| zod-validated AI payloads | ad-hoc JSON parsing            | Ad-hoc parsing is faster to start but brittle and unsafe for DECI-02/03 auditability. |

**Installation:**

```bash
pnpm add dexie zod
```

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── features/chat/stores/
│   ├── digestStore.ts           # digest sessions, relevance sort, read state
│   └── decisionStore.ts         # cards, suggestion dispositions, qa sessions
├── features/chat/types/
│   ├── digest.ts                # domain types + enums
│   └── decision.ts              # decision entities and status transitions
├── features/chat/components/
│   ├── OfflineDigestPanel.vue   # digest UI + citation jumps
│   ├── DecisionPanel.vue        # card CRUD + suggest accept/reject
│   └── CrossSessionQaPanel.vue  # question input + cited answers
├── matrix/
│   └── digest.ts                # digest materialization from matrix events/retrieval
└── shared/lib/
    ├── knowledgeDb.ts           # Dexie schema and repositories
    └── ai/                      # provider adapter + zod parsing
```

### Pattern 1: Citation-First Entity Modeling

**What:** Digest entries, decisions, action items, blockers, and QA answers all include `citations: CitationRef[]` as required field.
**When to use:** Any content shown as "summary", "suggestion", or "answer".
**Example:**

```typescript
// Source: project pattern from src/matrix/inbox.ts + src/features/chat/components/TaskPanel.vue
export interface CitationRef {
  roomId: string
  eventId: string
  quote?: string
}

export interface DigestEntry {
  id: string
  title: string
  summary: string
  relevance: 'responsibility' | 'follow' | 'mention'
  citations: CitationRef[] // required, non-empty
}
```

### Pattern 2: Reuse Existing Jump Chain (Preload + Fallback)

**What:** Keep the established UX contract: try `loadInboxEventContext(roomId, eventId)` then navigate with `focusEventId`; never block navigation on preload failure.
**When to use:** Digest citation click, decision linked message click, QA answer citation click.
**Example:**

```typescript
// Source: src/features/chat/components/GlobalSearch.vue, src/features/chat/components/TaskPanel.vue
async function openCitation(roomId: string, eventId: string) {
  try {
    await loadInboxEventContext(roomId, eventId)
  }
  catch (error) {
    console.warn('[citation] preload failed, fallback navigation', error)
  }

  await router.push({
    path: `/dm/${encodeURIComponent(roomId)}`,
    query: { focusEventId: eventId },
  })
}
```

### Pattern 3: Event-Driven Digest Materialization

**What:** Use matrix event bus (`room.message`, `sync.state`) + `lastOfflineAt` to maintain "away window" candidates and generate digest snapshots on reconnect/open.
**When to use:** Offline catch-up computation for DIGE-01.
**Example:**

```typescript
// Source: src/matrix/events.ts + src/shared/composables/useNetworkStatus.ts
matrixEvents.on('room.message', ({ roomId, event }) => {
  digestStore.ingestEvent({
    roomId,
    eventId: event.getId(),
    ts: event.getTs(),
    sender: event.getSender(),
    body: event.getContent()?.body ?? '',
  })
})
```

### Anti-Patterns to Avoid

- **Parallel navigation pipelines:** Don’t create a second citation jump implementation; reuse existing context loader flow.
- **Summary without citations:** Any uncited digest/AI output should be rejected before render.
- **localStorage-only knowledge graph:** localStorage is fine for small toggles, not citation-rich history with filtering.
- **Component-level status mutation:** keep decision/action state transitions in store actions (same discipline as `taskStore`).

## Don't Hand-Roll

| Problem                       | Don't Build                        | Use Instead                            | Why                                                                  |
| ----------------------------- | ---------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Indexed offline query layer   | Custom IndexedDB wrapper           | Dexie                                  | Migration/versioning/indexing edge cases are non-trivial.            |
| AI payload safety             | Manual `JSON.parse` + field checks | Zod schemas                            | Prevents malformed suggestion/answer payloads from corrupting state. |
| Citation navigation           | New bespoke room/event resolver    | Existing `loadInboxEventContext` chain | Already battle-tested in Inbox/Task/Search flows.                    |
| Relevance sorting logic in UI | Ad-hoc per-component sorting       | Centralized store scorer               | Avoids inconsistent ordering across digest surfaces.                 |

**Key insight:** This phase is mostly about trust and traceability. Reusing proven primitives is more valuable than inventing new mechanisms.

## Common Pitfalls

### Pitfall 1: "Digest" becomes unread list clone

**What goes wrong:** UI shows too many raw items with little synthesis.
**Why it happens:** No explicit away-window compression and no relevance scoring threshold.
**How to avoid:** Define digest entry budget and deterministic relevance buckets before UI work.
**Warning signs:** Digest count ~= raw message count.

### Pitfall 2: Citation mismatch after data refresh

**What goes wrong:** Entry claims reference event IDs that no longer resolve in current room membership/view state.
**Why it happens:** Citation not validated at creation; left-room events not filtered.
**How to avoid:** Apply joined-room scope checks during ingest/render (same as Phase 3 retrieval guard).
**Warning signs:** Frequent "event not found" on citation click.

### Pitfall 3: AI suggestions mutate state without user gate

**What goes wrong:** Action/blocker items treated as accepted by default.
**Why it happens:** Missing explicit disposition model (`pending/accepted/rejected`).
**How to avoid:** Persist user decision separately from suggestion content; default `pending`.
**Warning signs:** Users cannot audit who accepted what, when.

### Pitfall 4: localStorage performance cliff

**What goes wrong:** Digest open time degrades as historical entries grow.
**Why it happens:** Full payload deserialize on each load + no secondary indexes.
**How to avoid:** Move digest/decision persistence to Dexie with indexed access paths.
**Warning signs:** Noticeable lag reopening digest after weeks of usage.

## Code Examples

Verified patterns from project + official docs:

### Setup-style Pinia store for domain state

```typescript
// Source: Pinia core concepts + existing project stores (retrieval/task/defer)
export const useDecisionStore = defineStore('decision', () => {
  const cards = ref<DecisionCard[]>([])

  function createCard(input: CreateDecisionCardInput) {
    // validate + persist in one action
  }

  function setSuggestionDisposition(id: string, disposition: 'accepted' | 'rejected') {
    // centralized transition logic
  }

  return { cards, createCard, setSuggestionDisposition }
})
```

### Dexie schema with explicit versioning

```typescript
// Source: Dexie docs (version().stores())
const db = new Dexie('MuonKnowledgeDB') as Dexie & {
  digestEntries: EntityTable<DigestEntry, 'id'>
  decisions: EntityTable<DecisionCard, 'id'>
}

db.version(1).stores({
  digestEntries: 'id, sessionId, relevance, createdAt, *citationEventIds',
  decisions: 'id, status, owner, updatedAt, *citationEventIds',
})
```

### Citation jump with graceful fallback

```typescript
// Source: existing navigation behavior in GlobalSearch/TaskPanel/ChannelSidebar
await openCitation(citation.roomId, citation.eventId)
```

## State of the Art

| Old Approach                                | Current Approach                                | When Changed                                     | Impact                                                  |
| ------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| Local UI summaries without proof links      | Citation-grounded summaries with source jumps   | Became standard in AI UX post-2023               | Better trust, debuggability, and user verification flow |
| KV-only local persistence for feature flags | Indexed local knowledge store (IndexedDB/Dexie) | Needed once cross-session querying is introduced | Keeps offline history performant and queryable          |
| Free-form model text output                 | Structured, schema-validated model output       | Modern production AI integrations                | Reduces malformed suggestion/answer risk                |

**Deprecated/outdated:**

- "Summary-only" outputs that cannot be traced back to messages.
- Treating accepted/rejected AI suggestions as transient UI state (must be persisted).

## Open Questions

1. **AI provider contract for DECI-02/03**
   - What we know: app has outbound HTTP pattern (`@tauri-apps/plugin-http`) but no existing LLM service module.
   - What's unclear: provider choice, auth strategy, latency/error budget.
   - Recommendation: planner should add a Wave 0 contract task (provider adapter + zod schema + mock implementation).

2. **Source of "my follows" signal for DIGE-03**
   - What we know: mention/highlight and unread are available; explicit follow/subscription signal is not obvious in current domain models.
   - What's unclear: whether follows map to starred/pinned/room tags or a new state field.
   - Recommendation: define deterministic temporary mapping in Wave 0 and document future migration path.

3. **Offline window boundary semantics**
   - What we know: `lastOfflineAt` exists in network composable.
   - What's unclear: should digest window key off browser offline, sync error, app background, or explicit "away" marker?
   - Recommendation: lock one canonical boundary event in plan (prefer sync/network combined marker) to avoid inconsistent digest windows.

## Validation Architecture

### Test Framework

| Property           | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| Framework          | Vitest 4.0.18 + Vue Test Utils 2.4.6 + Playwright 1.58.2 |
| Config file        | `vitest.config.ts`, `playwright.config.ts`               |
| Quick run command  | `pnpm test:unit`                                         |
| Full suite command | `pnpm test`                                              |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                | Test Type        | Automated Command                                                                                            | File Exists? |
| ------- | ------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| DIGE-01 | Away-window digest generation and display               | unit + component | `pnpm vitest run tests/unit/stores/digestStore.test.ts tests/components/OfflineDigestPanel.test.ts -x`       | ❌ Wave 0    |
| DIGE-02 | Digest citation opens source context                    | component        | `pnpm vitest run tests/components/OfflineDigestPanel.test.ts -t "citation" -x`                               | ❌ Wave 0    |
| DIGE-03 | Relevance sorting by responsibility/follows/mentions    | unit             | `pnpm vitest run tests/unit/stores/digestStore.test.ts -t "relevance" -x`                                    | ❌ Wave 0    |
| DECI-01 | Decision card CRUD with linked messages                 | unit + component | `pnpm vitest run tests/unit/stores/decisionStore.test.ts tests/components/DecisionPanel.test.ts -x`          | ❌ Wave 0    |
| DECI-02 | Accept/reject AI suggestions with persisted disposition | unit             | `pnpm vitest run tests/unit/stores/decisionStore.test.ts -t "suggestion disposition" -x`                     | ❌ Wave 0    |
| DECI-03 | Cross-conversation answer with citations only           | unit + component | `pnpm vitest run tests/unit/services/crossSessionQa.test.ts tests/components/CrossSessionQaPanel.test.ts -x` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm test:unit`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/stores/digestStore.test.ts` — covers DIGE-01, DIGE-03
- [ ] `tests/components/OfflineDigestPanel.test.ts` — covers DIGE-01, DIGE-02
- [ ] `tests/unit/stores/decisionStore.test.ts` — covers DECI-01, DECI-02
- [ ] `tests/components/DecisionPanel.test.ts` — covers DECI-01, DECI-02
- [ ] `tests/unit/services/crossSessionQa.test.ts` — covers DECI-03
- [ ] `tests/components/CrossSessionQaPanel.test.ts` — covers DECI-03

## Sources

### Primary (HIGH confidence)

- Project codebase:
  - `src/matrix/retrieval.ts` (joined-room search scope + pagination session)
  - `src/matrix/inbox.ts` (event context loading + fallback)
  - `src/features/chat/components/GlobalSearch.vue` (preload-then-navigate pattern)
  - `src/features/chat/components/TaskPanel.vue` (same jump pattern reuse)
  - `src/matrix/events.ts` (event bus hooks)
  - `src/shared/composables/useNetworkStatus.ts` (offline timing marker)
  - `src/features/chat/stores/taskStore.ts`, `deferStore.ts` (versioned persistence + action-centric transitions)
- Pinia official docs: https://pinia.vuejs.org/core-concepts/
- Matrix spec endpoint registry (latest): https://spec.matrix.org/latest/client-server-api/
- Zod docs (v4 intro + parse model): https://zod.dev/

### Secondary (MEDIUM confidence)

- Dexie docs (hello world + TS usage):
  - https://dexie.org/docs/Tutorial/Hello-World
  - https://dexie.org/docs/Typescript
- matrix-js-sdk API reference page for `MatrixClient` methods: https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html

### Tertiary (LOW confidence)

- Community examples/snippets of Matrix search response payload shapes (used only as supporting hint, not normative):
  - https://github.com/element-hq/element-android/issues/2110

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** - directly grounded in existing dependencies + official docs.
- Architecture: **MEDIUM** - strongly grounded in current project patterns, but AI provider contract still open.
- Pitfalls: **MEDIUM** - based on existing implementation constraints and common failures in similar apps.

**Research date:** 2026-03-06
**Valid until:** 2026-03-20 (14 days; AI/retrieval integration details are fast-moving)
