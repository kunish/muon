import { describe, expect, it } from 'vitest'
import { createInstallService } from '../../../../api/src/modules/install/installService'
import { createInMemoryEnterpriseRepository } from '../../../../api/src/repository'

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

describe('touchAdminSession + revokeAdminSession', () => {
  it('updates lastSeenAt when touched', async () => {
    const { repository, install } = await setupInstalled()
    const created = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'touch-access',
      refreshTokenHash: 'touch-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    const originalLastSeenAt = created.lastSeenAt
    await new Promise((resolve) => setTimeout(resolve, 5))
    await repository.touchAdminSession(created.id)

    const after = await repository.findAdminSessionByTokenHash('touch-access')
    expect(after?.lastSeenAt).not.toBe(originalLastSeenAt)
  })

  it('sets revokedAt when revoked, and is idempotent', async () => {
    const { repository, install } = await setupInstalled()
    const created = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'revoke-access',
      refreshTokenHash: 'revoke-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    await repository.revokeAdminSession(created.id)
    const afterFirstRevoke = await repository.findAdminSessionByTokenHash('revoke-access')
    expect(afterFirstRevoke?.revokedAt).toBeTruthy()

    await repository.revokeAdminSession(created.id)
    await repository.revokeAdminSession('unknown-id')
    // no throw, no change to other sessions
  })
})

describe('revokeAllAdminSessionsForUserExcept', () => {
  it('revokes all matching sessions except the one to keep', async () => {
    const { repository, install } = await setupInstalled()

    const keep = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'keep-access',
      refreshTokenHash: 'keep-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    const dropA = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'drop-a-access',
      refreshTokenHash: 'drop-a-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    const dropB = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'drop-b-access',
      refreshTokenHash: 'drop-b-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    await repository.revokeAllAdminSessionsForUserExcept(install.organization.id, install.owner.id, keep.id)

    expect((await repository.findAdminSessionByTokenHash('keep-access'))?.revokedAt).toBeNull()
    expect((await repository.findAdminSessionByTokenHash('drop-a-access'))?.revokedAt).toBeTruthy()
    expect((await repository.findAdminSessionByTokenHash('drop-b-access'))?.revokedAt).toBeTruthy()

    void dropA
    void dropB
  })

  it('does not touch other users sessions', async () => {
    const { repository, install } = await setupInstalled()

    const otherUser = await repository.createUser({
      organizationId: install.organization.id,
      username: 'other',
      email: 'other@acme.test',
      displayName: 'Other',
      passwordHash: 'fake-hash',
      status: 'active',
      mustChangePassword: false,
      roles: ['member'],
    })
    const otherSession = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: otherUser.id,
      accessTokenHash: 'other-access',
      refreshTokenHash: 'other-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    const ownerSession = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'owner-keep-access',
      refreshTokenHash: 'owner-keep-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    await repository.revokeAllAdminSessionsForUserExcept(install.organization.id, install.owner.id, ownerSession.id)

    expect((await repository.findAdminSessionByTokenHash('other-access'))?.revokedAt).toBeNull()
    void otherSession
  })

  it('is idempotent — already-revoked sessions keep their original revokedAt', async () => {
    const { repository, install } = await setupInstalled()
    const session = await repository.createAdminSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      accessTokenHash: 'will-stay-revoked-access',
      refreshTokenHash: 'will-stay-revoked-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    await repository.revokeAdminSession(session.id)
    const firstRevokedAt = (await repository.findAdminSessionByTokenHash('will-stay-revoked-access'))?.revokedAt

    await new Promise((resolve) => setTimeout(resolve, 5))
    await repository.revokeAllAdminSessionsForUserExcept(install.organization.id, install.owner.id, 'unrelated-id')

    const afterRevokedAt = (await repository.findAdminSessionByTokenHash('will-stay-revoked-access'))?.revokedAt
    expect(afterRevokedAt).toBe(firstRevokedAt)
  })
})
