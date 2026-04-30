import { describe, expect, it } from 'vitest'
import { getWorkspaceAppForPath, workspaceApps } from '@/app/components/workspace/navigation'

describe('workspace navigation', () => {
  it('lists app-first workspace entries in display order', () => {
    expect(workspaceApps.map(app => app.id)).toEqual([
      'messages',
      'contacts',
      'settings',
    ])
  })

  it('does not expose retired secondary app entries', () => {
    expect(workspaceApps.map(app => app.id)).not.toEqual(
      expect.arrayContaining(['calendar', 'docs', 'approvals', 'email', 'calls']),
    )
  })

  it.each([
    ['/dm', 'messages'],
    ['/dm/!room%3Alocalhost', 'messages'],
    ['/server/!space%3Alocalhost/channel/!room%3Alocalhost', 'messages'],
    ['/contacts', 'contacts'],
    ['/settings', 'settings'],
  ])('maps %s to %s', (path, appId) => {
    expect(getWorkspaceAppForPath(path)?.id).toBe(appId)
  })

  it.each(['/calendar', '/docs', '/approvals', '/email', '/calls'])('falls back retired path %s to messages', (path) => {
    expect(getWorkspaceAppForPath(path)?.id).toBe('messages')
  })
})
