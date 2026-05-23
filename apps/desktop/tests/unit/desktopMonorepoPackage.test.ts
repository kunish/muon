import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

interface PackageJson {
  build?: unknown
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  main?: string
  name?: string
  scripts?: Record<string, string>
}

function getRepoRoot(): string {
  const cwd = process.cwd()
  return cwd.endsWith(`${sep}apps${sep}desktop`) ? resolve(cwd, '../..') : cwd
}

const repoRoot = getRepoRoot()
const desktopRoot = resolve(repoRoot, 'apps/desktop')

function readRepoSource(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8')
}

function readDesktopSource(path: string): string {
  return readFileSync(resolve(desktopRoot, path), 'utf8')
}

function readRepoJson<T>(path: string): T {
  return JSON.parse(readRepoSource(path)) as T
}

function readDesktopJson<T>(path: string): T {
  return JSON.parse(readDesktopSource(path)) as T
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return []

  const entries = readdirSync(root).filter(
    (entry) => !['.git', 'coverage', 'dist', 'node_modules', 'out'].includes(entry),
  )
  return entries.flatMap((entry) => {
    const path = join(root, entry)
    if (statSync(path).isDirectory()) return listFiles(path)
    return [path]
  })
}

function findFilesContaining(root: string, needle: string): string[] {
  return listFiles(root)
    .filter((path) => /\.(?:ts|vue)$/.test(path))
    .filter((path) => readFileSync(path, 'utf8').includes(needle))
    .map((path) => path.slice(repoRoot.length + 1))
    .sort()
}

describe('desktop monorepo package migration', () => {
  it('moves the complete desktop app into apps/desktop while keeping root commands stable', () => {
    const rootPackage = readRepoJson<PackageJson>('package.json')
    const desktopPackage = readDesktopJson<PackageJson>('package.json')
    const componentsConfig = readDesktopJson<{ tailwind?: { css?: string } }>('components.json')

    expect(desktopPackage.name).toBe('@muon/desktop')
    expect(desktopPackage.main).toBe('out/main/main.cjs')
    expect(desktopPackage.scripts?.dev).toBe('electron-vite dev')
    expect(desktopPackage.scripts?.build).toBe('pnpm type-check && electron-vite build')
    expect(desktopPackage.scripts?.['build:web']).toBe('vue-tsc --noEmit && vite build')
    expect(desktopPackage.scripts?.package).toBe('pnpm build && electron-builder --dir -c.mac.identity=null')
    expect(desktopPackage.scripts?.dist).toBe('pnpm build && electron-builder')
    expect(desktopPackage.dependencies?.['@muon/ui']).toBe('workspace:*')
    expect(desktopPackage.dependencies?.['@muon/rich-text']).toBe('workspace:*')
    expect(desktopPackage.dependencies?.['@muon/enterprise-contracts']).toBe('workspace:*')

    expect(rootPackage.main).toBeUndefined()
    expect(rootPackage.build).toBeUndefined()
    expect(rootPackage.scripts?.['dev:desktop']).toBe('pnpm --filter @muon/desktop dev')
    expect(rootPackage.scripts?.['build:desktop']).toBe('pnpm --filter @muon/desktop build')
    expect(rootPackage.scripts?.['build:web']).toBe('pnpm --filter @muon/desktop build:web')
    expect(rootPackage.scripts?.package).toBe('pnpm --filter @muon/desktop package')
    expect(rootPackage.scripts?.dist).toBe('pnpm --filter @muon/desktop dist')
    expect(rootPackage.scripts?.['test:unit']).toBe('pnpm --filter @muon/desktop test:unit')
    expect(rootPackage.scripts?.['test:e2e']).toBe('pnpm --filter @muon/desktop test:e2e')
    expect(rootPackage.scripts?.['test:enterprise']).toBe('pnpm --filter @muon/desktop test:enterprise')

    expect(rootPackage.scripts?.dev).toBe(
      'pnpm services:up && pnpm --parallel --filter @muon/api --filter @muon/admin --filter @muon/desktop dev',
    )
    expect(existsSync(resolve(repoRoot, 'scripts/dev-all.sh'))).toBe(false)
    expect(componentsConfig.tailwind?.css).toBe('src/app/main.css')

    expect(existsSync(resolve(desktopRoot, 'src/app/main.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'electron/main.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'electron/preload.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'index.html'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'electron.vite.config.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'vite.config.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'vitest.config.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'playwright.config.ts'))).toBe(true)
  })

  it('uses desktop capability imports in renderer and tests', () => {
    const legacyElectronAlias = '@/' + 'electron/'

    expect(existsSync(resolve(desktopRoot, 'src/desktop/bridge.ts'))).toBe(true)
    expect(existsSync(resolve(desktopRoot, 'src/electron'))).toBe(false)
    expect(findFilesContaining(resolve(desktopRoot, 'src'), '@/desktop/').length).toBeGreaterThan(0)
    expect(findFilesContaining(resolve(desktopRoot, 'tests'), '@/desktop/').length).toBeGreaterThan(0)
    expect(findFilesContaining(resolve(desktopRoot, 'src'), legacyElectronAlias)).toEqual([])
    expect(findFilesContaining(resolve(desktopRoot, 'tests'), legacyElectronAlias)).toEqual([])
  })
})
