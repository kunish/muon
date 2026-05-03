import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readJson(path: string): {
  scripts?: Record<string, string>
} {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'))
}

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('monorepo scripts', () => {
  it('runs every code project from the root dev command', () => {
    const root = readJson('package.json')
    const devAll = readSource('scripts/dev-all.sh')

    expect(root.scripts?.dev).toBe('bash scripts/dev-all.sh')
    expect(devAll).toContain('pnpm services:up')
    expect(devAll).toContain('pnpm --filter @muon/api exec tsx src/server.ts')
    expect(devAll).toContain('pnpm --filter @muon/admin exec vite --host 0.0.0.0 --port 4174')
    expect(devAll).toContain('pnpm exec electron-vite dev')
    expect(devAll).toContain('exited with status')
    expect(devAll).not.toContain('start "enterprise API" pnpm dev:api')
    expect(devAll).not.toContain('start "Admin Web" pnpm dev:admin')
    expect(devAll).not.toContain('start "Electron desktop" pnpm dev:desktop')
  })

  it('builds every buildable workspace from the root build command', () => {
    const root = readJson('package.json')
    const api = readJson('apps/api/package.json')
    const admin = readJson('apps/admin/package.json')
    const contracts = readJson('packages/enterprise-contracts/package.json')
    const richText = readJson('packages/rich-text/package.json')

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
    const startScript = readSource('docker/start.sh')

    expect(startScript).toContain('compose up -d postgres conduit livekit minio')
    expect(startScript).not.toContain('compose up -d api')
    expect(startScript).not.toContain('compose up -d admin')
  })
})
