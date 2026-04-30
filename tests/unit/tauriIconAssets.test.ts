import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('tauri icon assets', () => {
  it('uses a padded platform icon source instead of the full-bleed UI logo', () => {
    const source = readSource('src-tauri/icons/muon-icon.svg')
    const readme = readSource('README.md')

    expect(source).toContain('id="tauri-icon-safe-area"')
    expect(source).toContain('scale(0.928571)')
    expect(readme).toContain('pnpm tauri icon src-tauri/icons/muon-icon.svg --output src-tauri/icons')
  })
})
