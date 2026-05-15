import type { DeviceSessionPublic } from '@muon/enterprise-contracts'
import type { MatrixProvisioningAdapter } from './modules/matrix/provisioning'
import type { DeviceSessionRecord, EnterpriseRepository, EnterpriseUserRecord } from './repository'
import { jsonResponse, readJsonBody } from './http'
import { AdminAuthenticationError, createAdminSessionService, MustChangePasswordError } from './modules/auth/adminSessionService'
import { createInstallService } from './modules/install/installService'
import { createOAuthService } from './modules/oauth/oauthService'
import { createOrganizationService } from './modules/organizations/organizationService'
import { createUserService } from './modules/users/userService'
import { createInMemoryEnterpriseRepository } from './repository'

export interface EnterpriseHttpHandler {
  fetch: (request: Request) => Promise<Response>
  repository: EnterpriseRepository
}

export interface EnterpriseHttpHandlerOptions {
  matrix?: MatrixProvisioningAdapter
  matrixServerUrl?: string
  repository?: EnterpriseRepository
}

function defaultMatrixAdapter(): MatrixProvisioningAdapter {
  return {
    async ensureUser(input) {
      return {
        matrixUserId: `@${input.organizationSlug}.${input.username}:localhost`,
        accessToken: 'development-matrix-token',
        deviceId: 'MUONDEVICE',
      }
    },
  }
}

function methodNotAllowed(): Response {
  return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
}

function notFound(): Response {
  return jsonResponse({ error: 'Not found' }, { status: 404 })
}

function errorResponse(error: unknown): Response {
  if (error instanceof AdminAuthenticationError)
    return jsonResponse({ error: error.message }, { status: 401 })

  if (error instanceof MustChangePasswordError)
    return jsonResponse({ error: error.code }, { status: 403 })

  const message = error instanceof Error ? error.message : 'Unexpected error'
  const status = /credentials|not found|invalid/i.test(message) ? 400 : 409
  return jsonResponse({ error: message }, { status })
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin')
  if (!origin)
    return {}

  return {
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    'access-control-allow-origin': origin,
    'access-control-max-age': '600',
  }
}

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders(request)))
    headers.set(key, value)
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...init.headers,
    },
  })
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer '))
    return null
  return header.slice('Bearer '.length)
}

function adminUserRoute(pathname: string): { password: boolean, userId: string } | null {
  const match = /^\/api\/admin\/users\/([^/]+)(\/password)?$/.exec(pathname)
  if (!match)
    return null
  return {
    userId: decodeURIComponent(match[1]),
    password: Boolean(match[2]),
  }
}

function adminUserSessionsRoute(pathname: string): { userId: string, sessionId?: string } | null {
  const match = /^\/api\/admin\/users\/([^/]+)\/sessions(?:\/([^/]+))?$/.exec(pathname)
  if (!match)
    return null
  return {
    userId: decodeURIComponent(match[1]),
    sessionId: match[2] ? decodeURIComponent(match[2]) : undefined,
  }
}

function toDeviceSessionPublic(record: DeviceSessionRecord): DeviceSessionPublic {
  return {
    id: record.id,
    deviceName: record.deviceName,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  }
}

async function readRequestBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(await request.text())
    return Object.fromEntries(params.entries())
  }
  return await readJsonBody(request)
}

function oauthAuthorizePage(url: URL): Response {
  const clientId = url.searchParams.get('client_id') ?? ''
  const redirectUri = url.searchParams.get('redirect_uri') ?? ''
  const codeChallenge = url.searchParams.get('code_challenge') ?? ''
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? 'S256'
  const state = url.searchParams.get('state') ?? ''

  return htmlResponse(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Muon 企业登录</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;color:#1f2328;font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif}
    main{width:min(420px,calc(100vw - 32px));background:#fff;border:1px solid #e4e7ec;border-radius:8px;padding:28px;box-shadow:0 18px 42px rgba(16,24,40,.08)}
    h1{margin:0 0 6px;font-size:24px}
    p{margin:0 0 22px;color:#667085}
    form{display:grid;gap:14px}
    label{display:grid;gap:6px;font-size:14px;color:#3d4656}
    input{height:38px;border:1px solid #d0d5dd;border-radius:6px;padding:0 10px;font-size:14px}
    button{height:38px;border:0;border-radius:6px;background:#2563eb;color:#fff;font-weight:700}
  </style>
</head>
<body>
  <main>
    <h1>Muon 企业登录</h1>
    <p>登录后将自动返回桌面客户端。</p>
    <form method="post" action="/api/oauth/login">
      <input type="hidden" name="clientId" value="${clientId}">
      <input type="hidden" name="redirectUri" value="${redirectUri}">
      <input type="hidden" name="codeChallenge" value="${codeChallenge}">
      <input type="hidden" name="codeChallengeMethod" value="${codeChallengeMethod}">
      <input type="hidden" name="state" value="${state}">
      <label>组织标识<input name="organizationSlug" autocomplete="organization" required></label>
      <label>用户名<input name="username" autocomplete="username" required></label>
      <label>密码<input name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit">登录并打开 Muon</button>
    </form>
  </main>
</body>
</html>`)
}

export function createEnterpriseHttpHandler(options: EnterpriseHttpHandlerOptions = {}): EnterpriseHttpHandler {
  const repository = options.repository ?? createInMemoryEnterpriseRepository()
  const installService = createInstallService({ repository })
  const adminSessionService = createAdminSessionService({ repository })
  const organizationService = createOrganizationService({ repository })
  const userService = createUserService({ repository })
  const oauthService = createOAuthService({
    repository,
    matrix: options.matrix ?? defaultMatrixAdapter(),
    matrixServerUrl: options.matrixServerUrl ?? 'http://127.0.0.1:6167',
  })
  async function requireAdmin(request: Request): Promise<EnterpriseUserRecord> {
    const token = bearerToken(request)
    if (!token)
      throw new AdminAuthenticationError()
    return adminSessionService.validate(token)
  }

  async function requireFullyAuthorizedAdmin(request: Request): Promise<EnterpriseUserRecord> {
    const user = await requireAdmin(request)
    if (user.mustChangePassword)
      throw new MustChangePasswordError()
    return user
  }

  return {
    repository,

    async fetch(request) {
      const url = new URL(request.url)

      try {
        if (request.method === 'OPTIONS')
          return withCors(new Response(null, { status: 204 }), request)

        let response: Response
        if (url.pathname === '/api/install/status') {
          if (request.method !== 'GET')
            return methodNotAllowed()
          response = jsonResponse(await installService.status())
          return withCors(response, request)
        }

        if (url.pathname === '/api/install') {
          if (request.method !== 'POST')
            return methodNotAllowed()
          const result = await installService.install(await readRequestBody(request) as never)
          return withCors(jsonResponse(result, { status: 201 }), request)
        }

        if (url.pathname === '/api/admin/login') {
          if (request.method !== 'POST')
            return methodNotAllowed()
          const result = await adminSessionService.login(await readRequestBody(request) as never)
          return withCors(jsonResponse({
            session: result.session,
            user: repository.getPublicUser(result.user),
          }), request)
        }

        if (url.pathname === '/api/admin/me') {
          if (request.method !== 'GET')
            return methodNotAllowed()
          const user = await requireAdmin(request)
          return withCors(jsonResponse({ user: repository.getPublicUser(user) }), request)
        }

        if (url.pathname === '/api/admin/logout') {
          if (request.method !== 'POST')
            return methodNotAllowed()
          const user = await requireAdmin(request)
          const token = bearerToken(request) ?? ''
          await adminSessionService.revoke(token)
          await repository.appendAuditLog({
            organizationId: user.organizationId,
            actorUserId: user.id,
            action: 'admin.logout',
            targetType: 'user',
            targetId: user.id,
          })
          return withCors(jsonResponse({ ok: true }), request)
        }

        if (url.pathname === '/api/admin/me/password') {
          if (request.method !== 'POST')
            return methodNotAllowed()
          const user = await requireAdmin(request)
          const updated = await userService.changeOwnPassword(user, await readRequestBody(request) as never)
          const token = bearerToken(request) ?? ''
          await adminSessionService.revokeOthersForUser(token)
          return withCors(jsonResponse({ user: updated }), request)
        }

        if (url.pathname === '/api/admin/organizations') {
          const actor = await requireFullyAuthorizedAdmin(request)
          if (request.method === 'GET') {
            return withCors(jsonResponse({
              organizations: await repository.listOrganizations(),
            }), request)
          }
          if (request.method === 'POST') {
            const result = await organizationService.createOrganization(actor, await readRequestBody(request) as never)
            return withCors(jsonResponse(result, { status: 201 }), request)
          }
          return methodNotAllowed()
        }

        if (url.pathname === '/api/admin/users') {
          const actor = await requireFullyAuthorizedAdmin(request)
          if (request.method === 'GET') {
            return withCors(jsonResponse({
              users: (await repository.listUsersByOrganization(actor.organizationId))
                .map(user => repository.getPublicUser(user)),
            }), request)
          }
          if (request.method === 'POST') {
            const user = await userService.createUser(actor, await readRequestBody(request) as never)
            return withCors(jsonResponse({ user }, { status: 201 }), request)
          }
          return methodNotAllowed()
        }

        const userRoute = adminUserRoute(url.pathname)
        if (userRoute) {
          const actor = await requireFullyAuthorizedAdmin(request)
          if (userRoute.password) {
            if (request.method !== 'POST')
              return methodNotAllowed()
            const user = await userService.resetUserPassword(actor, userRoute.userId, await readRequestBody(request) as never)
            return withCors(jsonResponse({ user }), request)
          }
          if (request.method !== 'PATCH')
            return methodNotAllowed()
          const user = await userService.updateUser(actor, userRoute.userId, await readRequestBody(request) as never)
          return withCors(jsonResponse({ user }), request)
        }

        const sessionsRoute = adminUserSessionsRoute(url.pathname)
        if (sessionsRoute && !sessionsRoute.sessionId) {
          const actor = await requireFullyAuthorizedAdmin(request)
          if (request.method !== 'GET')
            return methodNotAllowed()
          const sessions = await repository.findActiveDeviceSessionsByUser(actor.organizationId, sessionsRoute.userId)
          return withCors(jsonResponse({
            sessions: sessions.map(toDeviceSessionPublic),
          }), request)
        }

        if (sessionsRoute && sessionsRoute.sessionId) {
          const actor = await requireFullyAuthorizedAdmin(request)
          if (request.method !== 'DELETE')
            return methodNotAllowed()
          await repository.revokeDeviceSession(sessionsRoute.sessionId)
          await repository.appendAuditLog({
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            action: 'device_session.revoked',
            targetType: 'device_session',
            targetId: sessionsRoute.sessionId,
          })
          return withCors(jsonResponse({ ok: true }), request)
        }

        if (url.pathname === '/api/admin/audit-logs') {
          if (request.method !== 'GET')
            return methodNotAllowed()
          const actor = await requireFullyAuthorizedAdmin(request)
          return withCors(jsonResponse({
            auditLogs: await repository.listAuditLogsByOrganization(actor.organizationId),
          }), request)
        }

        if (url.pathname === '/api/oauth/authorize') {
          if (request.method !== 'GET')
            return methodNotAllowed()
          return withCors(oauthAuthorizePage(url), request)
        }

        if (url.pathname === '/api/oauth/login') {
          if (request.method !== 'POST')
            return methodNotAllowed()
          const result = await oauthService.loginAndCreateCode(await readRequestBody(request) as never)
          if ((request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded')) {
            return withCors(new Response(null, {
              status: 302,
              headers: { location: result.redirectUri },
            }), request)
          }
          return withCors(jsonResponse(result), request)
        }

        if (url.pathname === '/api/oauth/token') {
          if (request.method !== 'POST')
            return methodNotAllowed()
          return withCors(jsonResponse(await oauthService.exchangeCode(await readRequestBody(request) as never)), request)
        }

        if (url.pathname === '/api/oauth/refresh') {
          if (request.method !== 'POST')
            return methodNotAllowed()
          const result = await oauthService.refresh(await readRequestBody(request) as never)
          return withCors(jsonResponse(result), request)
        }

        return withCors(notFound(), request)
      }
      catch (error) {
        return withCors(errorResponse(error), request)
      }
    },
  }
}
