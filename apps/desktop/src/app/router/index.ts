import type { RouteRecordRaw } from 'vue-router'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import { readMatrixSessionFromStore } from '@/matrix/auth'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'

// File-based routes (`src/pages`) are leaf pages; the app shell (`AppLayout`) and the
// public `/login` screen are composed here. `/login` stays top-level (no shell); every
// other generated route mounts as a child of `/` so it renders inside AppLayout's
// <RouterView>. The intermediate folder routes are component-less and therefore
// transparent, so nested leaves still render in the shell's outlet.

// Re-apply the original `(members|groups)` constraint that the bare `[section]` file
// param drops (returns shallow copies, never mutating the shared generated array).
function withSectionConstraint(records: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  return records.map((record) => {
    const next: RouteRecordRaw = { ...record }
    if (next.name === '/organization/[section]') next.path = ':section(members|groups)'
    if (next.children) next.children = withSectionConstraint(next.children)
    return next
  })
}

const loginRoute = routes.find((route) => route.path === '/login')
const shellRoutes = withSectionConstraint(routes.filter((route) => route.path !== '/login'))

const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...(loginRoute ? [loginRoute] : []),
    {
      path: '/',
      component: () => import('@/app/components/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [{ path: '', redirect: '/dm' }, ...shellRoutes],
    },
  ],
})

function isAuthenticatedEffect(): DesktopEffect<boolean> {
  return Effect.gen(function* () {
    const session = yield* fromPromise(() => readMatrixSessionFromStore())
    return session !== null
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))
}

function isAuthenticated(): Promise<boolean> {
  return runDesktopEffect(isAuthenticatedEffect())
}

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return undefined
  return isAuthenticated().then((authenticated) => (authenticated ? undefined : '/login'))
})

export default router
