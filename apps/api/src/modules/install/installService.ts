import type { InstallRequest, InstallResponse } from '@muon/enterprise-contracts'
import type { ApiEffect } from '../../effect'
import type { EnterpriseRepository } from '../../repository'
import { installRequestSchema } from '@muon/enterprise-contracts'
import { Effect } from 'effect'
import { fromPromise, fromSync, runApiEffect } from '../../effect'
import { hashPasswordEffect } from '../../security/password'

export interface InstallService {
  install: (input: InstallRequest) => Promise<InstallResponse>
  status: () => Promise<{ installed: boolean }>
}

export interface InstallEffectService {
  install: (input: InstallRequest) => ApiEffect<InstallResponse>
  status: () => ApiEffect<{ installed: boolean }>
}

export interface InstallServiceDeps {
  repository: EnterpriseRepository
}

export function createInstallEffectService({ repository }: InstallServiceDeps): InstallEffectService {
  return {
    install(input) {
      return Effect.gen(function* () {
        const request = yield* fromSync(() => installRequestSchema.parse(input))
        const installed = yield* fromPromise(() => repository.isInstalled())
        if (installed) return yield* Effect.fail(new Error('Muon is already installed'))

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
            organizationId: organization.id,
            actorUserId: owner.id,
            action: 'install.completed',
            targetType: 'organization',
            targetId: organization.id,
            metadata: { organizationSlug: organization.slug },
          }),
        )

        return {
          organization,
          owner: repository.getPublicUser(owner),
        }
      })
    },

    status() {
      return Effect.gen(function* () {
        return { installed: yield* fromPromise(() => repository.isInstalled()) }
      })
    },
  }
}

export function createInstallService(deps: InstallServiceDeps): InstallService {
  const service = createInstallEffectService(deps)
  return {
    install: (input) => runApiEffect(service.install(input)),
    status: () => runApiEffect(service.status()),
  }
}
