import { QueryClient } from '@tanstack/vue-query'

/**
 * Single source of truth for the renderer QueryClient configuration.
 *
 * The plugin layer and any code that needs an app-configured client both call
 * this factory, so query/mutation defaults never drift. Defaults are
 * deliberately conservative: short staleness, one retry, no refetch-on-focus
 * (the desktop app is long-lived and focus churn would over-fetch).
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 300_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
