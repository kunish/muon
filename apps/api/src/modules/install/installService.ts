import type { InstallRequest, InstallResponse } from '@muon/enterprise-contracts'
import type { EnterpriseRepository } from '../../repository'
import { installRequestSchema } from '@muon/enterprise-contracts'
import { hashPassword } from '../../security/password'

export interface InstallService {
  install: (input: InstallRequest) => Promise<InstallResponse>
  status: () => Promise<{ installed: boolean }>
}

export interface InstallServiceDeps {
  repository: EnterpriseRepository
}

export function createInstallService({ repository }: InstallServiceDeps): InstallService {
  return {
    async install(input) {
      const request = installRequestSchema.parse(input)
      if (await repository.isInstalled())
        throw new Error('Muon is already installed')

      const organization = await repository.createOrganization({
        name: request.organizationName,
        slug: request.organizationSlug,
      })
      const owner = await repository.createUser({
        organizationId: organization.id,
        username: request.ownerUsername,
        email: request.ownerEmail,
        displayName: request.ownerDisplayName,
        passwordHash: await hashPassword(request.ownerPassword),
        status: 'active',
        mustChangePassword: false,
        roles: ['owner'],
      })

      await repository.appendAuditLog({
        organizationId: organization.id,
        actorUserId: owner.id,
        action: 'install.completed',
        targetType: 'organization',
        targetId: organization.id,
        metadata: { organizationSlug: organization.slug },
      })

      return {
        organization,
        owner: repository.getPublicUser(owner),
      }
    },

    async status() {
      return { installed: await repository.isInstalled() }
    },
  }
}
