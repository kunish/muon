import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readRepoJson, readRepoSource, repoRoot } from '../helpers/paths'

interface PackageManifest {
  dependencies?: Record<string, string>
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function normalizeYamlKey(key: string): string {
  if (key.startsWith('"')) return JSON.parse(key) as string
  if (key.startsWith("'")) return key.slice(1, -1).replace(/''/g, "'")
  return key
}

function readDefaultCatalogPackageNames(workspaceConfig: string): Set<string> {
  const names = new Set<string>()
  const lines = workspaceConfig.split('\n')
  const catalogIndex = lines.findIndex((line) => line === 'catalog:')

  if (catalogIndex === -1) return names

  for (const line of lines.slice(catalogIndex + 1)) {
    if (line.length > 0 && !line.startsWith('  ')) break
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) continue

    names.add(normalizeYamlKey(line.slice(2, separatorIndex)))
  }

  return names
}

describe('monorepo scripts', () => {
  it('runs every code project from the root dev command', () => {
    const root = readRepoJson<PackageManifest>('package.json')

    expect(root.scripts?.dev).toBe(
      'pnpm services:up && pnpm --parallel --filter @muon/api --filter @muon/admin --filter @muon/desktop dev',
    )
    expect(existsSync(resolve(repoRoot, 'scripts/dev-all.sh'))).toBe(false)
  })

  it('keeps external dependency versions in the default pnpm catalog', () => {
    const manifestPaths = [
      'package.json',
      'apps/api/package.json',
      'apps/admin/package.json',
      'apps/desktop/package.json',
      'packages/enterprise-contracts/package.json',
      'packages/rich-text/package.json',
      'packages/ui/package.json',
    ]
    const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const
    const catalogPackageNames = readDefaultCatalogPackageNames(readRepoSource('pnpm-workspace.yaml'))
    const nonCatalogSpecs: string[] = []
    const missingCatalogEntries: string[] = []

    for (const manifestPath of manifestPaths) {
      const manifest = readRepoJson<PackageManifest>(manifestPath)

      for (const field of dependencyFields) {
        const dependencies = manifest[field] ?? {}

        for (const [name, specifier] of Object.entries(dependencies)) {
          if (specifier.startsWith('workspace:')) continue
          if (specifier !== 'catalog:') {
            nonCatalogSpecs.push(`${manifestPath}:${field}:${name}@${specifier}`)
            continue
          }
          if (!catalogPackageNames.has(name)) {
            missingCatalogEntries.push(`${manifestPath}:${field}:${name}`)
          }
        }
      }
    }

    expect(nonCatalogSpecs).toEqual([])
    expect(missingCatalogEntries).toEqual([])
  })

  it('builds every buildable workspace from the root build command', () => {
    const root = readRepoJson<PackageManifest>('package.json')
    const api = readRepoJson<PackageManifest>('apps/api/package.json')
    const admin = readRepoJson<PackageManifest>('apps/admin/package.json')
    const contracts = readRepoJson<PackageManifest>('packages/enterprise-contracts/package.json')
    const richText = readRepoJson<PackageManifest>('packages/rich-text/package.json')

    expect(root.scripts?.build).toContain('pnpm build:contracts')
    expect(root.scripts?.build).toContain('pnpm build:rich-text')
    expect(root.scripts?.build).toContain('pnpm build:api')
    expect(root.scripts?.build).toContain('pnpm build:admin')
    expect(root.scripts?.build).toContain('pnpm build:desktop')
    expect(api.scripts?.build).toBeDefined()
    expect(admin.scripts?.build).toBeDefined()
    expect(contracts.scripts?.build).toBeDefined()
    expect(richText.scripts?.build).toBeDefined()
  })

  it('keeps local services focused on infrastructure', () => {
    const root = readRepoJson<PackageManifest>('package.json')
    const startScript = readRepoSource('docker/start.sh')

    expect(root.scripts?.['services:seed']).toBe('tsx scripts/seed-conduit.ts')
    expect(root.devDependencies?.tsx).toBeDefined()
    expect(startScript).toContain('compose up -d postgres conduit livekit minio')
    expect(startScript).toContain('pnpm services:seed')
    expect(startScript).not.toContain('npx')
    expect(startScript).not.toContain('compose up -d api')
    expect(startScript).not.toContain('compose up -d admin')
  })
})
