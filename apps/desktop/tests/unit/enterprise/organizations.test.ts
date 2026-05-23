import { describe, expect, it } from 'vitest'
import { createInstallService } from '../../../../api/src/modules/install/installService'
import { createOrganizationService } from '../../../../api/src/modules/organizations/organizationService'
import { createInMemoryEnterpriseRepository } from '../../../../api/src/repository'

async function setupOwner() {
  const repository = createInMemoryEnterpriseRepository()
  const installService = createInstallService({ repository })
  const install = await installService.install({
    organizationName: 'Acme Research',
    organizationSlug: 'acme',
    ownerUsername: 'owner',
    ownerEmail: 'owner@acme.test',
    ownerDisplayName: 'Owner',
    ownerPassword: 'correct horse battery staple',
  })
  return { repository, owner: repository.users.find(user => user.id === install.owner.id)! }
}

describe('admin organizations', () => {
  it('lets an owner create another organization with its own owner', async () => {
    const { repository, owner } = await setupOwner()
    const service = createOrganizationService({ repository })

    const result = await service.createOrganization(owner, {
      organizationName: 'Beta Team',
      organizationSlug: 'beta',
      ownerUsername: 'beta-owner',
      ownerEmail: 'owner@beta.test',
      ownerDisplayName: 'Beta Owner',
      ownerPassword: 'correct horse battery staple',
    })

    expect(result.organization.slug).toBe('beta')
    expect(result.owner.organizationId).toBe(result.organization.id)
    expect(result.owner.roles).toEqual(['owner'])
    expect(await repository.isInstalled()).toBe(true)
    expect(await repository.listOrganizations()).toHaveLength(2)
    expect(repository.auditLogs.filter(event => event.action === 'organization.created')).toHaveLength(2)
  })

  it('rejects member access to organization creation', async () => {
    const { repository } = await setupOwner()
    const service = createOrganizationService({ repository })
    const member = await repository.createUser({
      organizationId: repository.organizations[0].id,
      username: 'member',
      email: 'member@acme.test',
      displayName: 'Member',
      passwordHash: 'x',
      mustChangePassword: true,
      roles: ['member'],
      status: 'active',
    })

    await expect(service.createOrganization(member, {
      organizationName: 'Blocked',
      organizationSlug: 'blocked',
      ownerUsername: 'blocked-owner',
      ownerEmail: 'owner@blocked.test',
      ownerDisplayName: 'Blocked Owner',
      ownerPassword: 'correct horse battery staple',
    })).rejects.toThrow('Requires admin role')
  })
})
