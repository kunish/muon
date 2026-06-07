import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAdminRouter, normalizeLegacyAdminHash } from '@/router'
import { resetSessionStore, setInstalled, setToken } from '@/stores/sessionStore'

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')

function readSrc(path: string): string {
  return readFileSync(resolve(srcDir, path), 'utf8')
}

describe('admin router', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSessionStore()
  })

  afterEach(() => {
    localStorage.clear()
    resetSessionStore()
  })

  it('defines standalone admin section routes with vue-router', async () => {
    // Satisfy the auth guards so navigation lands on the requested section
    // instead of being redirected to install/login.
    setInstalled(true)
    setToken('admin-token')

    const router = createAdminRouter(createMemoryHistory())

    await router.push('/users')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('admin-users')
    expect(router.currentRoute.value.meta.adminSection).toBe('users')

    const routeNames = router.getRoutes().map((route) => route.name)
    expect(routeNames).toEqual(
      expect.arrayContaining(['admin-organizations', 'admin-users', 'admin-audit', 'admin-departments']),
    )
  })

  it('redirects protected sections to install until Muon is installed', async () => {
    const router = createAdminRouter(createMemoryHistory())

    await router.push('/users')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('admin-install')
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
    const main = readSrc('main.ts')
    const manifest = JSON.parse(readSrc('../package.json')) as {
      dependencies?: Record<string, string>
    }

    expect(main).toContain('createAdminRouter')
    expect(main).toContain('app.use(router)')
    expect(manifest.dependencies?.['vue-router']).toBeDefined()
  })
})
