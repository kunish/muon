import { describe, expect, it } from 'vitest'
import router from '@/app/router'

describe('app router', () => {
  it('keeps only the core workspace routes', () => {
    const routePaths = router.getRoutes().map(route => route.path)

    expect(routePaths).toEqual(expect.arrayContaining([
      '/dm',
      '/dm/:roomId',
      '/server/:serverId/channel/:channelId',
      '/contacts',
      '/settings',
    ]))
    expect(routePaths).not.toEqual(expect.arrayContaining([
      '/chat/:roomId?',
      '/calendar',
      '/docs',
      '/approvals',
      '/email',
      '/calls',
    ]))
  })
})
