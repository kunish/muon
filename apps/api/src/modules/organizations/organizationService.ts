import type { CreateOrganizationRequest, CreateOrganizationResponse } from '@muon/enterprise-contracts'
import type { ApiEffect } from '../../effect'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import { createOrganizationRequestSchema } from '@muon/enterprise-contracts'
import { Effect } from 'effect'
import { fromPromise, fromSync, runApiEffect } from '../../effect'
import { hashPasswordEffect } from '../../security/password'
import { assertAdminRole } from '../users/rbac'

export interface OrganizationService {
  createOrganization: (
    actor: EnterpriseUserRecord,
    input: CreateOrganizationRequest,
  ) => Promise<CreateOrganizationResponse>
}

export interface OrganizationEffectService {
  createOrganization: (
    actor: EnterpriseUserRecord,
    input: CreateOrganizationRequest,
  ) => ApiEffect<CreateOrganizationResponse>
}

export interface OrganizationServiceDeps {
  repository: EnterpriseRepository
}

export function createOrganizationEffectService({ repository }: OrganizationServiceDeps): OrganizationEffectService {
  return {
    createOrganization(actor, input) {
      return Effect.gen(function* () {
        yield* fromSync(() => assertAdminRole(actor))
        const request = yield* fromSync(() => createOrganizationRequestSchema.parse(input))
        const existing = yield* fromPromise(() => repository.findOrganizationBySlug(request.organizationSlug))
        if (existing) return yield* Effect.fail(new Error('Organization slug is already in use'))

        const organization = yield* fromPromise(() =>
          repository.createOrganization({
            name: request.organizationName,
            slug: request.organizationSlug,
          }),
        )
        const passwordHash = yield* hashPasswordEffect(request.ownerPassword)
        const owner = yield* fromPromise(() =>
          repository.createUser({
            organizationId: organization.id,
            username: request.ownerUsername,
            email: request.ownerEmail,
            displayName: request.ownerDisplayName,
            passwordHash,
            status: 'active',
            mustChangePassword: false,
            roles: ['owner'],
          }),
        )

        yield* fromPromise(() =>
          repository.appendAuditLog({
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            action: 'organization.created',
            targetType: 'organization',
            targetId: organization.id,
            metadata: {
              organizationSlug: organization.slug,
              ownerUsername: owner.username,
            },
          }),
        )

        yield* fromPromise(() =>
          repository.appendAuditLog({
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
          }),
        )

        return {
          organization,
          owner: repository.getPublicUser(owner),
        }
      })
    },
  }
}

export function createOrganizationService(deps: OrganizationServiceDeps): OrganizationService {
  const service = createOrganizationEffectService(deps)
  return {
    createOrganization: (actor, input) => runApiEffect(service.createOrganization(actor, input)),
  }
}
