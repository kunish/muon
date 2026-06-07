import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { Effect } from 'effect'
import { createApp } from 'vue'
import AdminApp from './AdminApp.vue'
import { getInstallStatus } from './api'
import { fromPromise, fromSync, runAdminEffect } from './effect'
import { createAdminRouter, normalizeLegacyAdminHash } from './router'
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

function bootstrapEffect() {
  return Effect.gen(function* () {
    const status = yield* fromPromise(() => getInstallStatus()).pipe(
      Effect.catchAll(() => Effect.succeed({ installed: false })),
    )
    yield* fromSync(() => normalizeLegacyAdminHash())

    const router = yield* fromSync(() => createAdminRouter())
    const queryClient = yield* fromSync(() => createAdminQueryClient())
    const app = yield* fromSync(() => createApp(AdminApp, { initialInstalled: status.installed }))
    yield* fromSync(() => app.use(router))
    yield* fromSync(() => app.use(VueQueryPlugin, { queryClient }))
    yield* fromPromise(() => router.isReady())
    yield* fromSync(() => app.mount('#app'))
  })
}

void runAdminEffect(bootstrapEffect())
