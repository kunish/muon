# P2 — decisionStore → @tanstack/vue-query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Pinia `decisionStore` (pure server state sourced from Dexie) with `@tanstack/vue-query`, establishing the vue-query query/mutation conventions reused by every P3 store.

**Architecture:** `decisionStore` holds no client-only state — `cards` is fully derived from the `knowledgeDb` repository. Split it into three layers: (1) a **query-key factory** (`decisionKeys.ts`), (2) a **plain async data layer** (`decisionCardsApi.ts`) that unwinds the repository's Promise methods and owns all card-merging logic — fully unit-testable without vue-query, (3) **composables** (`useDecisionCards.ts`) wiring the data layer to `useQuery`/`useMutation`, with mutations updating the cache via `setQueryData` (no re-hydrate, preserving the old `upsertCard` UX). The component reads `cards` from the query and calls `mutateAsync`.

**Tech Stack:** Vue 3 Composition API, `@tanstack/vue-query@5`, Vitest + Vue Test Utils, zod (`decisionCardSchema`), the existing `createKnowledgeRepository()` (already returns Promises — no Effect unwinding needed).

---

## File Structure

| File | Responsibility |
| --- | --- |
| Create `apps/desktop/src/features/chat/queries/decisionKeys.ts` | Query-key factory (`decisionKeys.all` / `decisionKeys.cards()`). Reference for the P3 convention. |
| Create `apps/desktop/src/features/chat/queries/decisionCardsApi.ts` | Plain async data layer: `loadDecisionCards`, `createDecisionCardEntry`, `setSuggestionDispositionEntry`, pure helper `upsertDecisionCard`. Owns digest materialization + suggestion merge. |
| Create `apps/desktop/src/features/chat/queries/useDecisionCards.ts` | Composables: `useDecisionCardsQuery`, `useCreateDecisionCard`, `useSetSuggestionDisposition`. |
| Modify `apps/desktop/src/features/chat/components/DecisionPanel.vue` | Consume composables instead of the store; drop the `onMounted` hydrate (query auto-fetches). |
| Delete `apps/desktop/src/features/chat/stores/decisionStore.ts` | Fully replaced. |
| Create `apps/desktop/tests/unit/queries/decisionCards.test.ts` | Data-layer tests (ported 1:1 from the old store test, calling plain functions). |
| Delete `apps/desktop/tests/unit/stores/decisionStore.test.ts` | Replaced by the queries test. |
| Modify `apps/desktop/tests/components/DecisionPanel.test.ts` | Install `VueQueryPlugin` + `createTestQueryClient()`; seed via repository mocks instead of the store. |

---

## Task 1: Data layer (`decisionKeys.ts` + `decisionCardsApi.ts`)

**Files:**
- Create: `apps/desktop/src/features/chat/queries/decisionKeys.ts`
- Create: `apps/desktop/src/features/chat/queries/decisionCardsApi.ts`
- Test: `apps/desktop/tests/unit/queries/decisionCards.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/unit/queries/decisionCards.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listDecisionCardsMock = vi.fn()
const listDigestEntriesMock = vi.fn()
const saveDecisionCardMock = vi.fn()
const updateSuggestionDispositionMock = vi.fn()

vi.mock('@features/chat/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    listDecisionCards: (...args: unknown[]) => listDecisionCardsMock(...args),
    listDigestEntries: (...args: unknown[]) => listDigestEntriesMock(...args),
    saveDecisionCard: (...args: unknown[]) => saveDecisionCardMock(...args),
    updateSuggestionDisposition: (...args: unknown[]) => updateSuggestionDispositionMock(...args),
  }),
}))

import {
  createDecisionCardEntry,
  loadDecisionCards,
  setSuggestionDispositionEntry,
  upsertDecisionCard,
} from '@/features/chat/queries/decisionCardsApi'

beforeEach(() => {
  listDecisionCardsMock.mockReset()
  listDecisionCardsMock.mockResolvedValue([])
  listDigestEntriesMock.mockReset()
  listDigestEntriesMock.mockResolvedValue([])
  saveDecisionCardMock.mockReset()
  saveDecisionCardMock.mockImplementation(async (card) => card)
  updateSuggestionDispositionMock.mockReset()
  updateSuggestionDispositionMock.mockImplementation(
    async (_decisionId, _suggestionId, disposition, updatedBy, updatedAt) => ({
      suggestions: [{ id: 'suggestion-1', disposition, updatedBy, updatedAt }],
      updatedAt,
    }),
  )
})

describe('decisionCardsApi', () => {
  it('createDecisionCardEntry 必须保存 conclusion/context/owner/status/citations', async () => {
    const card = await createDecisionCardEntry({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      suggestions: [
        {
          id: 'suggestion-1',
          kind: 'action',
          summary: 'Create panel',
          citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
        },
      ],
      now: 100,
    })

    expect(card.conclusion).toBe('Ship digest panel')
    expect(card.context).toBe('Offline catch-up is missing')
    expect(card.owner).toBe('@alice:muon.dev')
    expect(card.status).toBe('open')
    expect(card.citations).toHaveLength(1)
    expect(saveDecisionCardMock).toHaveBeenCalledTimes(1)
  })

  it('loadDecisionCards restores saved cards and materializes digest-backed pending suggestions', async () => {
    listDecisionCardsMock.mockResolvedValue([
      {
        id: 'decision-saved-1',
        conclusion: 'Keep current rollout window',
        context: 'Existing saved decision',
        owner: '@alice:muon.dev',
        status: 'confirmed',
        citations: [{ roomId: '!room:muon.dev', eventId: '$saved-1' }],
        citationEventIds: ['$saved-1'],
        suggestions: [],
        createdAt: 50,
        updatedAt: 60,
      },
    ])
    listDigestEntriesMock.mockResolvedValue([
      {
        id: 'digest-1',
        sessionId: 'digest-session-1',
        title: 'Digest: rollout follow-up',
        summary: 'Action: Follow up with Alice. Blocker: Waiting on legal sign-off.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1', quote: 'Need follow-up' }],
        citationEventIds: ['$digest-1'],
        createdAt: 100,
        updatedAt: 100,
      },
    ])

    const cards = await loadDecisionCards()

    expect(listDecisionCardsMock).toHaveBeenCalledTimes(1)
    expect(listDigestEntriesMock).toHaveBeenCalledTimes(1)
    expect(cards.map((card) => card.id)).toEqual(['decision:digest:digest-1', 'decision-saved-1'])
    expect(cards[0]).toMatchObject({
      conclusion: 'Digest: rollout follow-up',
      context: 'Action: Follow up with Alice. Blocker: Waiting on legal sign-off.',
      owner: 'digest',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1', quote: 'Need follow-up' }],
    })
    expect(cards[0]?.suggestions).toEqual([
      expect.objectContaining({
        id: 'digest-1:action:0',
        kind: 'action',
        summary: 'Follow up with Alice.',
        disposition: 'pending',
      }),
      expect.objectContaining({
        id: 'digest-1:blocker:0',
        kind: 'blocker',
        summary: 'Waiting on legal sign-off.',
        disposition: 'pending',
      }),
    ])
  })

  it('loadDecisionCards preserves accepted or rejected dispositions during digest rematerialization', async () => {
    listDecisionCardsMock.mockResolvedValue([
      {
        id: 'decision:digest:digest-1',
        conclusion: 'Digest: rollout follow-up',
        context: 'Existing digest-backed draft',
        owner: 'digest',
        status: 'open',
        citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1' }],
        citationEventIds: ['$digest-1'],
        suggestions: [
          {
            id: 'digest-1:action:0',
            kind: 'action',
            summary: 'Follow up with Alice.',
            disposition: 'accepted',
            updatedAt: 140,
            updatedBy: '@alice:muon.dev',
            citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1' }],
            citationEventIds: ['$digest-1'],
          },
          {
            id: 'digest-1:blocker:0',
            kind: 'blocker',
            summary: 'Waiting on legal sign-off.',
            disposition: 'rejected',
            updatedAt: 141,
            updatedBy: '@bob:muon.dev',
            citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1' }],
            citationEventIds: ['$digest-1'],
          },
        ],
        createdAt: 100,
        updatedAt: 141,
      },
    ])
    listDigestEntriesMock.mockResolvedValue([
      {
        id: 'digest-1',
        sessionId: 'digest-session-1',
        title: 'Digest: rollout follow-up',
        summary: 'Action: Follow up with Alice. Blocker: Waiting on legal sign-off.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1' }],
        citationEventIds: ['$digest-1'],
        createdAt: 100,
        updatedAt: 150,
      },
    ])

    const cards = await loadDecisionCards()

    expect(cards).toHaveLength(1)
    expect(cards[0]?.suggestions).toEqual([
      expect.objectContaining({
        id: 'digest-1:action:0',
        disposition: 'accepted',
        updatedBy: '@alice:muon.dev',
        updatedAt: 140,
      }),
      expect.objectContaining({
        id: 'digest-1:blocker:0',
        disposition: 'rejected',
        updatedBy: '@bob:muon.dev',
        updatedAt: 141,
      }),
    ])
  })

  it('aI suggestions default to pending and only transition to accepted/rejected', async () => {
    const created = await createDecisionCardEntry({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      suggestions: [
        {
          id: 'suggestion-1',
          kind: 'action',
          summary: 'Create panel',
          citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
        },
      ],
      now: 100,
    })

    expect(created.suggestions[0]?.disposition).toBe('pending')

    await setSuggestionDispositionEntry(created, 'suggestion-1', 'accepted', '@alice:muon.dev', 120)
    expect(updateSuggestionDispositionMock).toHaveBeenCalledWith(
      'decision-1',
      'suggestion-1',
      'accepted',
      '@alice:muon.dev',
      120,
    )

    await expect(
      // @ts-expect-error pending is not an assignable disposition — runtime must also reject
      setSuggestionDispositionEntry(created, 'suggestion-1', 'pending', '@alice:muon.dev', 121),
    ).rejects.toThrowError()
  })

  it('loadDecisionCards only materializes digest-backed suggestions from the latest session', async () => {
    listDecisionCardsMock.mockResolvedValue([])
    listDigestEntriesMock.mockResolvedValue([
      {
        id: 'digest-current-1',
        sessionId: 'session-current',
        title: 'Current session entry 1',
        summary: 'Action: Deploy the hotfix immediately.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$current-1', quote: 'Deploy the hotfix' }],
        citationEventIds: ['$current-1'],
        createdAt: 200,
        updatedAt: 200,
      },
      {
        id: 'digest-current-2',
        sessionId: 'session-current',
        title: 'Current session entry 2',
        summary: 'Blocker: Waiting on QA approval.',
        relevance: 'follow',
        citations: [{ roomId: '!room:muon.dev', eventId: '$current-2', quote: 'QA approval needed' }],
        citationEventIds: ['$current-2'],
        createdAt: 210,
        updatedAt: 210,
      },
      {
        id: 'digest-old-1',
        sessionId: 'session-old',
        title: 'Old session entry',
        summary: 'Action: Review the PR from last week. Blocker: Merge conflict unresolved.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$old-1', quote: 'Review the PR' }],
        citationEventIds: ['$old-1'],
        createdAt: 50,
        updatedAt: 50,
      },
    ])

    const cards = await loadDecisionCards()

    const digestCardIds = cards.filter((card) => card.owner === 'digest').map((card) => card.id)
    expect(digestCardIds).toContain('decision:digest:digest-current-1')
    expect(digestCardIds).toContain('decision:digest:digest-current-2')
    expect(digestCardIds).not.toContain('decision:digest:digest-old-1')
  })

  it('stale digest entries from older sessions do not generate new suggestion cards', async () => {
    listDecisionCardsMock.mockResolvedValue([])
    listDigestEntriesMock.mockResolvedValue([
      {
        id: 'digest-current-quiet',
        sessionId: 'session-current',
        title: 'Current session quiet entry',
        summary: 'General discussion about project timeline.',
        relevance: 'mention',
        citations: [{ roomId: '!room:muon.dev', eventId: '$current-quiet', quote: 'General discussion' }],
        citationEventIds: ['$current-quiet'],
        createdAt: 200,
        updatedAt: 200,
      },
      {
        id: 'digest-stale-1',
        sessionId: 'session-ancient',
        title: 'Ancient session entry',
        summary: 'Action: Refactor the auth module. Blocker: Missing test coverage.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$stale-1', quote: 'Refactor auth' }],
        citationEventIds: ['$stale-1'],
        createdAt: 10,
        updatedAt: 10,
      },
    ])

    const cards = await loadDecisionCards()

    const digestCards = cards.filter((card) => card.owner === 'digest')
    expect(digestCards).toHaveLength(0)
  })

  it('accept/reject 保留审计字段 updatedAt/updatedBy', async () => {
    const created = await createDecisionCardEntry({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      suggestions: [
        {
          id: 'suggestion-1',
          kind: 'action',
          summary: 'Create panel',
          citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
        },
      ],
      now: 100,
    })

    const updated = await setSuggestionDispositionEntry(created, 'suggestion-1', 'rejected', '@bob:muon.dev', 150)

    expect(updated.suggestions[0]).toMatchObject({
      disposition: 'rejected',
      updatedBy: '@bob:muon.dev',
      updatedAt: 150,
    })
  })

  it('upsertDecisionCard replaces by id and keeps updatedAt-desc order', () => {
    const a = { id: 'a', updatedAt: 10 } as never
    const b = { id: 'b', updatedAt: 30 } as never
    const aNewer = { id: 'a', updatedAt: 40 } as never

    const next = upsertDecisionCard([a, b], aNewer)

    expect(next.map((card) => (card as { id: string }).id)).toEqual(['a', 'b'])
    expect(next).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @muon/desktop test -- decisionCards`
Expected: FAIL — `Cannot find module '@/features/chat/queries/decisionCardsApi'`.

- [ ] **Step 3: Create the query-key factory**

Create `apps/desktop/src/features/chat/queries/decisionKeys.ts`:

```ts
export const decisionKeys = {
  all: ['decisions'] as const,
  cards: () => [...decisionKeys.all, 'cards'] as const,
}
```

- [ ] **Step 4: Implement the data layer**

Create `apps/desktop/src/features/chat/queries/decisionCardsApi.ts`:

```ts
import type { CreateDecisionCardInput, DecisionCard, SuggestionDisposition } from '../types/decision'
import type { DigestEntry } from '../types/knowledge'
import { createKnowledgeRepository } from '@features/chat/lib/knowledgeDb'
import { extractSuggestionsFromSummary } from '../services/suggestionExtraction'
import { createDecisionCard } from '../types/decision'
import { decisionCardSchema } from '../types/knowledge'

const repository = createKnowledgeRepository()

function byUpdatedAtDesc(left: DecisionCard, right: DecisionCard) {
  return right.updatedAt - left.updatedAt
}

export function upsertDecisionCard(cards: DecisionCard[], card: DecisionCard): DecisionCard[] {
  return [...cards.filter((item) => item.id !== card.id), card].sort(byUpdatedAtDesc)
}

function mergeSuggestions(
  current: DecisionCard['suggestions'],
  next: DecisionCard['suggestions'],
): DecisionCard['suggestions'] {
  return next.map((suggestion) => {
    const existing = current.find((item) => item.id === suggestion.id)
    if (!existing) return suggestion

    return {
      ...suggestion,
      disposition: existing.disposition,
      updatedAt: existing.updatedAt,
      updatedBy: existing.updatedBy,
    }
  })
}

async function materializeSuggestionsFromDigest(
  entry: DigestEntry,
  existing: DecisionCard | undefined,
): Promise<DecisionCard | null> {
  const suggestions = extractSuggestionsFromSummary(entry)
  if (!suggestions.length) return null

  const baseCard = createDecisionCard({
    id: `decision:digest:${entry.id}`,
    conclusion: entry.title,
    context: entry.summary,
    owner: 'digest',
    status: 'open',
    citations: entry.citations,
    suggestions,
    now: existing?.createdAt ?? entry.createdAt,
  })

  const nextCard = decisionCardSchema.parse({
    ...baseCard,
    ...existing,
    conclusion: entry.title,
    context: entry.summary,
    owner: existing?.owner ?? 'digest',
    status: existing?.status ?? 'open',
    citations: entry.citations,
    citationEventIds: entry.citationEventIds,
    suggestions: mergeSuggestions(existing?.suggestions ?? [], baseCard.suggestions),
    createdAt: existing?.createdAt ?? baseCard.createdAt,
    updatedAt: Math.max(existing?.updatedAt ?? 0, entry.updatedAt, baseCard.updatedAt),
  })

  await repository.saveDecisionCard(nextCard)
  return nextCard
}

export async function loadDecisionCards(): Promise<DecisionCard[]> {
  const savedCards = (await repository.listDecisionCards())
    .map((card) => decisionCardSchema.parse(card))
    .sort(byUpdatedAtDesc)

  const cardsById = new Map(savedCards.map((card) => [card.id, card]))

  const digestEntries = await repository.listDigestEntries()
  // Only materialize suggestions from the most recent session
  const latestSessionId = digestEntries[0]?.sessionId
  const currentSessionEntries = latestSessionId
    ? digestEntries.filter((entry) => entry.sessionId === latestSessionId)
    : []

  const materialized = await Promise.all(
    currentSessionEntries.map((entry) =>
      materializeSuggestionsFromDigest(entry, cardsById.get(`decision:digest:${entry.id}`)),
    ),
  )

  for (const card of materialized) {
    if (card) cardsById.set(card.id, card)
  }

  return [...cardsById.values()].sort(byUpdatedAtDesc)
}

export async function createDecisionCardEntry(input: CreateDecisionCardInput): Promise<DecisionCard> {
  const card = decisionCardSchema.parse(createDecisionCard(input))
  await repository.saveDecisionCard(card)
  return card
}

export async function setSuggestionDispositionEntry(
  current: DecisionCard,
  suggestionId: string,
  disposition: Exclude<SuggestionDisposition, 'pending'>,
  updatedBy = 'local-user',
  updatedAt = Date.now(),
): Promise<DecisionCard> {
  if (disposition !== 'accepted' && disposition !== 'rejected') {
    throw new Error('Invalid suggestion disposition')
  }

  const updated = await repository.updateSuggestionDisposition(
    current.id,
    suggestionId,
    disposition,
    updatedBy,
    updatedAt,
  )

  const updatedSuggestions = (updated as Partial<DecisionCard>).suggestions
    ? current.suggestions.map((suggestion) => {
        const patch = (updated as Partial<DecisionCard>).suggestions?.find((item) => item.id === suggestion.id)
        return patch ? { ...suggestion, ...patch } : suggestion
      })
    : current.suggestions

  return decisionCardSchema.parse({
    ...current,
    ...updated,
    updatedAt: (updated as DecisionCard).updatedAt ?? updatedAt,
    suggestions: updatedSuggestions,
  })
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @muon/desktop test -- decisionCards`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/features/chat/queries/decisionKeys.ts \
        apps/desktop/src/features/chat/queries/decisionCardsApi.ts \
        apps/desktop/tests/unit/queries/decisionCards.test.ts
git commit -m "feat(query): add decision-cards query key factory and data layer"
```

---

## Task 2: Composables (`useDecisionCards.ts`)

**Files:**
- Create: `apps/desktop/src/features/chat/queries/useDecisionCards.ts`

These are thin wrappers over the Task 1 data layer; they are verified end-to-end by the migrated component test in Task 3 (mounting them with a real `QueryClient`). No separate unit test — an isolated composable test would duplicate the component integration test.

- [ ] **Step 1: Implement the composables**

Create `apps/desktop/src/features/chat/queries/useDecisionCards.ts`:

```ts
import type { CreateDecisionCardInput, DecisionCard, SuggestionDisposition } from '../types/decision'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import {
  createDecisionCardEntry,
  loadDecisionCards,
  setSuggestionDispositionEntry,
  upsertDecisionCard,
} from './decisionCardsApi'
import { decisionKeys } from './decisionKeys'

export function useDecisionCardsQuery() {
  const query = useQuery({
    queryKey: decisionKeys.cards(),
    queryFn: loadDecisionCards,
  })
  const cards = computed(() => query.data.value ?? [])
  return { ...query, cards }
}

export function useCreateDecisionCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDecisionCardInput) => createDecisionCardEntry(input),
    onSuccess: (card) => {
      queryClient.setQueryData<DecisionCard[]>(decisionKeys.cards(), (prev) => upsertDecisionCard(prev ?? [], card))
    },
  })
}

export interface SetSuggestionDispositionVariables {
  decisionId: string
  suggestionId: string
  disposition: Exclude<SuggestionDisposition, 'pending'>
  updatedBy?: string
  updatedAt?: number
}

export function useSetSuggestionDisposition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ decisionId, suggestionId, disposition, updatedBy, updatedAt }: SetSuggestionDispositionVariables) => {
      const cards = queryClient.getQueryData<DecisionCard[]>(decisionKeys.cards()) ?? []
      const current = cards.find((card) => card.id === decisionId)
      if (!current) throw new Error(`Decision ${decisionId} not found`)
      return setSuggestionDispositionEntry(current, suggestionId, disposition, updatedBy, updatedAt)
    },
    onSuccess: (card) => {
      queryClient.setQueryData<DecisionCard[]>(decisionKeys.cards(), (prev) => upsertDecisionCard(prev ?? [], card))
    },
  })
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @muon/desktop run type-check`
Expected: PASS (no errors in `useDecisionCards.ts`).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/features/chat/queries/useDecisionCards.ts
git commit -m "feat(query): add decision-cards query and mutation composables"
```

---

## Task 3: Migrate `DecisionPanel.vue` + its test

**Files:**
- Modify: `apps/desktop/src/features/chat/components/DecisionPanel.vue`
- Modify: `apps/desktop/tests/components/DecisionPanel.test.ts`

- [ ] **Step 1: Rewrite the component test (will fail until the component is migrated)**

Replace the top of `apps/desktop/tests/components/DecisionPanel.test.ts` — remove the Pinia + store imports and add a vue-query mount helper. The mocks for `knowledgeDb`, `vue-router`, `vue-sonner`, `@matrix/index` are UNCHANGED. Apply these edits:

1. Replace the imports block:

```ts
import { VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DecisionPanel from '@/features/chat/components/DecisionPanel.vue'
import { decisionKeys } from '@/features/chat/queries/decisionKeys'
import { createTestQueryClient } from '../helpers/queryClient'
```

2. In `beforeEach`, delete the `setActivePinia(createPinia())` line (keep every mock reset).

3. Add this helper just below `beforeEach`:

```ts
function mountPanel() {
  const queryClient = createTestQueryClient()
  const wrapper = mount(DecisionPanel, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient }
}
```

4. Update each test body to use `mountPanel()` and seed via the repository mock instead of the store:

```ts
it('creates a decision card from panel inputs', async () => {
  const { wrapper } = mountPanel()

  await wrapper.get('[data-testid="decision-conclusion-input"]').setValue('Ship digest panel')
  await wrapper.get('[data-testid="decision-context-input"]').setValue('Offline catch-up is missing')
  await wrapper.get('[data-testid="group-member-search"]').setValue('@alice:muon.dev')
  await wrapper.get('[data-testid="group-member-row-@alice:muon.dev"]').trigger('click')
  await wrapper.get('[data-testid="decision-room-input"]').setValue('!room:muon.dev')
  await wrapper.get('[data-testid="decision-event-input"]').setValue('$event-1')
  await wrapper.get('[data-testid="decision-save-button"]').trigger('click')
  await flushPromises()

  expect(saveDecisionCardMock).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('Ship digest panel')
})

it('shows all missing fields before saving a decision card', async () => {
  const { wrapper } = mountPanel()

  await wrapper.get('[data-testid="decision-conclusion-input"]').setValue('确认发布窗口')
  await wrapper.get('[data-testid="decision-save-button"]').trigger('click')

  expect(saveDecisionCardMock).not.toHaveBeenCalled()
  expect(toastErrorMock).toHaveBeenCalledTimes(1)
  expect(toastErrorMock.mock.calls[0]?.[0]).toContain('上下文')
  expect(toastErrorMock.mock.calls[0]?.[0]).toContain('负责人')
  expect(toastErrorMock.mock.calls[0]?.[0]).toContain('房间 ID')
  expect(toastErrorMock.mock.calls[0]?.[0]).toContain('事件 ID')
  expect(toastErrorMock.mock.calls[0]?.[0]).not.toContain('结论')
})

it('accepts a suggestion through the mutation', async () => {
  listDecisionCardsMock.mockResolvedValue([
    {
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      citationEventIds: ['$event-1'],
      suggestions: [
        {
          id: 'suggestion-1',
          kind: 'action',
          summary: 'Create panel',
          disposition: 'pending',
          citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
          citationEventIds: ['$event-1'],
        },
      ],
      createdAt: 100,
      updatedAt: 100,
    },
  ])

  const { wrapper } = mountPanel()
  await flushPromises()
  await wrapper.get('[data-testid="decision-accept-suggestion-1"]').trigger('click')

  expect(updateSuggestionDispositionMock).toHaveBeenCalledWith(
    'decision-1',
    'suggestion-1',
    'accepted',
    'local-user',
    expect.any(Number),
  )
})

it('rejects a suggestion through the mutation', async () => {
  listDecisionCardsMock.mockResolvedValue([
    {
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      citationEventIds: ['$event-1'],
      suggestions: [
        {
          id: 'suggestion-1',
          kind: 'blocker',
          summary: 'Need audit trail',
          disposition: 'pending',
          citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
          citationEventIds: ['$event-1'],
        },
      ],
      createdAt: 100,
      updatedAt: 100,
    },
  ])

  const { wrapper } = mountPanel()
  await flushPromises()
  await wrapper.get('[data-testid="decision-reject-suggestion-1"]').trigger('click')

  expect(updateSuggestionDispositionMock).toHaveBeenCalledWith(
    'decision-1',
    'suggestion-1',
    'rejected',
    'local-user',
    expect.any(Number),
  )
})
```

5. For `localizes decision status and digest suggestion metadata` and `hydrates saved decisions, renders linked messages, and jumps with preload plus focusEventId`: keep their `listDecisionCardsMock.mockResolvedValue([...])` / `loadInboxEventContextMock.mockResolvedValue({})` setup verbatim, but change `const wrapper = mount(DecisionPanel)` to `const { wrapper } = mountPanel()`. The rest is unchanged.

6. For `digest-backed suggestions are visible only from latest-session digest entries`: keep the digest seed, change to `const { wrapper, queryClient } = mountPanel()`, and replace the store-based assertion tail with a cache read:

```ts
  const { wrapper, queryClient } = mountPanel()
  await flushPromises()

  expect(wrapper.text()).toContain('Schedule the release call')
  expect(wrapper.text()).not.toContain('Review the design doc')

  const cards = queryClient.getQueryData<{ owner: string; id: string }[]>(decisionKeys.cards()) ?? []
  const digestCards = cards.filter((card) => card.owner === 'digest')
  expect(digestCards).toHaveLength(1)
  expect(digestCards[0]?.id).toBe('decision:digest:digest-latest-1')
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @muon/desktop test -- DecisionPanel`
Expected: FAIL — component still imports `useDecisionStore` / `decisionStore.cards` is undefined against the new mount.

- [ ] **Step 3: Migrate the component**

In `apps/desktop/src/features/chat/components/DecisionPanel.vue`:

Replace the `<script setup>` imports + store wiring. Change the import line:

```ts
import { reactive, ref, watch } from 'vue';
```

(drop `onMounted`), and replace:

```ts
import { useDecisionStore } from '../stores/decisionStore';
```

with:

```ts
import {
  useCreateDecisionCard,
  useDecisionCardsQuery,
  useSetSuggestionDisposition,
} from '../queries/useDecisionCards';
```

Replace:

```ts
const decisionStore = useDecisionStore();
```

with:

```ts
const { cards } = useDecisionCardsQuery();
const createCard = useCreateDecisionCard();
const setDisposition = useSetSuggestionDisposition();
```

Delete the `onMounted(async () => { await decisionStore.hydrateCards(); });` block entirely (the query auto-fetches on mount).

Replace the `saveDecisionCard` body's store call:

```ts
  await createCard.mutateAsync({
    id: `decision:${Date.now()}`,
    conclusion: form.conclusion.trim(),
    context: form.context.trim(),
    owner: form.owner.trim(),
    status: form.status,
    citations: [{ roomId: form.roomId.trim(), eventId: form.eventId.trim() }],
  });
```

Replace `acceptSuggestion` / `rejectSuggestion` store calls:

```ts
async function acceptSuggestion(decisionId: string, suggestionId: string) {
  try {
    await setDisposition.mutateAsync({ decisionId, suggestionId, disposition: 'accepted' });
  } catch {
    toast.error(t('auth.error'));
  }
}

async function rejectSuggestion(decisionId: string, suggestionId: string) {
  try {
    await setDisposition.mutateAsync({ decisionId, suggestionId, disposition: 'rejected' });
  } catch {
    toast.error(t('auth.error'));
  }
}
```

In the template, change the card loop from `v-for="card in decisionStore.cards"` to `v-for="card in cards"`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @muon/desktop test -- DecisionPanel`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/features/chat/components/DecisionPanel.vue \
        apps/desktop/tests/components/DecisionPanel.test.ts
git commit -m "refactor(chat): consume decision-cards vue-query composables in DecisionPanel"
```

---

## Task 4: Remove the Pinia store + full verification

**Files:**
- Delete: `apps/desktop/src/features/chat/stores/decisionStore.ts`
- Delete: `apps/desktop/tests/unit/stores/decisionStore.test.ts`

- [ ] **Step 1: Confirm there are no remaining consumers**

Run: `grep -rn 'useDecisionStore\|stores/decisionStore' apps/desktop/src apps/desktop/tests`
Expected: NO matches (every consumer migrated).

- [ ] **Step 2: Delete the store and its old test**

```bash
git rm apps/desktop/src/features/chat/stores/decisionStore.ts \
       apps/desktop/tests/unit/stores/decisionStore.test.ts
```

- [ ] **Step 3: Run the full desktop check sequence**

Run, in order:
- `pnpm --filter @muon/desktop test`  → all unit/component tests pass (decisionStore suite gone, decisionCards + DecisionPanel green).
- `pnpm --filter @muon/desktop run type-check`  → clean.
- `pnpm --filter @muon/desktop run build`  → succeeds.
- `pnpm run lint`  → clean.

Expected: every command exits 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(chat): remove Pinia decisionStore in favor of vue-query"
```

---

## Self-Review Notes

- **Spec coverage:** decisionStore had `cards` (→ `useDecisionCardsQuery().cards`), `hydrateCards` (→ `loadDecisionCards` queryFn, auto-fetch on mount), `createDecisionCard` (→ `useCreateDecisionCard`), `setSuggestionDisposition` (→ `useSetSuggestionDisposition`), `materializeSuggestionsFromDigest` (→ private in `decisionCardsApi`). All 7 original store tests are ported to the data layer; both component tests preserved. The `*Effect` variants of the store were internal and have no external consumers (`grep` confirms only `DecisionPanel.vue` consumed the store) — dropped per the design's effect-unwinding rule.
- **Cache-update choice:** mutations use `setQueryData` + `upsertDecisionCard` rather than `invalidateQueries`, because invalidation would re-run the expensive digest materialization + repository writes on every accept/reject and cause list flicker. This mirrors the old in-memory `upsertCard` exactly.
- **`current` lookup:** `setSuggestionDispositionEntry` takes the current card explicitly (pure/testable); the composable reads it from the query cache (`getQueryData`) and throws "Decision … not found" when absent — same error contract as the old store.
- **Reactivity rule:** `cards` is a `computed` over the `useQuery` `data` ref, so the template render path stays reactive (consistent with the P1 `useSelector` rule).
