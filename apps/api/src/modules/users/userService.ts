import type {
  ChangeOwnPasswordRequest,
  CreateUserRequest,
  EnterpriseUser,
  ResetPasswordRequest,
  UpdateUserRequest,
} from '@muon/enterprise-contracts'
import type { ApiEffect } from '../../effect'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import {
  changeOwnPasswordRequestSchema,
  createUserRequestSchema,
  resetPasswordRequestSchema,
  updateUserRequestSchema,
} from '@muon/enterprise-contracts'
import { Effect } from 'effect'
import { fromPromise, fromSync, runApiEffect } from '../../effect'
import { hashPasswordEffect, verifyPasswordEffect } from '../../security/password'
import { assertAdminRole } from './rbac'

export interface UserService {
  changeOwnPassword: (user: EnterpriseUserRecord, input: ChangeOwnPasswordRequest) => Promise<EnterpriseUser>
  createUser: (actor: EnterpriseUserRecord, input: CreateUserRequest) => Promise<EnterpriseUser>
  resetUserPassword: (
    actor: EnterpriseUserRecord,
    userId: string,
    input: ResetPasswordRequest,
  ) => Promise<EnterpriseUser>
  updateUser: (actor: EnterpriseUserRecord, userId: string, input: UpdateUserRequest) => Promise<EnterpriseUser>
}

export interface UserEffectService {
  changeOwnPassword: (user: EnterpriseUserRecord, input: ChangeOwnPasswordRequest) => ApiEffect<EnterpriseUser>
  createUser: (actor: EnterpriseUserRecord, input: CreateUserRequest) => ApiEffect<EnterpriseUser>
  resetUserPassword: (
    actor: EnterpriseUserRecord,
    userId: string,
    input: ResetPasswordRequest,
  ) => ApiEffect<EnterpriseUser>
  updateUser: (actor: EnterpriseUserRecord, userId: string, input: UpdateUserRequest) => ApiEffect<EnterpriseUser>
}

export interface UserServiceDeps {
  repository: EnterpriseRepository
}

export function createUserEffectService({ repository }: UserServiceDeps): UserEffectService {
  return {
    changeOwnPassword(user, input) {
      return Effect.gen(function* () {
        const request = yield* fromSync(() => changeOwnPasswordRequestSchema.parse(input))
        const passwordMatches = yield* verifyPasswordEffect(request.currentPassword, user.passwordHash)
        if (!passwordMatches) return yield* Effect.fail(new Error('Invalid credentials'))

        const passwordHash = yield* hashPasswordEffect(request.newPassword)
        const updated = yield* fromPromise(() =>
          repository.resetUserPassword(user.organizationId, user.id, {
            passwordHash,
            mustChangePassword: false,
          }),
        )

        yield* fromPromise(() =>
          repository.appendAuditLog({
            organizationId: user.organizationId,
            actorUserId: user.id,
            action: 'user.password_changed',
            targetType: 'user',
            targetId: user.id,
          }),
        )

        return repository.getPublicUser(updated)
      })
    },

    createUser(actor, input) {
      return Effect.gen(function* () {
        yield* fromSync(() => assertAdminRole(actor))
        const request = yield* fromSync(() => createUserRequestSchema.parse(input))
        const passwordHash = yield* hashPasswordEffect(request.initialPassword)
        const user = yield* fromPromise(() =>
          repository.createUser({
            organizationId: actor.organizationId,
            username: request.username,
            email: request.email,
            displayName: request.displayName,
            passwordHash,
            status: 'active',
            mustChangePassword: true,
            roles: request.roles,
          }),
        )

        yield* fromPromise(() =>
          repository.appendAuditLog({
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            action: 'user.created',
            targetType: 'user',
            targetId: user.id,
            metadata: {
              username: user.username,
              roles: user.roles,
            },
          }),
        )

        return repository.getPublicUser(user)
      })
    },

    resetUserPassword(actor, userId, input) {
      return Effect.gen(function* () {
        yield* fromSync(() => assertAdminRole(actor))
        const request = yield* fromSync(() => resetPasswordRequestSchema.parse(input))
        const passwordHash = yield* hashPasswordEffect(request.newPassword)
        const user = yield* fromPromise(() =>
          repository.resetUserPassword(actor.organizationId, userId, {
            passwordHash,
            mustChangePassword: request.mustChangePassword,
          }),
        )

        yield* fromPromise(() =>
          repository.appendAuditLog({
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            action: 'user.password_reset',
            targetType: 'user',
            targetId: user.id,
            metadata: {
              username: user.username,
              mustChangePassword: user.mustChangePassword,
            },
          }),
        )

        return repository.getPublicUser(user)
      })
    },

    updateUser(actor, userId, input) {
      return Effect.gen(function* () {
        yield* fromSync(() => assertAdminRole(actor))
        const request = yield* fromSync(() => updateUserRequestSchema.parse(input))
        const user = yield* fromPromise(() => repository.updateUser(actor.organizationId, userId, request))

        yield* fromPromise(() =>
          repository.appendAuditLog({
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            action: 'user.updated',
            targetType: 'user',
            targetId: user.id,
            metadata: {
              username: user.username,
              roles: user.roles,
            },
          }),
        )

        return repository.getPublicUser(user)
      })
    },
  }
}

export function createUserService(deps: UserServiceDeps): UserService {
  const service = createUserEffectService(deps)
  return {
    changeOwnPassword: (user, input) => runApiEffect(service.changeOwnPassword(user, input)),
    createUser: (actor, input) => runApiEffect(service.createUser(actor, input)),
    resetUserPassword: (actor, userId, input) => runApiEffect(service.resetUserPassword(actor, userId, input)),
    updateUser: (actor, userId, input) => runApiEffect(service.updateUser(actor, userId, input)),
  }
}
