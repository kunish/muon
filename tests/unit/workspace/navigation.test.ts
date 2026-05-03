import { describe, expect, it } from 'vitest'
import { getWorkspaceAppForPath, workspaceApps } from '@/app/components/workspace/navigation'

describe('workspace navigation', () => {
  it('lists app-first workspace entries in display order', () => {
    expect(workspaceApps.map(app => app.id)).toEqual([
      'messages',
      'contacts',
      'organization',
      'calendar',
      'docs',
      'workplace',
      'approvals',
      'email',
      'calls',
      'settings',
    ])
  })

  it.each([
    ['/dm', 'messages'],
    ['/dm/!room%3Alocalhost', 'messages'],
    ['/server/!space%3Alocalhost/channel/!room%3Alocalhost', 'messages'],
    ['/contacts', 'contacts'],
    ['/organization', 'organization'],
    ['/organization/members', 'organization'],
    ['/calendar', 'calendar'],
    ['/calendar/team', 'calendar'],
    ['/docs', 'docs'],
    ['/docs/recent', 'docs'],
    ['/workplace', 'workplace'],
    ['/approvals', 'approvals'],
    ['/email', 'email'],
    ['/calls', 'calls'],
    ['/settings', 'settings'],
  ])('maps %s to %s', (path, appId) => {
    expect(getWorkspaceAppForPath(path)?.id).toBe(appId)
  })
})
