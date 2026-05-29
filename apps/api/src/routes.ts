import type { DeviceSessionPublic } from '@muon/enterprise-contracts'
import type { ApiEffect } from './effect'
import type { ApprovalStore } from './modules/approvals/approvalService'
import type { MatrixProvisioningAdapter } from './modules/matrix/provisioning'
import type { MediaStorageService } from './modules/media/mediaStorage'
import type { DeviceSessionRecord, EnterpriseRepository, EnterpriseUserRecord } from './repository'
import { Effect } from 'effect'
import { fromPromise, runApiEffect } from './effect'
import { jsonResponse, readJsonBodyEffect } from './http'
import { createApprovalEffectService, createInMemoryApprovalStore } from './modules/approvals/approvalService'
import {
  AdminAuthenticationError,
  createAdminSessionEffectService,
  MustChangePasswordError,
} from './modules/auth/adminSessionService'
import { createInstallEffectService } from './modules/install/installService'
import { createOAuthEffectService } from './modules/oauth/oauthService'
import { createOrganizationEffectService } from './modules/organizations/organizationService'
import { createUserEffectService } from './modules/users/userService'
import { createInMemoryEnterpriseRepository } from './repository'

export interface EnterpriseHttpHandler {
  fetch: (request: Request) => Promise<Response>
  repository: EnterpriseRepository
}

export interface EnterpriseHttpEffectHandler {
  fetch: (request: Request) => ApiEffect<Response>
  repository: EnterpriseRepository
}

export interface EnterpriseHttpHandlerOptions {
  approvalStore?: ApprovalStore
  corsAllowedOrigins?: string[]
  matrix?: MatrixProvisioningAdapter
  matrixServerUrl?: string
  maxMediaUploadBytes?: number
  mediaStorage?: MediaStorageService
  repository?: EnterpriseRepository
}

const DEFAULT_CORS_ALLOWED_ORIGINS = [
  'http://127.0.0.1:1420',
  'http://localhost:1420',
  'http://127.0.0.1:4174',
  'http://localhost:4174',
]
const DEFAULT_MAX_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024

class MediaUploadTooLargeError extends Error {}

function defaultMatrixAdapter(): MatrixProvisioningAdapter {
  return {
    ensureUser(input) {
      return Promise.resolve({
        matrixUserId: `@${input.organizationSlug}.${input.username}:localhost`,
        accessToken: 'development-matrix-token',
        deviceId: 'MUONDEVICE',
      })
    },
  }
}

function methodNotAllowed(): Response {
  return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
}

function notFound(): Response {
  return jsonResponse({ error: 'Not found' }, { status: 404 })
}

function serviceUnavailable(message: string): Response {
  return jsonResponse({ error: message }, { status: 503 })
}

function errorResponse(error: unknown): Response {
  if (error instanceof AdminAuthenticationError) return jsonResponse({ error: error.message }, { status: 401 })

  if (error instanceof MustChangePasswordError) return jsonResponse({ error: error.code }, { status: 403 })

  if (error instanceof MediaUploadTooLargeError) return jsonResponse({ error: error.message }, { status: 413 })

  const message = error instanceof Error ? error.message : 'Unexpected error'
  const status = /credentials|not found|invalid/i.test(message) ? 400 : 409
  return jsonResponse({ error: message }, { status })
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function corsHeaders(request: Request, allowedOrigins: ReadonlySet<string>): Record<string, string> {
  const origin = request.headers.get('origin')
  if (!origin) return {}

  const normalizedOrigin = normalizeOrigin(origin)
  if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) return {}

  return {
    'access-control-allow-headers': 'authorization, content-type, x-muon-file-name',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    'access-control-allow-origin': normalizedOrigin,
    'access-control-max-age': '600',
  }
}

function appendVary(headers: Headers, value: string): void {
  const existing = headers.get('vary')
  if (!existing) {
    headers.set('vary', value)
    return
  }
  const values = existing.split(',').map((item) => item.trim().toLowerCase())
  if (!values.includes(value.toLowerCase())) {
    headers.set('vary', `${existing}, ${value}`)
  }
}

function withCors(response: Response, request: Request, allowedOrigins: ReadonlySet<string>): Response {
  const headers = new Headers(response.headers)
  appendVary(headers, 'Origin')
  for (const [key, value] of Object.entries(corsHeaders(request, allowedOrigins))) headers.set(key, value)
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
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

function adminUserRoute(pathname: string): { password: boolean; userId: string } | null {
  const match = /^\/api\/admin\/users\/([^/]+)(\/password)?$/.exec(pathname)
  if (!match) return null
  return {
    userId: decodeURIComponent(match[1]),
    password: Boolean(match[2]),
  }
}

function adminUserSessionsRoute(pathname: string): { userId: string; sessionId?: string } | null {
  const match = /^\/api\/admin\/users\/([^/]+)\/sessions(?:\/([^/]+))?$/.exec(pathname)
  if (!match) return null
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

function readRequestBodyEffect(request: Request): ApiEffect<unknown> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Effect.gen(function* () {
      const text = yield* fromPromise(() => request.text())
      const params = new URLSearchParams(text)
      return Object.fromEntries(params.entries())
    })
  }
  return readJsonBodyEffect(request)
}

function decodeHeaderValue(value: string | null, fallback: string): string {
  if (!value) return fallback
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function readMediaUploadEffect(request: Request, maxBytes: number) {
  return Effect.gen(function* () {
    const contentLength = Number(request.headers.get('content-length') ?? '')
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return yield* Effect.fail(new MediaUploadTooLargeError(`Media file exceeds ${maxBytes} bytes`))
    }

    const bytes = yield* fromPromise(() => request.arrayBuffer())
    if (bytes.byteLength === 0) {
      return yield* Effect.fail(new Error('Media file is empty'))
    }
    if (bytes.byteLength > maxBytes) {
      return yield* Effect.fail(new MediaUploadTooLargeError(`Media file exceeds ${maxBytes} bytes`))
    }

    return {
      bytes,
      contentType: request.headers.get('content-type')?.split(';', 1)[0] || 'application/octet-stream',
      fileName: decodeHeaderValue(request.headers.get('x-muon-file-name'), 'upload'),
    }
  })
}

function htmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
      <input type="hidden" name="clientId" value="${htmlAttribute(clientId)}">
      <input type="hidden" name="redirectUri" value="${htmlAttribute(redirectUri)}">
      <input type="hidden" name="codeChallenge" value="${htmlAttribute(codeChallenge)}">
      <input type="hidden" name="codeChallengeMethod" value="${htmlAttribute(codeChallengeMethod)}">
      <input type="hidden" name="state" value="${htmlAttribute(state)}">
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
  const handler = createEnterpriseHttpEffectHandler(options)
  return {
    repository: handler.repository,
    fetch: (request) => runApiEffect(handler.fetch(request)),
  }
}

export function createEnterpriseHttpEffectHandler(
  options: EnterpriseHttpHandlerOptions = {},
): EnterpriseHttpEffectHandler {
  const repository = options.repository ?? createInMemoryEnterpriseRepository()
  const mediaStorage = options.mediaStorage
  const allowedOrigins = new Set(options.corsAllowedOrigins ?? DEFAULT_CORS_ALLOWED_ORIGINS)
  const maxMediaUploadBytes = options.maxMediaUploadBytes ?? DEFAULT_MAX_MEDIA_UPLOAD_BYTES
  const approvalStore = options.approvalStore ?? createInMemoryApprovalStore()
  const approvalService = createApprovalEffectService({ store: approvalStore })
  const installService = createInstallEffectService({ repository })
  const adminSessionService = createAdminSessionEffectService({ repository })
  const organizationService = createOrganizationEffectService({ repository })
  const userService = createUserEffectService({ repository })
  const oauthService = createOAuthEffectService({
    repository,
    matrix: options.matrix ?? defaultMatrixAdapter(),
    matrixServerUrl: options.matrixServerUrl ?? 'http://127.0.0.1:6167',
  })

  function requireAdmin(request: Request): ApiEffect<EnterpriseUserRecord> {
    return Effect.gen(function* () {
      const token = bearerToken(request)
      if (!token) return yield* Effect.fail(new AdminAuthenticationError())
      return yield* adminSessionService.validate(token)
    })
  }

  function requireFullyAuthorizedAdmin(request: Request): ApiEffect<EnterpriseUserRecord> {
    return Effect.gen(function* () {
      const user = yield* requireAdmin(request)
      if (user.mustChangePassword) return yield* Effect.fail(new MustChangePasswordError())
      return user
    })
  }

  function methodNotAllowedWithCors(request: Request): Response {
    return withCors(methodNotAllowed(), request, allowedOrigins)
  }

  return {
    repository,

    fetch(request) {
      const url = new URL(request.url)

      return Effect.gen(function* () {
        if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), request, allowedOrigins)

        if (url.pathname === '/api/media/upload') {
          if (request.method !== 'POST') return methodNotAllowedWithCors(request)
          if (!mediaStorage)
            return withCors(serviceUnavailable('Media storage is not configured'), request, allowedOrigins)

          const upload = yield* readMediaUploadEffect(request, maxMediaUploadBytes)
          return withCors(
            jsonResponse(yield* fromPromise(() => mediaStorage.upload(upload)), { status: 201 }),
            request,
            allowedOrigins,
          )
        }

        if (url.pathname === '/api/install/status') {
          if (request.method !== 'GET') return methodNotAllowedWithCors(request)
          return withCors(jsonResponse(yield* installService.status()), request, allowedOrigins)
        }

        if (url.pathname === '/api/install') {
          if (request.method !== 'POST') return methodNotAllowedWithCors(request)
          const result = yield* installService.install((yield* readRequestBodyEffect(request)) as never)
          return withCors(jsonResponse(result, { status: 201 }), request, allowedOrigins)
        }

        if (url.pathname === '/api/admin/login') {
          if (request.method !== 'POST') return methodNotAllowedWithCors(request)
          const result = yield* adminSessionService.login((yield* readRequestBodyEffect(request)) as never)
          return withCors(
            jsonResponse({
              session: result.session,
              user: repository.getPublicUser(result.user),
            }),
            request,
            allowedOrigins,
          )
        }

        if (url.pathname === '/api/admin/me') {
          if (request.method !== 'GET') return methodNotAllowedWithCors(request)
          const user = yield* requireAdmin(request)
          return withCors(jsonResponse({ user: repository.getPublicUser(user) }), request, allowedOrigins)
        }

        if (url.pathname === '/api/admin/logout') {
          if (request.method !== 'POST') return methodNotAllowedWithCors(request)
          const user = yield* requireAdmin(request)
          const token = bearerToken(request) ?? ''
          yield* adminSessionService.revoke(token)
          yield* fromPromise(() =>
            repository.appendAuditLog({
              organizationId: user.organizationId,
              actorUserId: user.id,
              action: 'admin.logout',
              targetType: 'user',
              targetId: user.id,
            }),
          )
          return withCors(jsonResponse({ ok: true }), request, allowedOrigins)
        }

        if (url.pathname === '/api/admin/me/password') {
          if (request.method !== 'POST') return methodNotAllowedWithCors(request)
          const user = yield* requireAdmin(request)
          const updated = yield* userService.changeOwnPassword(user, (yield* readRequestBodyEffect(request)) as never)
          const token = bearerToken(request) ?? ''
          yield* adminSessionService.revokeOthersForUser(token)
          return withCors(jsonResponse({ user: updated }), request, allowedOrigins)
        }

        if (url.pathname === '/api/admin/organizations') {
          const actor = yield* requireFullyAuthorizedAdmin(request)
          if (request.method === 'GET') {
            return withCors(
              jsonResponse({
                organizations: yield* fromPromise(() => repository.listOrganizations()),
              }),
              request,
              allowedOrigins,
            )
          }
          if (request.method === 'POST') {
            const result = yield* organizationService.createOrganization(
              actor,
              (yield* readRequestBodyEffect(request)) as never,
            )
            return withCors(jsonResponse(result, { status: 201 }), request, allowedOrigins)
          }
          return methodNotAllowedWithCors(request)
        }

        if (url.pathname === '/api/admin/users') {
          const actor = yield* requireFullyAuthorizedAdmin(request)
          if (request.method === 'GET') {
            const users = yield* fromPromise(() => repository.listUsersByOrganization(actor.organizationId))
            return withCors(
              jsonResponse({
                users: users.map((user) => repository.getPublicUser(user)),
              }),
              request,
              allowedOrigins,
            )
          }
          if (request.method === 'POST') {
            const user = yield* userService.createUser(actor, (yield* readRequestBodyEffect(request)) as never)
            return withCors(jsonResponse({ user }, { status: 201 }), request, allowedOrigins)
          }
          return methodNotAllowedWithCors(request)
        }

        const userRoute = adminUserRoute(url.pathname)
        if (userRoute) {
          const actor = yield* requireFullyAuthorizedAdmin(request)
          if (userRoute.password) {
            if (request.method !== 'POST') return methodNotAllowedWithCors(request)
            const user = yield* userService.resetUserPassword(
              actor,
              userRoute.userId,
              (yield* readRequestBodyEffect(request)) as never,
            )
            return withCors(jsonResponse({ user }), request, allowedOrigins)
          }
          if (request.method !== 'PATCH') return methodNotAllowedWithCors(request)
          const user = yield* userService.updateUser(
            actor,
            userRoute.userId,
            (yield* readRequestBodyEffect(request)) as never,
          )
          return withCors(jsonResponse({ user }), request, allowedOrigins)
        }

        const sessionsRoute = adminUserSessionsRoute(url.pathname)
        if (sessionsRoute && !sessionsRoute.sessionId) {
          const actor = yield* requireFullyAuthorizedAdmin(request)
          if (request.method !== 'GET') return methodNotAllowedWithCors(request)
          const sessions = yield* fromPromise(() =>
            repository.findActiveDeviceSessionsByUser(actor.organizationId, sessionsRoute.userId),
          )
          return withCors(
            jsonResponse({
              sessions: sessions.map(toDeviceSessionPublic),
            }),
            request,
            allowedOrigins,
          )
        }

        if (sessionsRoute && sessionsRoute.sessionId) {
          const actor = yield* requireFullyAuthorizedAdmin(request)
          if (request.method !== 'DELETE') return methodNotAllowedWithCors(request)
          const sessionId = sessionsRoute.sessionId
          const session = yield* fromPromise(() => repository.findDeviceSessionById(sessionId))
          if (!session || session.organizationId !== actor.organizationId) {
            return withCors(notFound(), request, allowedOrigins)
          }
          yield* fromPromise(() => repository.revokeDeviceSession(sessionId))
          yield* fromPromise(() =>
            repository.appendAuditLog({
              organizationId: actor.organizationId,
              actorUserId: actor.id,
              action: 'device_session.revoked',
              targetType: 'device_session',
              targetId: sessionId,
            }),
          )
          return withCors(jsonResponse({ ok: true }), request, allowedOrigins)
        }

        if (url.pathname === '/api/admin/audit-logs') {
          if (request.method !== 'GET') return methodNotAllowedWithCors(request)
          const actor = yield* requireFullyAuthorizedAdmin(request)
          return withCors(
            jsonResponse({
              auditLogs: yield* fromPromise(() => repository.listAuditLogsByOrganization(actor.organizationId)),
            }),
            request,
            allowedOrigins,
          )
        }

        if (url.pathname === '/api/oauth/authorize') {
          if (request.method !== 'GET') return methodNotAllowedWithCors(request)
          return withCors(oauthAuthorizePage(url), request, allowedOrigins)
        }

        if (url.pathname === '/api/oauth/login') {
          if (request.method !== 'POST') return methodNotAllowedWithCors(request)
          const result = yield* oauthService.loginAndCreateCode((yield* readRequestBodyEffect(request)) as never)
          if ((request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded')) {
            return withCors(
              new Response(null, {
                status: 302,
                headers: { location: result.redirectUri },
              }),
              request,
              allowedOrigins,
            )
          }
          return withCors(jsonResponse(result), request, allowedOrigins)
        }

        if (url.pathname === '/api/oauth/token') {
          if (request.method !== 'POST') return methodNotAllowedWithCors(request)
          return withCors(
            jsonResponse(yield* oauthService.exchangeCode((yield* readRequestBodyEffect(request)) as never)),
            request,
            allowedOrigins,
          )
        }

        if (url.pathname === '/api/oauth/refresh') {
          if (request.method !== 'POST') return methodNotAllowedWithCors(request)
          const result = yield* oauthService.refresh((yield* readRequestBodyEffect(request)) as never)
          return withCors(jsonResponse(result), request, allowedOrigins)
        }

        // ── 审批工作流后端(企业级:服务端状态 + 多级流转) ──
        if (url.pathname === '/api/approvals' || url.pathname.startsWith('/api/approvals/')) {
          if (!bearerToken(request)) return yield* Effect.fail(new AdminAuthenticationError())

          if (url.pathname === '/api/approvals') {
            if (request.method !== 'GET') return methodNotAllowedWithCors(request)
            return withCors(jsonResponse({ approvals: yield* approvalService.list() }), request, allowedOrigins)
          }

          const action = url.pathname.match(/^\/api\/approvals\/([^/]+)\/(decision|transfer|comment)$/)
          if (action) {
            if (request.method !== 'POST') return methodNotAllowedWithCors(request)
            const id = action[1]!
            const body = (yield* readRequestBodyEffect(request)) as Record<string, unknown>
            if (action[2] === 'decision') {
              const decision = body.decision === 'rejected' ? 'rejected' : 'approved'
              const approval = yield* approvalService.decide(id, decision)
              return withCors(jsonResponse({ approval }), request, allowedOrigins)
            }
            if (action[2] === 'transfer') {
              const approval = yield* approvalService.transfer(id, String(body.handler ?? ''))
              return withCors(jsonResponse({ approval }), request, allowedOrigins)
            }
            const approval = yield* approvalService.comment(id, String(body.comment ?? ''))
            return withCors(jsonResponse({ approval }), request, allowedOrigins)
          }

          return methodNotAllowedWithCors(request)
        }

        return withCors(notFound(), request, allowedOrigins)
      }).pipe(Effect.catchAll((error) => Effect.succeed(withCors(errorResponse(error), request, allowedOrigins))))
    },
  }
}
