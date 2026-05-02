import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAdminRouter } from '../../apps/admin/src/router'

const root = process.cwd()

function readSource(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('admin router', () => {
  it('defines standalone admin section routes with vue-router', async () => {
    const router = createAdminRouter(createMemoryHistory())

    await router.push('/users')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('admin-users')
    expect(router.currentRoute.value.meta.adminSection).toBe('users')

    const routePaths = router.getRoutes().map(route => route.path)
    expect(routePaths).toEqual(expect.arrayContaining([
      '/',
      '/organizations',
      '/users',
      '/audit',
    ]))
  })

  it('mounts the admin app with the router plugin', () => {
    const main = readSource('apps/admin/src/main.ts')
    const manifest = JSON.parse(readSource('apps/admin/package.json')) as {
      dependencies?: Record<string, string>
    }

    expect(main).toContain('createAdminRouter')
    expect(main).toContain('app.use(router)')
    expect(manifest.dependencies?.['vue-router']).toBeDefined()
  })
})
