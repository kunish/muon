import type { CreateOrganizationRequest, CreateOrganizationResponse } from '@muon/enterprise-contracts'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import { createOrganizationRequestSchema } from '@muon/enterprise-contracts'
import { hashPassword } from '../../security/password'
import { assertAdminRole } from '../users/rbac'

export interface OrganizationService {
  createOrganization: (actor: EnterpriseUserRecord, input: CreateOrganizationRequest) => Promise<CreateOrganizationResponse>
}

export interface OrganizationServiceDeps {
  repository: EnterpriseRepository
}

export function createOrganizationService({ repository }: OrganizationServiceDeps): OrganizationService {
  return {
    async createOrganization(actor, input) {
      assertAdminRole(actor)
      const request = createOrganizationRequestSchema.parse(input)
      if (await repository.findOrganizationBySlug(request.organizationSlug))
        throw new Error('Organization slug is already in use')

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
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'organization.created',
        targetType: 'organization',
        targetId: organization.id,
        metadata: {
          organizationSlug: organization.slug,
          ownerUsername: owner.username,
        },
      })

      await repository.appendAuditLog({
        organizationId: organization.id,
        actorUserId: actor.id,
        action: 'organization.created',
        targetType: 'organization',
        targetId: organization.id,
        metadata: {
          actorOrganizationId: actor.organizationId,
          organizationSlug: organization.slug,
          ownerUsername: owner.username,
        },
      })

      return {
        organization,
        owner: repository.getPublicUser(owner),
      }
    },
  }
}
