import { describe, expect, it } from 'vitest'
import { readDesktopSource, readRepoSource } from '../helpers/paths'

describe('macOS vibrancy shell transparency plumbing', () => {
  it('applies platform-darwin class pre-mount via applyPlatformClass', () => {
    const bootTheme = readDesktopSource('src/app/bootTheme.ts')
    expect(bootTheme).toContain('shouldUseMacChrome')
    expect(bootTheme).toContain('applyPlatformClass')
    expect(bootTheme).toContain('platform-darwin')
  })

  it('calls applyPlatformClass in main.ts before mount', () => {
    const main = readDesktopSource('src/app/main.ts')
    expect(main).toContain('applyPlatformClass')
    // Must be called before app.mount
    const platformClassIdx = main.indexOf('applyPlatformClass()')
    const mountIdx = main.indexOf('app.mount(')
    expect(platformClassIdx).toBeGreaterThan(-1)
    expect(mountIdx).toBeGreaterThan(-1)
    expect(platformClassIdx).toBeLessThan(mountIdx)
  })

  it('gates shell transparency behind .platform-darwin in styles.css', () => {
    const css = readRepoSource('packages/ui/src/styles.css')
    // Must have the unlayered platform-darwin rule that overrides boot-bg
    expect(css).toContain('.platform-darwin body')
    expect(css).toContain('.platform-darwin #app')
  })

  it('marks App.vue shell wrapper with data-app-shell for css targeting', () => {
    const app = readDesktopSource('src/app/App.vue')
    expect(app).toContain('data-app-shell')
  })

  it('marks WorkspaceLayout.vue flex wrapper with data-workspace-shell — main stays opaque', () => {
    const layout = readDesktopSource('src/app/components/workspace/WorkspaceLayout.vue')
    expect(layout).toContain('data-workspace-shell')
    // The <main> element must NOT carry data-workspace-shell or any transparent override
    // Verify <main> still has bg-background
    expect(layout).toMatch(/<main[^>]*bg-background/)
  })
})
