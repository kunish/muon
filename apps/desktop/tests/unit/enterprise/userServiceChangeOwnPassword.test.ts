import { describe, expect, it } from 'vitest'
import { createInstallService } from '../../../../api/src/modules/install/installService'
import { createUserService } from '../../../../api/src/modules/users/userService'
import { createInMemoryEnterpriseRepository } from '../../../../api/src/repository'
import { verifyPassword } from '../../../../api/src/security/password'

async function setupOwner() {
  const repository = createInMemoryEnterpriseRepository()
  const install = await createInstallService({ repository }).install({
    organizationName: 'Acme',
    organizationSlug: 'acme',
    ownerUsername: 'owner',
    ownerEmail: 'owner@acme.test',
    ownerDisplayName: 'Owner',
    ownerPassword: 'correct horse battery staple',
  })
  // Simulate the owner needing to change their password (e.g. set by admin or first login).
  const ownerRecord = (await repository.findUserById(install.organization.id, install.owner.id))!
  await repository.resetUserPassword(install.organization.id, ownerRecord.id, {
    passwordHash: ownerRecord.passwordHash,
    mustChangePassword: true,
  })
  return { repository, install }
}

describe('userService.changeOwnPassword', () => {
  it('updates the password hash, clears mustChangePassword, audits', async () => {
    const { repository, install } = await setupOwner()
    const service = createUserService({ repository })

    const ownerRecord = (await repository.findUserById(install.organization.id, install.owner.id))!
    expect(ownerRecord.mustChangePassword).toBe(true)

    const updated = await service.changeOwnPassword(ownerRecord, {
      currentPassword: 'correct horse battery staple',
      newPassword: 'a much better passphrase!',
    })

    expect(updated.mustChangePassword).toBe(false)

    const fresh = (await repository.findUserById(install.organization.id, install.owner.id))!
    expect(await verifyPassword('a much better passphrase!', fresh.passwordHash)).toBe(true)
    expect(await verifyPassword('correct horse battery staple', fresh.passwordHash)).toBe(false)

    expect(
      repository.auditLogs.some(
        (event) => event.action === 'user.password_changed' && event.actorUserId === ownerRecord.id,
      ),
    ).toBe(true)
  })

  it('rejects when the current password is wrong', async () => {
    const { repository, install } = await setupOwner()
    const service = createUserService({ repository })
    const ownerRecord = (await repository.findUserById(install.organization.id, install.owner.id))!

    await expect(
      service.changeOwnPassword(ownerRecord, {
        currentPassword: 'wrong password',
        newPassword: 'a much better passphrase!',
      }),
    ).rejects.toThrow(/credentials/i)

    const fresh = (await repository.findUserById(install.organization.id, install.owner.id))!
    expect(fresh.mustChangePassword).toBe(true)
    expect(await verifyPassword('correct horse battery staple', fresh.passwordHash)).toBe(true)
  })

  it('rejects when the new password is too short', async () => {
    const { repository, install } = await setupOwner()
    const service = createUserService({ repository })
    const ownerRecord = (await repository.findUserById(install.organization.id, install.owner.id))!

    await expect(
      service.changeOwnPassword(ownerRecord, {
        currentPassword: 'correct horse battery staple',
        newPassword: 'short',
      }),
    ).rejects.toThrow()
  })
})
