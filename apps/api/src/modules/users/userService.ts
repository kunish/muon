import type { ChangeOwnPasswordRequest, CreateUserRequest, EnterpriseUser, ResetPasswordRequest, UpdateUserRequest } from '@muon/enterprise-contracts'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import { changeOwnPasswordRequestSchema, createUserRequestSchema, resetPasswordRequestSchema, updateUserRequestSchema } from '@muon/enterprise-contracts'
import { hashPassword, verifyPassword } from '../../security/password'
import { assertAdminRole } from './rbac'

export interface UserService {
  changeOwnPassword: (
    user: EnterpriseUserRecord,
    input: ChangeOwnPasswordRequest,
  ) => Promise<EnterpriseUser>
  createUser: (actor: EnterpriseUserRecord, input: CreateUserRequest) => Promise<EnterpriseUser>
  resetUserPassword: (actor: EnterpriseUserRecord, userId: string, input: ResetPasswordRequest) => Promise<EnterpriseUser>
  updateUser: (actor: EnterpriseUserRecord, userId: string, input: UpdateUserRequest) => Promise<EnterpriseUser>
}

export interface UserServiceDeps {
  repository: EnterpriseRepository
}

export function createUserService({ repository }: UserServiceDeps): UserService {
  return {
    async changeOwnPassword(user, input) {
      const request = changeOwnPasswordRequestSchema.parse(input)
      if (!await verifyPassword(request.currentPassword, user.passwordHash))
        throw new Error('Invalid credentials')

      const updated = await repository.resetUserPassword(user.organizationId, user.id, {
        passwordHash: await hashPassword(request.newPassword),
        mustChangePassword: false,
      })

      await repository.appendAuditLog({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'user.password_changed',
        targetType: 'user',
        targetId: user.id,
      })

      return repository.getPublicUser(updated)
    },

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
