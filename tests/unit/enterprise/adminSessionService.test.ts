import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createAdminSessionService } from '../../../apps/api/src/modules/auth/adminSessionService'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'

async function setupOwner() {
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

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

describe('adminSessionService.login persistence', () => {
  it('writes a session whose access_token_hash matches the returned token', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })

    const result = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const found = await repository.findAdminSessionByTokenHash(sha256(result.session.accessToken))
    expect(found).not.toBeNull()
    expect(found?.userId).toBe(result.user.id)
    expect(found?.revokedAt).toBeNull()
  })
})

describe('adminSessionService.validate', () => {
  it('returns the user for a freshly issued token', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const user = await service.validate(session.accessToken)
    expect(user.username).toBe('owner')
  })

  it('throws AdminAuthenticationError for an unknown token', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    await expect(service.validate('not-a-real-token')).rejects.toMatchObject({
      name: 'AdminAuthenticationError',
    })
  })

  it('throws when the session has been revoked', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const stored = await repository.findAdminSessionByTokenHash(sha256(session.accessToken))
    if (!stored) throw new Error('precondition: session missing')
    await repository.revokeAdminSession(stored.id)

    await expect(service.validate(session.accessToken)).rejects.toMatchObject({
      name: 'AdminAuthenticationError',
    })
  })

  it('throws when the session has expired', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const stored = await repository.findAdminSessionByTokenHash(sha256(session.accessToken))
    if (!stored) throw new Error('precondition: session missing')
    stored.expiresAt = new Date(Date.now() - 1000).toISOString()

    await expect(service.validate(session.accessToken)).rejects.toMatchObject({
      name: 'AdminAuthenticationError',
    })
  })

  it('throws when the user has been disabled', async () => {
    const { repository, install } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    await repository.updateUser(install.organization.id, install.owner.id, { status: 'disabled' })

    await expect(service.validate(session.accessToken)).rejects.toMatchObject({
      name: 'AdminAuthenticationError',
    })
  })

  it('updates lastSeenAt on success', async () => {
    const { repository } = await setupOwner()
    const service = createAdminSessionService({ repository })
    const { session } = await service.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const before = await repository.findAdminSessionByTokenHash(sha256(session.accessToken))
    if (!before) throw new Error('precondition: session missing')
    const originalLastSeenAt = before.lastSeenAt
    await new Promise(resolve => setTimeout(resolve, 5))
    await service.validate(session.accessToken)
    const after = await repository.findAdminSessionByTokenHash(sha256(session.accessToken))
    expect(after?.lastSeenAt).not.toBe(originalLastSeenAt)
  })
})
