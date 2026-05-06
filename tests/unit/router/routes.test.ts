import { describe, expect, it } from 'vitest'
import router from '@/app/router'

describe('app router', () => {
  it('keeps the Stitch-backed workspace routes in the app shell', () => {
    const routePaths = router.getRoutes().map(route => route.path)

    expect(routePaths).toEqual(expect.arrayContaining([
      '/dm',
      '/dm/:roomId',
      '/server/:serverId/channel/:channelId',
      '/contacts',
      '/organization',
      '/calendar',
      '/docs',
      '/workplace',
      '/approvals',
      '/email',
      '/calls',
      '/projects',
      '/projects/:projectId',
      '/projects/:projectId/settings',
      '/settings',
    ]))
    expect(routePaths).not.toEqual(expect.arrayContaining([
      '/chat/:roomId?',
    ]))
  })
})
