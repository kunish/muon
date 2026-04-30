import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('electron icon assets', () => {
  it('uses migrated platform icons for Electron packaging', () => {
    const packageJson = readSource('package.json')
    const readme = readSource('README.md')

    expect(readSource('build/icons/icon.icns').length).toBeGreaterThan(0)
    expect(readSource('build/icons/icon.ico').length).toBeGreaterThan(0)
    expect(packageJson).toContain('"icon": "build/icons/icon.icns"')
    expect(packageJson).toContain('"icon": "build/icons/icon.ico"')
    expect(readme).toContain('build/icons/')
  })

  it('applies the Muon icon while running the Electron app locally', () => {
    const mainProcess = readSource('electron/main.ts')

    expect(mainProcess).toContain('getRuntimeAppIconPath')
    expect(mainProcess).toContain('icon: appIconPath')
    expect(mainProcess).toContain('app.dock.setIcon(appIconPath)')
    expect(mainProcess).toContain('app.isPackaged')
  })

  it('does not keep the old mobile/store icon sets in the Electron package assets', () => {
    const iconDir = resolve(process.cwd(), 'build/icons/png-set')

    expect(readdirSync(iconDir).sort()).toEqual([
      '128x128.png',
      '128x128@2x.png',
      '32x32.png',
      '64x64.png',
      'icon.png',
    ])
    expect(existsSync(resolve(iconDir, 'android'))).toBe(false)
    expect(existsSync(resolve(iconDir, 'ios'))).toBe(false)
    expect(existsSync(resolve(iconDir, 'StoreLogo.png'))).toBe(false)
  })
})
