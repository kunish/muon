import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAdminRouter, normalizeLegacyAdminHash } from '../../../admin/src/router'
import { readRepoJson, readRepoSource } from '../helpers/paths'

describe('admin router', () => {
  it('defines standalone admin section routes with vue-router', async () => {
    const router = createAdminRouter(createMemoryHistory())

    await router.push('/users')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('admin-users')
    expect(router.currentRoute.value.meta.adminSection).toBe('users')

    const routePaths = router.getRoutes().map((route) => route.path)
    expect(routePaths).toEqual(expect.arrayContaining(['/', '/organizations', '/users', '/audit']))
  })

  it('normalizes legacy admin hashes before the router mounts', () => {
    window.history.replaceState(null, '', '/admin#users')

    normalizeLegacyAdminHash()

    expect(window.location.pathname).toBe('/admin')
    expect(window.location.hash).toBe('#/users')
  })

  it('leaves unknown legacy admin hashes unchanged', () => {
    window.history.replaceState(null, '', '/admin#settings')

    normalizeLegacyAdminHash()

    expect(window.location.hash).toBe('#settings')
  })

  it('mounts the admin app with the router plugin', () => {
    const main = readRepoSource('apps/admin/src/main.ts')
    const manifest = readRepoJson('apps/admin/package.json') as {
      dependencies?: Record<string, string>
    }

    expect(main).toContain('createAdminRouter')
    expect(main).toContain('app.use(router)')
    expect(manifest.dependencies?.['vue-router']).toBeDefined()
  })
})
