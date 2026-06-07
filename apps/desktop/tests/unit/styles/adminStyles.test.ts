import { describe, expect, it } from 'vitest'
import { readRepoSource } from '../../helpers/paths'

describe('admin styles', () => {
  it('scans shared UI components for Tailwind utilities', () => {
    const main = readRepoSource('apps/admin/src/main.ts')
    const css = readRepoSource('apps/admin/src/main.css')

    expect(main).toContain("import './main.css'")
    expect(css).toContain("@import '@muon/ui/styles.css'")
    expect(css).toContain("@source '../../../packages/ui/src'")
  })

  it('keeps the admin content pane scrollable', () => {
    const shell = readRepoSource('apps/admin/src/layouts/AppShell.vue')

    expect(shell).toMatch(/\.admin-shell\s*\{[^}]*height:\s*100vh/)
    expect(shell).toMatch(/\.admin-shell\s*\{[^}]*overflow:\s*hidden/)
    expect(shell).toMatch(/\.admin-sidebar\s*\{[^}]*min-height:\s*0/)
    expect(shell).toMatch(/\.admin-sidebar\s*\{[^}]*overflow-y:\s*auto/)
  })
})
