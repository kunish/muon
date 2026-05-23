import { describe, expect, it } from 'vitest'
import { readDesktopJson, readDesktopSource, readRepoJson } from '../helpers/paths'

describe('vite config', () => {
  it('prebundles lazy route dependencies that otherwise invalidate optimized deps after login', () => {
    const source = readDesktopSource('vite.config.ts')
    const optimizeDepsInclude = source.match(/optimizeDeps:\s*\{[\s\S]*?include:\s*\[([\s\S]*?)\]/)?.[1] ?? ''

    expect(optimizeDepsInclude).toContain('date-fns')
    expect(optimizeDepsInclude).toContain('date-fns/locale')
  })

  it('keeps shared UI aliases on package entry points instead of direct Vue files', () => {
    const tsconfig = readDesktopJson('tsconfig.json') as {
      compilerOptions?: { paths?: Record<string, string[]> }
    }
    const vitestConfig = readDesktopSource('vitest.config.ts')
    const packageJson = readRepoJson('packages/ui/package.json') as {
      exports?: Record<string, string>
    }

    expect(Object.keys(tsconfig.compilerOptions?.paths ?? {}).some((alias) => alias.startsWith('@muon/ui'))).toBe(false)
    expect(tsconfig.compilerOptions?.paths).not.toHaveProperty('@muon/ui/avatar/Avatar.vue')
    expect(tsconfig.compilerOptions?.paths).not.toHaveProperty('@muon/ui/*')
    expect(vitestConfig).not.toContain('@muon/ui/avatar/Avatar.vue')
    expect(vitestConfig).not.toContain('packages/ui/src/components/ui')
    expect(Object.keys(packageJson.exports ?? {})).not.toContain('./avatar/Avatar.vue')
  })
})
