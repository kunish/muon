import { describe, expect, it } from 'vitest'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'

describe('install service', () => {
  it('creates the first organization and owner only once', async () => {
    const repository = createInMemoryEnterpriseRepository()
    const service = createInstallService({ repository })

    const result = await service.install({
      organizationName: 'Acme Research',
      organizationSlug: 'acme',
      ownerUsername: 'owner',
      ownerEmail: 'owner@acme.test',
      ownerDisplayName: 'Owner',
      ownerPassword: 'correct horse battery staple',
    })

    expect(result.organization.slug).toBe('acme')
    expect(result.owner.username).toBe('owner')
    expect(result.owner.roles).toContain('owner')

    await expect(service.install({
      organizationName: 'Second Org',
      organizationSlug: 'second',
      ownerUsername: 'owner2',
      ownerEmail: 'owner2@example.test',
      ownerDisplayName: 'Owner 2',
      ownerPassword: 'correct horse battery staple',
    })).rejects.toThrow('Muon is already installed')
  })
})
