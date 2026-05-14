import { describe, expect, it } from 'vitest'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'

async function setupInstalled() {
  const repository = createInMemoryEnterpriseRepository()
  const install = await createInstallService({ repository }).install({
    organizationName: 'Acme',
    organizationSlug: 'acme',
    ownerUsername: 'owner',
    ownerEmail: 'owner@acme.test',
    ownerDisplayName: 'Owner',
    ownerPassword: 'correct horse battery staple',
  })
  return { repository, install }
}

describe('findUserById', () => {
  it('returns the user when org + id match', async () => {
    const { repository, install } = await setupInstalled()
    const found = await repository.findUserById(install.organization.id, install.owner.id)
    expect(found?.username).toBe('owner')
  })

  it('returns null when the id does not exist in the org', async () => {
    const { repository, install } = await setupInstalled()
    const found = await repository.findUserById(install.organization.id, 'no-such-id')
    expect(found).toBeNull()
  })

  it('returns null when the org does not match', async () => {
    const { repository, install } = await setupInstalled()
    const found = await repository.findUserById('other-org', install.owner.id)
    expect(found).toBeNull()
  })
})

describe('admin session create + lookup', () => {
  it('stores a new session and lets it be found by access-token hash', async () => {
    const { repository, install } = await setupInstalled()

    const created = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'access-hash-1',
      refreshTokenHash: 'refresh-hash-1',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    expect(created.id).toBeTruthy()
    expect(created.revokedAt).toBeNull()
    expect(created.createdAt).toBeTruthy()
    expect(created.lastSeenAt).toBeTruthy()

    const found = await repository.findAdminSessionByTokenHash('access-hash-1')
    expect(found?.id).toBe(created.id)
    expect(found?.userId).toBe(install.owner.id)
  })

  it('returns null for an unknown access-token hash', async () => {
    const { repository } = await setupInstalled()
    const found = await repository.findAdminSessionByTokenHash('no-such-hash')
    expect(found).toBeNull()
  })
})
