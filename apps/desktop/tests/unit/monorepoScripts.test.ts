import { describe, expect, it } from 'vitest'
import { readRepoJson, readRepoSource } from '../helpers/paths'

interface PackageManifest {
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
}

describe('monorepo scripts', () => {
  it('runs every code project from the root dev command', () => {
    const root = readRepoJson<PackageManifest>('package.json')
    const devAll = readRepoSource('scripts/dev-all.sh')

    expect(root.scripts?.dev).toBe('bash scripts/dev-all.sh')
    expect(devAll).toContain('pnpm services:up')
    expect(devAll).toContain('pnpm --filter @muon/api exec tsx src/server.ts')
    expect(devAll).toContain('pnpm --filter @muon/admin exec vite --host 0.0.0.0 --port 4174')
    expect(devAll).toContain('pnpm --filter @muon/desktop dev')
    expect(devAll).toContain('exited with status')
    expect(devAll).not.toContain('pnpm exec electron-vite dev')
    expect(devAll).not.toContain('start "enterprise API" pnpm dev:api')
    expect(devAll).not.toContain('start "Admin Web" pnpm dev:admin')
    expect(devAll).not.toContain('start "Electron desktop" pnpm dev:desktop')
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
