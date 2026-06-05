# P3.1 — qaStore → vue-query (server) + vue-store (client) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Pinia `qaStore` into its server half (`history` → `@tanstack/vue-query`) and its client half (answer selection → `@tanstack/vue-store`), establishing the reference "mixed store split" pattern for the remaining P3 stores.

**Architecture:** `qaStore` mixes server state (`history`, sourced from Dexie via the `crossSessionQa` service) with client state (`activeAnswer`, a UI selection). The split: (1) `history` becomes a vue-query query + an "ask question" mutation that upserts into the cache; (2) the selection becomes a minimal vue-store holding only `selectedAnswerId: string | null` — NOT the full answer object, to avoid a second source of truth. The component derives `activeAnswer` as a `computed` from the query's `history` and the selected id (`selected ?? newest`). Keeping the selection in a vue-store singleton (not a component ref) preserves the old behavior where the selection survived the panel unmounting/remounting across knowledge-panel tab switches.

**Tech Stack:** Vue 3 Composition API, `@tanstack/vue-query@5`, `@tanstack/vue-store@0.11`, Vitest + Vue Test Utils. The `crossSessionQa` service already exposes Promise functions (`listSavedQaSessions()`, `askCrossSessionQuestion(question)`), so no Effect unwinding is needed.

**Reference precedent:** P2 migrated `decisionStore` to pure vue-query (3-layer: `queries/decisionKeys.ts` → `queries/decisionCardsApi.ts` → `queries/useDecisionCards.ts`). Conventions live in `apps/desktop/src/shared/query/README.md` (cache-as-source-of-truth, `setQueryData` over invalidate). The client vue-store follows the P1 native pattern (`new Store<T>(createInitialState())` + plain action functions + `resetXStore()` + `useSelector` in render paths). Reference P1 store: `apps/desktop/src/app/stores/globalUiStore.ts`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| Create `apps/desktop/src/features/chat/queries/qaKeys.ts` | Query-key factory (`qaKeys.all` / `qaKeys.history()`). |
| Create `apps/desktop/src/features/chat/queries/qaApi.ts` | Vue-free async data layer: `loadQaHistory`, `askQuestionEntry`, pure helper `upsertQaAnswer`. |
| Create `apps/desktop/src/features/chat/queries/useQaHistory.ts` | Composables: `useQaHistoryQuery`, `useAskQuestion`. |
| Rewrite `apps/desktop/src/features/chat/stores/qaStore.ts` | Pinia → native vue-store holding only `selectedAnswerId`; `selectQaAnswer`, `resetQaStore`. |
| Modify `apps/desktop/src/features/chat/components/CrossSessionQaPanel.vue` | Consume the query composables + selection store; derive `activeAnswer`. |
| Create `apps/desktop/tests/unit/queries/qaApi.test.ts` | Data-layer tests. |
| Rewrite `apps/desktop/tests/unit/stores/qaStore.test.ts` | Client vue-store tests. |
| Modify `apps/desktop/tests/components/CrossSessionQaPanel.test.ts` | Mount with `VueQueryPlugin` + reset the vue-store; read the cache instead of `useQaStore().history`. |

The old `tests/unit/stores/qaStore.test.ts` Pinia assertions about `history` ordering / newest-as-active move to `qaApi.test.ts` (ordering) and `CrossSessionQaPanel.test.ts` (derived active answer).

---

## Task 1: Query layer (`qaKeys.ts` + `qaApi.ts`)

**Files:**
- Create: `apps/desktop/src/features/chat/queries/qaKeys.ts`
- Create: `apps/desktop/src/features/chat/queries/qaApi.ts`
- Test: `apps/desktop/tests/unit/queries/qaApi.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/unit/queries/qaApi.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const askCrossSessionQuestionMock = vi.fn()
const listSavedQaSessionsMock = vi.fn()

vi.mock('@/features/chat/services/crossSessionQa', () => ({
  askCrossSessionQuestion: (...args: unknown[]) => askCrossSessionQuestionMock(...args),
  listSavedQaSessions: (...args: unknown[]) => listSavedQaSessionsMock(...args),
}))

import { askQuestionEntry, loadQaHistory, upsertQaAnswer } from '@/features/chat/queries/qaApi'

function answer(id: string, createdAt: number) {
  return {
    id,
    question: `Q ${id}`,
    answer: `A ${id}`,
    citations: [{ roomId: '!room:muon.dev', eventId: `$${id}`, quote: `A ${id}` }],
    citationEventIds: [`$${id}`],
    createdAt,
    updatedAt: createdAt,
  }
}

beforeEach(() => {
  askCrossSessionQuestionMock.mockReset()
  listSavedQaSessionsMock.mockReset()
  listSavedQaSessionsMock.mockResolvedValue([])
})

describe('qaApi', () => {
  it('loadQaHistory returns saved sessions sorted newest-first', async () => {
    listSavedQaSessionsMock.mockResolvedValue([answer('qa-1', 100), answer('qa-2', 200)])

    const history = await loadQaHistory()

    expect(listSavedQaSessionsMock).toHaveBeenCalledTimes(1)
    expect(history.map((item) => item.id)).toEqual(['qa-2', 'qa-1'])
  })

  it('loadQaHistory returns an empty list when nothing is saved', async () => {
    const history = await loadQaHistory()
    expect(history).toEqual([])
  })

  it('askQuestionEntry delegates to the service and returns the answer', async () => {
    askCrossSessionQuestionMock.mockResolvedValue(answer('qa-9', 900))

    const result = await askQuestionEntry('What ships this week?')

    expect(askCrossSessionQuestionMock).toHaveBeenCalledWith('What ships this week?')
    expect(result.id).toBe('qa-9')
  })

  it('upsertQaAnswer prepends the new answer, dedupes by id, and keeps newest-first order', () => {
    const existing = [answer('qa-2', 200), answer('qa-1', 100)]

    const added = upsertQaAnswer(existing, answer('qa-3', 300))
    expect(added.map((item) => item.id)).toEqual(['qa-3', 'qa-2', 'qa-1'])

    const replaced = upsertQaAnswer(added, { ...answer('qa-2', 250), answer: 'updated' })
    expect(replaced.map((item) => item.id)).toEqual(['qa-3', 'qa-2', 'qa-1'])
    expect(replaced.find((item) => item.id === 'qa-2')?.answer).toBe('updated')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @muon/desktop test:unit -- qaApi`
Expected: FAIL — `Cannot find module '@/features/chat/queries/qaApi'`.

- [ ] **Step 3: Create the query-key factory**

Create `apps/desktop/src/features/chat/queries/qaKeys.ts`:

```ts
export const qaKeys = {
  all: ['qa'] as const,
  history: () => [...qaKeys.all, 'history'] as const,
}
```

- [ ] **Step 4: Implement the data layer**

Create `apps/desktop/src/features/chat/queries/qaApi.ts`:

```ts
import type { CrossSessionQaAnswer } from '../types/knowledge'
import { askCrossSessionQuestion, listSavedQaSessions } from '../services/crossSessionQa'

function sortByNewest(sessions: CrossSessionQaAnswer[]): CrossSessionQaAnswer[] {
  return [...sessions].sort((left, right) => right.createdAt - left.createdAt)
}

export function upsertQaAnswer(
  history: CrossSessionQaAnswer[],
  answer: CrossSessionQaAnswer,
): CrossSessionQaAnswer[] {
  return sortByNewest([answer, ...history.filter((item) => item.id !== answer.id)])
}

export async function loadQaHistory(): Promise<CrossSessionQaAnswer[]> {
  return sortByNewest(await listSavedQaSessions())
}

export async function askQuestionEntry(question: string): Promise<CrossSessionQaAnswer> {
  return askCrossSessionQuestion(question)
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @muon/desktop test:unit -- qaApi`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/features/chat/queries/qaKeys.ts \
        apps/desktop/src/features/chat/queries/qaApi.ts \
        apps/desktop/tests/unit/queries/qaApi.test.ts
git commit -m "feat(query): add qa-history query key factory and data layer"
```

---

## Task 2: Composables (`useQaHistory.ts`)

**Files:**
- Create: `apps/desktop/src/features/chat/queries/useQaHistory.ts`

Thin wrappers over Task 1; verified end-to-end by Task 3's migrated component test (no separate unit test — it would duplicate the integration test).

- [ ] **Step 1: Implement the composables**

Create `apps/desktop/src/features/chat/queries/useQaHistory.ts`:

```ts
import type { CrossSessionQaAnswer } from '../types/knowledge'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { askQuestionEntry, loadQaHistory, upsertQaAnswer } from './qaApi'
import { qaKeys } from './qaKeys'

export function useQaHistoryQuery() {
  const query = useQuery({
    queryKey: qaKeys.history(),
    queryFn: loadQaHistory,
  })
  const history = computed(() => query.data.value ?? [])
  // Spread the full query so callers can reach isLoading/isError/refetch; `history`
  // is a convenience computed so call sites avoid `data.value ?? []` everywhere.
  return { ...query, history }
}

export function useAskQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: askQuestionEntry,
    onSuccess: (answer) => {
      queryClient.setQueryData<CrossSessionQaAnswer[]>(qaKeys.history(), (prev) => upsertQaAnswer(prev ?? [], answer))
    },
  })
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @muon/desktop run type-check`
Expected: PASS (no errors in `useQaHistory.ts`).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/features/chat/queries/useQaHistory.ts
git commit -m "feat(query): add qa-history query and ask-question mutation composables"
```

---

## Task 3: Client vue-store + component migration + tests

This task swaps `CrossSessionQaPanel` and the `qaStore` over together so the tree stays type-clean (the component is the store's only consumer). Order: rewrite the store, migrate the component, then the two test files, then verify.

**Files:**
- Rewrite: `apps/desktop/src/features/chat/stores/qaStore.ts`
- Modify: `apps/desktop/src/features/chat/components/CrossSessionQaPanel.vue`
- Rewrite: `apps/desktop/tests/unit/stores/qaStore.test.ts`
- Modify: `apps/desktop/tests/components/CrossSessionQaPanel.test.ts`

- [ ] **Step 1: Rewrite the client store**

Replace the entire contents of `apps/desktop/src/features/chat/stores/qaStore.ts`:

```ts
import { Store } from '@tanstack/vue-store'

export interface QaState {
  selectedAnswerId: string | null
}

function createInitialState(): QaState {
  return { selectedAnswerId: null }
}

export const qaStore = new Store<QaState>(createInitialState())

export function selectQaAnswer(answerId: string | null) {
  qaStore.setState((prev) => ({ ...prev, selectedAnswerId: answerId }))
}

export function resetQaStore() {
  qaStore.setState(() => createInitialState())
}
```

- [ ] **Step 2: Rewrite the client store's unit test**

Replace the entire contents of `apps/desktop/tests/unit/stores/qaStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { qaStore, resetQaStore, selectQaAnswer } from '@/features/chat/stores/qaStore'

describe('qaStore (client selection)', () => {
  beforeEach(() => {
    resetQaStore()
  })

  it('starts with no selected answer', () => {
    expect(qaStore.state.selectedAnswerId).toBeNull()
  })

  it('selectQaAnswer records the selected id', () => {
    selectQaAnswer('qa-1')
    expect(qaStore.state.selectedAnswerId).toBe('qa-1')
  })

  it('selectQaAnswer(null) clears the selection', () => {
    selectQaAnswer('qa-1')
    selectQaAnswer(null)
    expect(qaStore.state.selectedAnswerId).toBeNull()
  })

  it('resetQaStore restores the initial state', () => {
    selectQaAnswer('qa-2')
    resetQaStore()
    expect(qaStore.state.selectedAnswerId).toBeNull()
  })
})
```

- [ ] **Step 3: Run the store unit test**

Run: `pnpm --filter @muon/desktop test:unit -- stores/qaStore`
Expected: PASS (4 tests).

- [ ] **Step 4: Migrate the component**

In `apps/desktop/src/features/chat/components/CrossSessionQaPanel.vue`, replace the `<script setup>` block (lines 1–53) with:

```ts
<script setup lang="ts">
import { useSelector } from '@tanstack/vue-store';
import { Textarea } from '@muon/ui/textarea';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { preloadAndNavigate } from '@/shared/lib/contextPreload';
import { useAskQuestion, useQaHistoryQuery } from '../queries/useQaHistory';
import { qaStore, selectQaAnswer } from '../stores/qaStore';

const { t } = useI18n();
const router = useRouter();

const qaHistoryQuery = useQaHistoryQuery();
const askMutation = useAskQuestion();
const selectedAnswerId = useSelector(qaStore, (s) => s.selectedAnswerId);

const question = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const history = computed(() => qaHistoryQuery.history.value);
const answer = computed(() => {
  const id = selectedAnswerId.value;
  const list = history.value;
  return (id ? list.find((item) => item.id === id) : null) ?? list[0] ?? null;
});

// Surface hydrate (query) errors in the same place ask errors render.
watch(qaHistoryQuery.error, (queryError) => {
  if (queryError) error.value = formatQaError(queryError);
});

function formatQaError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message === 'Question is required') return t('chat.knowledge_question_required');
  if (message === 'No cited answer available') return t('chat.knowledge_no_cited_answer');
  return message;
}

async function submitQuestion() {
  loading.value = true;
  error.value = null;
  try {
    const created = await askMutation.mutateAsync(question.value);
    selectQaAnswer(created.id);
  } catch (err) {
    error.value = formatQaError(err);
  } finally {
    loading.value = false;
  }
}

async function openCitation(roomId: string, eventId: string) {
  await preloadAndNavigate(router, roomId, eventId, 'CrossSessionQaPanel');
}

function openHistoryAnswer(answerId: string) {
  selectQaAnswer(answerId);
}
</script>
```

The `<template>` is unchanged — it already binds `question`, `answer`, `history`, `error`, `loading`, `submitQuestion`, `openHistoryAnswer`, `openCitation`.

- [ ] **Step 5: Migrate the component test**

Apply these edits to `apps/desktop/tests/components/CrossSessionQaPanel.test.ts`:

1. Add imports (after the existing `vitest`/`vue` imports, alongside the component imports):

```ts
import { VueQueryPlugin } from '@tanstack/vue-query'
import { qaKeys } from '@/features/chat/queries/qaKeys'
import { resetQaStore } from '@/features/chat/stores/qaStore'
import { createTestQueryClient } from '../helpers/queryClient'
```

Remove the now-unused `import { useQaStore } from '@/features/chat/stores/qaStore'`.

2. In `beforeEach`, keep `setActivePinia(createPinia())` (the last test still uses the Pinia `chatStore`) and add `resetQaStore()` so the selection store is clean between tests.

3. Add a generic mount helper below `beforeEach`:

```ts
function mountWithQuery(component: typeof CrossSessionQaPanel | typeof KnowledgeCapturePanel) {
  const queryClient = createTestQueryClient()
  const wrapper = mount(component, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient }
}
```

4. Replace each `mount(CrossSessionQaPanel)` with `mountWithQuery(CrossSessionQaPanel).wrapper` — EXCEPT the "asks a question" test, which needs the client (see below). For the "hydrates the latest saved answer on mount" test:

```ts
const { wrapper } = mountWithQuery(CrossSessionQaPanel)

await vi.waitFor(() => {
  expect(wrapper.text()).toContain('Latest answer')
})
```

5. The "asks a question and renders the cited answer" test — read the cache instead of the Pinia store:

```ts
const { wrapper, queryClient } = mountWithQuery(CrossSessionQaPanel)
await wrapper.get('[data-testid="qa-question-input"]').setValue('What should ship this week?')
await wrapper.get('[data-testid="qa-submit-button"]').trigger('click')
await flushPromises()

expect(askCrossSessionQuestionMock).toHaveBeenCalledWith('What should ship this week?')
expect(wrapper.text()).toContain('Digest panel should ship this week.')
expect(wrapper.text()).toContain('Earlier question')

const history = queryClient.getQueryData<{ id: string }[]>(qaKeys.history()) ?? []
expect(history.map((item) => item.id)).toEqual(['qa-2', 'qa-1'])
```

Add `flushPromises` to the `@vue/test-utils` import if not already present.

6. The "supports citation click with preload fallback navigation" and "shows a localized empty answer error" tests: replace `mount(CrossSessionQaPanel)` with `mountWithQuery(CrossSessionQaPanel).wrapper`. Their bodies are otherwise unchanged (after the submit, add `await flushPromises()` before interacting with the rendered citation in the citation test, so the mutation settles and the answer renders).

7. The "integrates knowledge tabs and chat side-panel toggle" test: the `KnowledgeCapturePanel` mount renders the real `CrossSessionQaPanel`, so it needs the plugin — change `mount(KnowledgeCapturePanel)` to `mountWithQuery(KnowledgeCapturePanel).wrapper`. The `shallowMount(ChatWindow, …)` stays unchanged (it stubs the panel, so no QueryClient is needed). The `chatStore` (Pinia) assertions are unchanged.

- [ ] **Step 6: Run the component test**

Run: `pnpm --filter @muon/desktop test:unit -- CrossSessionQaPanel`
Expected: PASS (5 tests).

- [ ] **Step 7: Full verification**

Run, in order, and confirm each exits 0:
- `pnpm --filter @muon/desktop test` (unit + e2e; unit must be fully green)
- `pnpm --filter @muon/desktop run type-check`
- `pnpm --filter @muon/desktop run build`
- `pnpm run lint`

- [ ] **Step 8: Confirm no Pinia residue for qa + commit**

Run: `grep -rn 'useQaStore\|defineStore' apps/desktop/src/features/chat/stores/qaStore.ts`
Expected: NO matches (the store is now a vue-store; `useQaStore` is gone). Also run `grep -rn 'useQaStore' apps/desktop/src apps/desktop/tests` — expected NO matches.

```bash
git add apps/desktop/src/features/chat/stores/qaStore.ts \
        apps/desktop/src/features/chat/components/CrossSessionQaPanel.vue \
        apps/desktop/tests/unit/stores/qaStore.test.ts \
        apps/desktop/tests/components/CrossSessionQaPanel.test.ts
git commit -m "refactor(chat): split qaStore into vue-query history + vue-store selection"
```

---

## Self-Review Notes

- **Spec coverage:** old `qaStore` surface — `history` (→ `useQaHistoryQuery().history`), `hydrateHistory` (→ query auto-fetch / `loadQaHistory`), `askQuestion` (→ `useAskQuestion` mutation + `askQuestionEntry`), `activeAnswer` (→ derived `computed` from history + `selectedAnswerId`), `selectAnswer` (→ `selectQaAnswer`), `setHistory`/`upsertAnswer` (→ `loadQaHistory` sort + `upsertQaAnswer` cache update). All covered.
- **No dual source of truth:** the client store holds only `selectedAnswerId`, never the answer object. `activeAnswer` is always derived from the query cache. This is the canonical pattern P3's other mixed stores (currentProjectId, selectedContactId, …) will copy.
- **Behavior preservation:** the selection lives in a vue-store singleton (not a component ref) so it survives the panel unmounting on knowledge-tab switches, matching the old Pinia singleton. The `selected ?? newest` derivation reproduces both `setHistory` (newest active on hydrate) and `upsertAnswer` (new answer active after asking, via `selectQaAnswer(created.id)`).
- **Failures stay visible:** ask errors flow through `submitQuestion`'s try/catch to `error`; hydrate/query errors are surfaced into the same `error` via a `watch` on `qaHistoryQuery.error` (the old `onMounted` try/catch did this). No swallowed errors.
- **Pinia/TanStack coexistence:** `CrossSessionQaPanel.test.ts` keeps `setActivePinia` because its last case exercises the still-Pinia `chatStore`; it installs `VueQueryPlugin` per mount for the migrated panel. This is the expected P1–P3 coexistence.
- **Cache-update choice:** the ask mutation uses `setQueryData` + `upsertQaAnswer` (not invalidate), consistent with the P2 README convention — no refetch, instant list update.
