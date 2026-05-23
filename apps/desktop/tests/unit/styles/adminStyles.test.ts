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
    const app = readRepoSource('apps/admin/src/AdminApp.vue')

    expect(app).toMatch(/\.admin-shell\s*\{[^}]*height:\s*100vh/)
    expect(app).toMatch(/\.admin-shell\s*\{[^}]*overflow:\s*hidden/)
    expect(app).toMatch(/\.admin-content\s*\{[^}]*min-height:\s*0/)
    expect(app).toMatch(/\.admin-content\s*\{[^}]*overflow-y:\s*auto/)
  })
})
