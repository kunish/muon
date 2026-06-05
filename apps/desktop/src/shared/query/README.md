# Query conventions

Server state (anything sourced from Dexie/IndexedDB, matrix-js-sdk, or IPC)
lives in `@tanstack/vue-query`, not in a store.

## QueryClient

`createAppQueryClient()` in `queryClient.ts` is the only place query/mutation
defaults are configured. The plugin layer calls it once at startup and passes
the result to `VueQueryPlugin` (one client per app instance); tests use
`createTestQueryClient()` from `tests/helpers/queryClient.ts`.

## Query keys: one factory per feature

Never inline a string key. Each feature owns a `const` key factory colocated
with the feature (e.g. `features/chat/queries/chatKeys.ts`):

```ts
export const chatKeys = {
  all: ['chat'] as const,
  pinned: (roomId: string) => [...chatKeys.all, 'pinned', roomId] as const,
  muted: (roomId: string) => [...chatKeys.all, 'muted', roomId] as const,
}
```

Reads use `useQuery({ queryKey: chatKeys.pinned(roomId), queryFn })`. Writes use
`useMutation` and then `invalidateQueries({ queryKey: chatKeys.pinned(roomId) })`
(or `setQueryData` where an optimistic update already existed).

## Unwinding `effect` pipelines

Stores that wrapped async work in `effect` / `runDesktopSync` must expose a
plain `async` `queryFn`/`mutationFn`. Run the Effect to a Promise at the
boundary and let errors reject — do not swallow them. Retry/error behavior that
the Effect provided is reproduced via QueryClient `retry`/`onError`, not via a
catch-all.

## Cache as the source of truth (mutations: `setQueryData`, not invalidate)

For local Dexie/IndexedDB-backed lists, mutations update the cache directly with
`setQueryData` (upsert the returned row) rather than `invalidateQueries`. Two
reasons: invalidation re-runs the whole `queryFn` (often an expensive hydrate —
e.g. digest materialization + re-persist) on every write and causes list
flicker; and in this single-renderer desktop app every write already flows
through the cache, so the cache is authoritative. This preserves the instant
list update the old Pinia stores got from in-place mutation.

Because of that, the app default `staleTime` (60s) is intentional, not
accidental: an unmount/remount within the window renders from cache without
re-hitting Dexie, which is correct since no external process writes the same
table. A mutation that needs the current row reads it from the cache via
`getQueryData(<key>)` and throws if absent — same "not found" contract the
stores had.

`features/chat/queries/{decisionKeys,decisionCardsApi,useDecisionCards}.ts` is
the reference three-layer split: opaque key factory → Vue-free async data layer
(IO + merge logic, unit-tested directly) → composables (cache wiring only).

## Mixed stores: server → query, client selection → vue-store (store the id, derive the object)

When a Pinia store mixed server data (a list) with a client "current/selected
item", split it: the list goes to vue-query; the selection goes to a
`@tanstack/vue-store` holding only the **id** (`selectedXId: string | null`),
never the object. The component derives the active object from the query:
`(selectedId ? list.find(id) : null) ?? list[0] ?? null`. This keeps a single
source of truth (the object always comes from the cache) and lets the selection
survive the component unmounting (the vue-store is a module singleton, like the
old Pinia singleton).

Note the derivation falls back to a default (`list[0]`) when the selected id is
absent, rather than keeping a stale prior object. That differs slightly from a
store that kept the last selection on a not-found set — fine when every caller
passes an id that exists in the list (the only safe source of ids anyway).

`features/chat/{queries/{qaKeys,qaApi,useQaHistory},stores/qaStore}.ts` is the
reference for this mixed split.
