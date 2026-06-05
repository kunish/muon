import { QueryClient } from '@tanstack/vue-query'

/**
 * Per-test QueryClient. Retries are off so a failing queryFn surfaces
 * immediately instead of being retried, and gcTime is 0 so no cache leaks
 * across tests. Each call returns a fresh, isolated client — never share one
 * between tests. P2+ query tests mount components with this client.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}
