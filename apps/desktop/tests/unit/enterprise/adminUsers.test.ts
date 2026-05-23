import { describe, expect, it } from 'vitest'
import { createAdminSessionService } from '../../../../api/src/modules/auth/adminSessionService'
import { createInstallService } from '../../../../api/src/modules/install/installService'
import { createUserService } from '../../../../api/src/modules/users/userService'
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
  return { repository, install }
}

describe('admin users', () => {
  it('lets an owner create a member with an initial password', async () => {
    const { repository, install } = await setupOwner()
    const adminSessions = createAdminSessionService({ repository })
    const userService = createUserService({ repository })

    const session = await adminSessions.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const member = await userService.createUser(session.user, {
      username: 'lin',
      email: 'lin@acme.test',
      displayName: 'Lin',
      initialPassword: 'initial passphrase',
      roles: ['member'],
    })

    expect(member.organizationId).toBe(install.organization.id)
    expect(member.roles).toEqual(['member'])
    expect(repository.auditLogs.some(event => event.action === 'user.created')).toBe(true)
  })

  it('lets an owner update another owner and reset their password', async () => {
    const { repository, install } = await setupOwner()
    const adminSessions = createAdminSessionService({ repository })
    const userService = createUserService({ repository })

    const session = await adminSessions.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })

    const updated = await userService.updateUser(session.user, install.owner.id, {
      username: 'principal-owner',
      email: 'principal@acme.test',
      displayName: 'Principal Owner',
      roles: ['owner'],
    })
    await userService.resetUserPassword(session.user, install.owner.id, {
      newPassword: 'new owner passphrase',
      mustChangePassword: false,
    })

    expect(updated).toMatchObject({
      username: 'principal-owner',
      email: 'principal@acme.test',
      displayName: 'Principal Owner',
      roles: ['owner'],
    })
    await expect(adminSessions.login({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    })).rejects.toThrow(/credentials/)
    await expect(adminSessions.login({
      organizationSlug: 'acme',
      username: 'principal-owner',
      password: 'new owner passphrase',
    })).resolves.toMatchObject({
      user: {
        id: install.owner.id,
        roles: ['owner'],
      },
    })
    expect(repository.auditLogs.some(event => event.action === 'user.updated')).toBe(true)
    expect(repository.auditLogs.some(event => event.action === 'user.password_reset')).toBe(true)
  })

  it('rejects member access to user administration', async () => {
    const { repository } = await setupOwner()
    const userService = createUserService({ repository })
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

    await expect(userService.createUser(member, {
      username: 'blocked',
      email: 'blocked@acme.test',
      displayName: 'Blocked',
      initialPassword: 'initial passphrase',
      roles: ['member'],
    })).rejects.toThrow('Requires admin role')
  })
})
