import { describe, expect, it } from 'vitest'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'
import { createEnterpriseHttpHandler } from '../../../apps/api/src/routes'

async function installAndLogin(handler: ReturnType<typeof createEnterpriseHttpHandler>) {
  await handler.fetch(new Request('http://muon.test/api/install', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationName: 'Acme',
      organizationSlug: 'acme',
      ownerUsername: 'owner',
      ownerEmail: 'owner@acme.test',
      ownerDisplayName: 'Owner',
      ownerPassword: 'correct horse battery staple',
    }),
  }))

  const login = await handler.fetch(new Request('http://muon.test/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
    }),
  }))
  return (await login.json() as { session: { accessToken: string } }).session.accessToken
}

describe('enterprise api routes', () => {
  it('allows the standalone admin web origin to call the api', async () => {
    const handler = createEnterpriseHttpHandler()

    const response = await handler.fetch(new Request('http://muon.test/api/install/status', {
      headers: { origin: 'http://127.0.0.1:4174' },
    }))
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:4174')

    const preflight = await handler.fetch(new Request('http://muon.test/api/install', {
      method: 'OPTIONS',
      headers: {
        'origin': 'http://127.0.0.1:4174',
        'access-control-request-method': 'POST',
      },
    }))
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST')
  })

  it('reports install status before and after install', async () => {
    const handler = createEnterpriseHttpHandler()

    const before = await handler.fetch(new Request('http://muon.test/api/install/status'))
    expect(await before.json()).toEqual({ installed: false })

    const install = await handler.fetch(new Request('http://muon.test/api/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Acme Research',
        organizationSlug: 'acme',
        ownerUsername: 'owner',
        ownerEmail: 'owner@acme.test',
        ownerDisplayName: 'Owner',
        ownerPassword: 'correct horse battery staple',
      }),
    }))
    expect(install.status).toBe(201)

    const after = await handler.fetch(new Request('http://muon.test/api/install/status'))
    expect(await after.json()).toEqual({ installed: true })
  })

  it('lets authenticated admins create and list multiple organizations', async () => {
    const handler = createEnterpriseHttpHandler()

    await handler.fetch(new Request('http://muon.test/api/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Acme Research',
        organizationSlug: 'acme',
        ownerUsername: 'owner',
        ownerEmail: 'owner@acme.test',
        ownerDisplayName: 'Owner',
        ownerPassword: 'correct horse battery staple',
      }),
    }))

    const login = await handler.fetch(new Request('http://muon.test/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'acme',
        username: 'owner',
        password: 'correct horse battery staple',
      }),
    }))
    const loginPayload = await login.json() as { session: { accessToken: string } }

    const create = await handler.fetch(new Request('http://muon.test/api/admin/organizations', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${loginPayload.session.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        organizationName: 'Beta Team',
        organizationSlug: 'beta',
        ownerUsername: 'beta-owner',
        ownerEmail: 'owner@beta.test',
        ownerDisplayName: 'Beta Owner',
        ownerPassword: 'correct horse battery staple',
      }),
    }))
    expect(create.status).toBe(201)
    expect(await create.json()).toMatchObject({
      organization: { slug: 'beta' },
      owner: { username: 'beta-owner', roles: ['owner'] },
    })

    const list = await handler.fetch(new Request('http://muon.test/api/admin/organizations', {
      headers: {
        authorization: `Bearer ${loginPayload.session.accessToken}`,
      },
    }))
    const listPayload = await list.json() as { organizations: Array<{ slug: string }> }
    expect(listPayload.organizations.map(organization => organization.slug)).toEqual(['acme', 'beta'])
  })

  it('lets authenticated admins update owner details and reset owner passwords', async () => {
    const handler = createEnterpriseHttpHandler()

    const installResponse = await handler.fetch(new Request('http://muon.test/api/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Acme Research',
        organizationSlug: 'acme',
        ownerUsername: 'owner',
        ownerEmail: 'owner@acme.test',
        ownerDisplayName: 'Owner',
        ownerPassword: 'correct horse battery staple',
      }),
    }))
    const installPayload = await installResponse.json() as { owner: { id: string } }

    const login = await handler.fetch(new Request('http://muon.test/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'acme',
        username: 'owner',
        password: 'correct horse battery staple',
      }),
    }))
    const loginPayload = await login.json() as { session: { accessToken: string } }

    const update = await handler.fetch(new Request(`http://muon.test/api/admin/users/${installPayload.owner.id}`, {
      method: 'PATCH',
      headers: {
        'authorization': `Bearer ${loginPayload.session.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: 'principal-owner',
        email: 'principal@acme.test',
        displayName: 'Principal Owner',
        roles: ['owner'],
      }),
    }))
    expect(update.status).toBe(200)
    expect(await update.json()).toMatchObject({
      user: {
        username: 'principal-owner',
        email: 'principal@acme.test',
        roles: ['owner'],
      },
    })

    const reset = await handler.fetch(new Request(`http://muon.test/api/admin/users/${installPayload.owner.id}/password`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${loginPayload.session.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        newPassword: 'new owner passphrase',
        mustChangePassword: false,
      }),
    }))
    expect(reset.status).toBe(200)

    const relogin = await handler.fetch(new Request('http://muon.test/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'acme',
        username: 'principal-owner',
        password: 'new owner passphrase',
      }),
    }))
    expect(relogin.status).toBe(200)
  })

  it('rejects admin requests with no bearer token as 401', async () => {
    const handler = createEnterpriseHttpHandler()
    const response = await handler.fetch(new Request('http://muon.test/api/admin/organizations'))
    expect(response.status).toBe(401)
  })

  it('rejects admin requests with an unknown bearer token as 401', async () => {
    const handler = createEnterpriseHttpHandler()
    const response = await handler.fetch(new Request('http://muon.test/api/admin/organizations', {
      headers: { authorization: 'Bearer bogus-token' },
    }))
    expect(response.status).toBe(401)
  })

  async function setupMustChangeOwner() {
    const repository = createInMemoryEnterpriseRepository()
    const handler = createEnterpriseHttpHandler({ repository })

    const install = await handler.fetch(new Request('http://muon.test/api/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Acme',
        organizationSlug: 'acme',
        ownerUsername: 'owner',
        ownerEmail: 'owner@acme.test',
        ownerDisplayName: 'Owner',
        ownerPassword: 'correct horse battery staple',
      }),
    }))
    const installPayload = await install.json() as { organization: { id: string }, owner: { id: string } }

    // installService sets mustChangePassword=false for the owner. Flip it to true
    // so we can exercise the must-change-password gating path.
    const ownerRecord = repository.users.find(user => user.id === installPayload.owner.id)
    if (!ownerRecord) throw new Error('precondition: owner missing')
    await repository.resetUserPassword(installPayload.organization.id, installPayload.owner.id, {
      passwordHash: ownerRecord.passwordHash,
      mustChangePassword: true,
    })

    const login = await handler.fetch(new Request('http://muon.test/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'acme',
        username: 'owner',
        password: 'correct horse battery staple',
      }),
    }))
    const token = (await login.json() as { session: { accessToken: string } }).session.accessToken
    return { repository, handler, token, organizationId: installPayload.organization.id, ownerId: installPayload.owner.id }
  }

  it('returns 403 must_change_password when a must-change user calls a gated admin endpoint', async () => {
    const { handler, token } = await setupMustChangeOwner()
    const response = await handler.fetch(new Request('http://muon.test/api/admin/organizations', {
      headers: { authorization: `Bearer ${token}` },
    }))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'must_change_password' })
  })

  it('lets a must-change user still hit /api/admin/me', async () => {
    const { handler, token } = await setupMustChangeOwner()
    const response = await handler.fetch(new Request('http://muon.test/api/admin/me', {
      headers: { authorization: `Bearer ${token}` },
    }))
    expect(response.status).toBe(200)
    const body = await response.json() as { user: { mustChangePassword: boolean } }
    expect(body.user.mustChangePassword).toBe(true)
  })

  it('keeps admin sessions valid across handler recreation when sharing a repository', async () => {
    const repository = createInMemoryEnterpriseRepository()
    const handlerA = createEnterpriseHttpHandler({ repository })

    await handlerA.fetch(new Request('http://muon.test/api/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Acme',
        organizationSlug: 'acme',
        ownerUsername: 'owner',
        ownerEmail: 'owner@acme.test',
        ownerDisplayName: 'Owner',
        ownerPassword: 'correct horse battery staple',
      }),
    }))

    const login = await handlerA.fetch(new Request('http://muon.test/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'acme',
        username: 'owner',
        password: 'correct horse battery staple',
      }),
    }))
    const loginPayload = await login.json() as { session: { accessToken: string } }

    // Simulate a restart: same repository (= same DB), brand new HTTP handler instance.
    const handlerB = createEnterpriseHttpHandler({ repository })
    const me = await handlerB.fetch(new Request('http://muon.test/api/admin/me', {
      headers: { authorization: `Bearer ${loginPayload.session.accessToken}` },
    }))
    expect(me.status).toBe(200)
  })

  it('logs out an admin session, then rejects further requests with that token', async () => {
    const handler = createEnterpriseHttpHandler()
    const token = await installAndLogin(handler)

    const logout = await handler.fetch(new Request('http://muon.test/api/admin/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    }))
    expect(logout.status).toBe(200)
    expect(await logout.json()).toEqual({ ok: true })

    const me = await handler.fetch(new Request('http://muon.test/api/admin/me', {
      headers: { authorization: `Bearer ${token}` },
    }))
    expect(me.status).toBe(401)
  })

  it('allows a must-change user to log out', async () => {
    const { handler, token } = await setupMustChangeOwner()
    const logout = await handler.fetch(new Request('http://muon.test/api/admin/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    }))
    expect(logout.status).toBe(200)
  })

  it('lets a must-change user change their own password, clears the flag, and unlocks gated endpoints', async () => {
    const { handler, token } = await setupMustChangeOwner()

    const change = await handler.fetch(new Request('http://muon.test/api/admin/me/password', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'correct horse battery staple',
        newPassword: 'a much better passphrase!',
      }),
    }))
    expect(change.status).toBe(200)
    const changeBody = await change.json() as { user: { mustChangePassword: boolean } }
    expect(changeBody.user.mustChangePassword).toBe(false)

    // Gated endpoint now reachable.
    const orgs = await handler.fetch(new Request('http://muon.test/api/admin/organizations', {
      headers: { authorization: `Bearer ${token}` },
    }))
    expect(orgs.status).toBe(200)
  })

  it('rejects the wrong current password with 400', async () => {
    const { handler, token } = await setupMustChangeOwner()

    const response = await handler.fetch(new Request('http://muon.test/api/admin/me/password', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'totally wrong',
        newPassword: 'a much better passphrase!',
      }),
    }))
    expect(response.status).toBe(400)
  })

  it('revokes the user\'s other admin sessions on successful password change', async () => {
    const { handler, token: tokenA } = await setupMustChangeOwner()

    // Login again to create a second session for the same owner.
    const secondLogin = await handler.fetch(new Request('http://muon.test/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'acme',
        username: 'owner',
        password: 'correct horse battery staple',
      }),
    }))
    const tokenB = (await secondLogin.json() as { session: { accessToken: string } }).session.accessToken

    // Change password using tokenA.
    await handler.fetch(new Request('http://muon.test/api/admin/me/password', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${tokenA}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'correct horse battery staple',
        newPassword: 'a much better passphrase!',
      }),
    }))

    // tokenA still valid.
    const meA = await handler.fetch(new Request('http://muon.test/api/admin/me', {
      headers: { authorization: `Bearer ${tokenA}` },
    }))
    expect(meA.status).toBe(200)

    // tokenB now invalid.
    const meB = await handler.fetch(new Request('http://muon.test/api/admin/me', {
      headers: { authorization: `Bearer ${tokenB}` },
    }))
    expect(meB.status).toBe(401)
  })
})
