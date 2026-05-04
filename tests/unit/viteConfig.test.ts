import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('vite config', () => {
  it('prebundles lazy route dependencies that otherwise invalidate optimized deps after login', () => {
    const source = readSource('vite.config.ts')
    const optimizeDepsInclude = source.match(/optimizeDeps:\s*\{[\s\S]*?include:\s*\[([\s\S]*?)\]/)?.[1] ?? ''

    expect(optimizeDepsInclude).toContain('date-fns')
    expect(optimizeDepsInclude).toContain('date-fns/locale')
  })
})
