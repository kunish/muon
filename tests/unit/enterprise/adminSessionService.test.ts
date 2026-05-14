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
