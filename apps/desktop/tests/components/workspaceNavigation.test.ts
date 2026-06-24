import { describe, expect, it } from 'vitest'
import { resolvePinnedApps } from '@/app/components/workspace/navigation'

describe('resolvePinnedApps', () => {
  it('returns apps in primaryWorkspaceApps order regardless of input id order', () => {
    const apps = resolvePinnedApps(['docs', 'messages'])
    expect(apps.map((a) => a.id)).toEqual(['messages', 'docs'])
  })

  it('filters out unknown ids and never includes settings', () => {
    const apps = resolvePinnedApps(['messages', 'bogus', 'settings'])
    expect(apps.map((a) => a.id)).toEqual(['messages'])
  })

  it('returns an empty array for empty input', () => {
    expect(resolvePinnedApps([])).toEqual([])
  })
})
