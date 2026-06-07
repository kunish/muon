import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { Effect } from 'effect'
import { createApp } from 'vue'
import { getAdminMe, getInstallStatus } from './api'
import App from './App.vue'
import { fromPromise, fromSync, runAdminEffect } from './effect'
import { isAuthenticationError } from './lib/authError'
import { createAdminRouter, normalizeLegacyAdminHash } from './router'
import { clearToken, sessionStore, setInstalled, setMustChangePassword } from './stores/sessionStore'
import './main.css'

function createAdminQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 30_000,
      },
    },
  })
}

/**
 * Hydrate sessionStore before the router becomes ready so the guards see the
 * correct installed / loggedIn / mustChangePassword state on first navigation.
 */
function hydrateSessionEffect() {
  return Effect.gen(function* () {
    const status = yield* fromPromise(() => getInstallStatus()).pipe(
      Effect.catchAll(() => Effect.succeed({ installed: false })),
    )
    yield* fromSync(() => setInstalled(status.installed))

    const token = sessionStore.state.adminToken
    if (!token) return
    yield* fromPromise(() => getAdminMe(token)).pipe(
      Effect.flatMap((result) => fromSync(() => setMustChangePassword(result.user.mustChangePassword))),
      Effect.catchAll((error) =>
        fromSync(() => {
          if (isAuthenticationError(error)) clearToken()
        }),
      ),
    )
  })
}

function bootstrapEffect() {
  return Effect.gen(function* () {
    yield* hydrateSessionEffect()
    yield* fromSync(() => normalizeLegacyAdminHash())

    const router = yield* fromSync(() => createAdminRouter())
    const queryClient = yield* fromSync(() => createAdminQueryClient())
    const app = yield* fromSync(() => createApp(App))
    yield* fromSync(() => app.use(router))
    yield* fromSync(() => app.use(VueQueryPlugin, { queryClient }))
    yield* fromPromise(() => router.isReady())
    yield* fromSync(() => app.mount('#app'))
  })
}

void runAdminEffect(bootstrapEffect())
