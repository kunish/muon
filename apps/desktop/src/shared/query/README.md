# Query conventions

Server state (anything sourced from Dexie/IndexedDB, matrix-js-sdk, or IPC)
lives in `@tanstack/vue-query`, not in a store.

## QueryClient

`createAppQueryClient()` in `queryClient.ts` is the only place query/mutation
defaults are configured. The plugin layer creates the singleton; tests use
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
