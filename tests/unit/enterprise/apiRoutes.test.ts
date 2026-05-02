import { describe, expect, it } from 'vitest'
import { createEnterpriseHttpHandler } from '../../../apps/api/src/routes'

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
})
