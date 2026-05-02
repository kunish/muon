import type { CreateUserRequest, EnterpriseUser, ResetPasswordRequest, UpdateUserRequest } from '@muon/enterprise-contracts'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import { createUserRequestSchema, resetPasswordRequestSchema, updateUserRequestSchema } from '@muon/enterprise-contracts'
import { hashPassword } from '../../security/password'
import { assertAdminRole } from './rbac'

export interface UserService {
  createUser: (actor: EnterpriseUserRecord, input: CreateUserRequest) => Promise<EnterpriseUser>
  resetUserPassword: (actor: EnterpriseUserRecord, userId: string, input: ResetPasswordRequest) => Promise<EnterpriseUser>
  updateUser: (actor: EnterpriseUserRecord, userId: string, input: UpdateUserRequest) => Promise<EnterpriseUser>
}

export interface UserServiceDeps {
  repository: EnterpriseRepository
}

export function createUserService({ repository }: UserServiceDeps): UserService {
  return {
    async createUser(actor, input) {
      assertAdminRole(actor)
      const request = createUserRequestSchema.parse(input)
      const user = await repository.createUser({
        organizationId: actor.organizationId,
        username: request.username,
        email: request.email,
        displayName: request.displayName,
        passwordHash: await hashPassword(request.initialPassword),
        status: 'active',
        mustChangePassword: true,
        roles: request.roles,
      })

      await repository.appendAuditLog({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'user.created',
        targetType: 'user',
        targetId: user.id,
        metadata: {
          username: user.username,
          roles: user.roles,
        },
      })

      return repository.getPublicUser(user)
    },

    async resetUserPassword(actor, userId, input) {
      assertAdminRole(actor)
      const request = resetPasswordRequestSchema.parse(input)
      const user = await repository.resetUserPassword(actor.organizationId, userId, {
        passwordHash: await hashPassword(request.newPassword),
        mustChangePassword: request.mustChangePassword,
      })

      await repository.appendAuditLog({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'user.password_reset',
        targetType: 'user',
        targetId: user.id,
        metadata: {
          username: user.username,
          mustChangePassword: user.mustChangePassword,
        },
      })

      return repository.getPublicUser(user)
    },

    async updateUser(actor, userId, input) {
      assertAdminRole(actor)
      const request = updateUserRequestSchema.parse(input)
      const user = await repository.updateUser(actor.organizationId, userId, request)

      await repository.appendAuditLog({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'user.updated',
        targetType: 'user',
        targetId: user.id,
        metadata: {
          username: user.username,
          roles: user.roles,
        },
      })

      return repository.getPublicUser(user)
    },
  }
}
