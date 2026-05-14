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
