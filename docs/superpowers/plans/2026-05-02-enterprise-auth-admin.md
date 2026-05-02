# Enterprise Auth Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Muon's enterprise organization, admin, OAuth-style desktop login, Electron deeplink, and Matrix provisioning foundation inside the current repository.

**Architecture:** Add a TypeScript API under `apps/api`, a standalone Admin Web app under `apps/admin`, and shared contracts under `packages/enterprise-contracts`. The API owns persistence, auth, OAuth codes, audit events, and Matrix provisioning; Admin Web and Electron call the API through typed contracts.

**Tech Stack:** TypeScript, Vue 3, Vite, Vitest, zod, Node HTTP APIs, Postgres-ready repository interfaces, Electron protocol handling.

---

## File Structure

- Create `pnpm-workspace.yaml` so `apps/*` and `packages/*` participate in workspace scripts.
- Modify `package.json` with enterprise scripts and local workspace dependencies.
- Create `packages/enterprise-contracts/src/*` for shared zod schemas and types.
- Create `apps/api/src/*` for config, HTTP server, in-memory test repository, auth services, install/admin/oauth routes, Matrix provisioning adapters, and audit logging.
- Create `apps/admin/src/*` for a standalone Admin Web app and API client.
- Modify `electron/main.ts` and `electron/preload.ts` to register and forward auth deeplinks.
- Modify `src/features/auth/components/LoginPage.vue` and `src/matrix/auth.ts` to add enterprise auth flow while preserving password fallback.
- Add focused tests under `tests/unit/enterprise/*`, `tests/components/*`, and `tests/unit/electron/*`.

## Task 1: Workspace And Contracts

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`
- Create: `packages/enterprise-contracts/package.json`
- Create: `packages/enterprise-contracts/src/index.ts`
- Create: `packages/enterprise-contracts/src/schemas.ts`
- Test: `tests/unit/enterprise/contracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

Create `tests/unit/enterprise/contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  installRequestSchema,
  oauthTokenResponseSchema,
  userRoleSchema,
} from '@muon/enterprise-contracts'

describe('enterprise contracts', () => {
  it('validates install requests for first-run setup', () => {
    const result = installRequestSchema.safeParse({
      organizationName: 'Acme Research',
      organizationSlug: 'acme',
      ownerUsername: 'owner',
      ownerEmail: 'owner@acme.test',
      ownerDisplayName: 'Owner',
      ownerPassword: 'correct horse battery staple',
    })

    expect(result.success).toBe(true)
  })

  it('rejects invalid role names', () => {
    expect(userRoleSchema.safeParse('owner').success).toBe(true)
    expect(userRoleSchema.safeParse('superuser').success).toBe(false)
  })

  it('keeps desktop token exchange compatible with matrix auth storage', () => {
    const result = oauthTokenResponseSchema.safeParse({
      muonSession: {
        accessToken: 'muon-access',
        refreshToken: 'muon-refresh',
        expiresAt: '2026-05-02T12:00:00.000Z',
      },
      matrixSession: {
        serverUrl: 'http://127.0.0.1:6167',
        userId: '@owner:localhost',
        accessToken: 'matrix-token',
        deviceId: 'MUONDEVICE',
      },
    })

    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run contract tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/contracts.test.ts`

Expected: fail because `@muon/enterprise-contracts` does not exist.

- [ ] **Step 3: Add workspace and contract implementation**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - .
  - apps/*
  - packages/*
```

Create `packages/enterprise-contracts/package.json`:

```json
{
  "name": "@muon/enterprise-contracts",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "workspace:*"
  }
}
```

Create `packages/enterprise-contracts/src/schemas.ts` with zod schemas for install, admin login, user creation, OAuth authorize, token exchange, Matrix session, and audit log records.

Create `packages/enterprise-contracts/src/index.ts`:

```ts
export * from './schemas'
```

Modify root `package.json` to add:

```json
"@muon/enterprise-contracts": "workspace:*"
```

- [ ] **Step 4: Run contract tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/contracts.test.ts`

Expected: pass.

## Task 2: API Core, Repository, And Install Flow

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/http.ts`
- Create: `apps/api/src/repository.ts`
- Create: `apps/api/src/security/password.ts`
- Create: `apps/api/src/modules/audit/auditService.ts`
- Create: `apps/api/src/modules/install/installService.ts`
- Create: `apps/api/src/server.ts`
- Test: `tests/unit/enterprise/installService.test.ts`

- [ ] **Step 1: Write failing install service tests**

Create `tests/unit/enterprise/installService.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'

describe('install service', () => {
  it('creates the first organization and owner only once', async () => {
    const repository = createInMemoryEnterpriseRepository()
    const service = createInstallService({ repository })

    const result = await service.install({
      organizationName: 'Acme Research',
      organizationSlug: 'acme',
      ownerUsername: 'owner',
      ownerEmail: 'owner@acme.test',
      ownerDisplayName: 'Owner',
      ownerPassword: 'correct horse battery staple',
    })

    expect(result.organization.slug).toBe('acme')
    expect(result.owner.username).toBe('owner')
    expect(result.owner.roles).toContain('owner')

    await expect(service.install({
      organizationName: 'Second Org',
      organizationSlug: 'second',
      ownerUsername: 'owner2',
      ownerEmail: 'owner2@example.test',
      ownerDisplayName: 'Owner 2',
      ownerPassword: 'correct horse battery staple',
    })).rejects.toThrow('Muon is already installed')
  })
})
```

- [ ] **Step 2: Run install tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/installService.test.ts`

Expected: fail because API repository and install service do not exist.

- [ ] **Step 3: Implement repository and install service**

Implement:

- `createInMemoryEnterpriseRepository()` with maps for organizations, users, roles, sessions, codes, matrix accounts, and audit logs.
- `hashPassword()` and `verifyPassword()` using Node `crypto.scrypt` with versioned hash strings.
- `createInstallService()` that checks install status, creates organization, creates owner user, assigns `owner`, and appends an `install.completed` audit event.

- [ ] **Step 4: Run install tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/installService.test.ts`

Expected: pass.

## Task 3: Admin Auth, RBAC, Users, And Audit

**Files:**
- Create: `apps/api/src/modules/auth/adminSessionService.ts`
- Create: `apps/api/src/modules/users/userService.ts`
- Create: `apps/api/src/modules/users/rbac.ts`
- Test: `tests/unit/enterprise/adminUsers.test.ts`

- [ ] **Step 1: Write failing admin user tests**

Create `tests/unit/enterprise/adminUsers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createAdminSessionService } from '../../../apps/api/src/modules/auth/adminSessionService'
import { createUserService } from '../../../apps/api/src/modules/users/userService'

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
```

- [ ] **Step 2: Run admin tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/adminUsers.test.ts`

Expected: fail because admin session and user services do not exist.

- [ ] **Step 3: Implement admin auth, RBAC, and user service**

Implement:

- Admin login with organization slug, username, password.
- Session token creation and hashed refresh tokens.
- `assertAdmin()` accepting `owner` or `admin`.
- User creation, password reset, status update, role assignment, and audit events.

- [ ] **Step 4: Run admin tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/adminUsers.test.ts`

Expected: pass.

## Task 4: OAuth Code Flow And Matrix Provisioning

**Files:**
- Create: `apps/api/src/modules/oauth/oauthService.ts`
- Create: `apps/api/src/modules/matrix/provisioning.ts`
- Create: `apps/api/src/modules/matrix/conduitAdapter.ts`
- Test: `tests/unit/enterprise/oauthDesktopFlow.test.ts`

- [ ] **Step 1: Write failing desktop OAuth flow tests**

Create `tests/unit/enterprise/oauthDesktopFlow.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createOAuthService } from '../../../apps/api/src/modules/oauth/oauthService'

describe('desktop oauth flow', () => {
  it('exchanges a one-time code for muon and matrix sessions', async () => {
    const repository = createInMemoryEnterpriseRepository()
    await createInstallService({ repository }).install({
      organizationName: 'Acme Research',
      organizationSlug: 'acme',
      ownerUsername: 'owner',
      ownerEmail: 'owner@acme.test',
      ownerDisplayName: 'Owner',
      ownerPassword: 'correct horse battery staple',
    })

    const matrix = {
      ensureUser: vi.fn().mockResolvedValue({
        matrixUserId: '@owner:localhost',
        accessToken: 'matrix-token',
        deviceId: 'MUONDEVICE',
      }),
    }
    const oauth = createOAuthService({
      repository,
      matrix,
      matrixServerUrl: 'http://127.0.0.1:6167',
    })

    const authorization = await oauth.loginAndCreateCode({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
      clientId: 'muon-desktop',
      redirectUri: 'muon://auth/callback',
      codeChallenge: 'plain-challenge',
      state: 'state-1',
    })

    const token = await oauth.exchangeCode({
      code: authorization.code,
      codeVerifier: 'plain-challenge',
      redirectUri: 'muon://auth/callback',
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })

    expect(token.matrixSession).toEqual({
      serverUrl: 'http://127.0.0.1:6167',
      userId: '@owner:localhost',
      accessToken: 'matrix-token',
      deviceId: 'MUONDEVICE',
    })
    await expect(oauth.exchangeCode({
      code: authorization.code,
      codeVerifier: 'plain-challenge',
      redirectUri: 'muon://auth/callback',
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow('Authorization code has already been used')
  })
})
```

- [ ] **Step 2: Run OAuth tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/oauthDesktopFlow.test.ts`

Expected: fail because OAuth service does not exist.

- [ ] **Step 3: Implement OAuth and provisioning contracts**

Implement:

- Built-in `muon-desktop` OAuth client.
- Login validation against Muon users.
- PKCE plain/S256 helper.
- Hashed one-time authorization codes.
- Token exchange that creates a device session and returns Matrix session.
- `MatrixProvisioningAdapter` and a Conduit adapter shell that calls Matrix endpoints through fetch.

- [ ] **Step 4: Run OAuth tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/oauthDesktopFlow.test.ts`

Expected: pass.

## Task 5: HTTP API Routes

**Files:**
- Create: `apps/api/src/routes.ts`
- Modify: `apps/api/src/server.ts`
- Test: `tests/unit/enterprise/apiRoutes.test.ts`

- [ ] **Step 1: Write failing API route tests**

Create `tests/unit/enterprise/apiRoutes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEnterpriseHttpHandler } from '../../../apps/api/src/routes'

describe('enterprise api routes', () => {
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
})
```

- [ ] **Step 2: Run API route tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`

Expected: fail because route handler does not exist.

- [ ] **Step 3: Implement route handler**

Implement a small fetch-compatible router for:

- `GET /api/install/status`
- `POST /api/install`
- `POST /api/admin/login`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `GET /api/admin/audit-logs`
- `POST /api/oauth/login`
- `POST /api/oauth/token`

- [ ] **Step 4: Run API route tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/apiRoutes.test.ts`

Expected: pass.

## Task 6: Admin Web Skeleton

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/index.html`
- Create: `apps/admin/src/main.ts`
- Create: `apps/admin/src/AdminApp.vue`
- Create: `apps/admin/src/api.ts`
- Test: `tests/components/AdminApp.test.ts`

- [ ] **Step 1: Write failing Admin Web tests**

Create `tests/components/AdminApp.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminApp from '../../apps/admin/src/AdminApp.vue'

describe('AdminApp', () => {
  it('shows the install wizard when Muon is not installed', async () => {
    const wrapper = mount(AdminApp, {
      props: {
        initialInstalled: false,
      },
    })

    expect(wrapper.text()).toContain('创建组织')
    expect(wrapper.text()).toContain('超级管理员')
  })

  it('shows the user administration surface after install', async () => {
    const wrapper = mount(AdminApp, {
      props: {
        initialInstalled: true,
      },
    })

    expect(wrapper.text()).toContain('用户管理')
    expect(wrapper.text()).toContain('审计日志')
  })
})
```

- [ ] **Step 2: Run Admin Web tests to verify they fail**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`

Expected: fail because Admin app does not exist.

- [ ] **Step 3: Implement Admin Web skeleton**

Implement a standalone Vue app with install wizard fields, admin login form, user management panel, and audit log panel. Use Chinese UI copy and existing quiet workspace visual conventions without adding it to the Electron route tree.

- [ ] **Step 4: Run Admin Web tests to verify they pass**

Run: `pnpm vitest run tests/components/AdminApp.test.ts`

Expected: pass.

## Task 7: Electron Deeplink And Renderer Enterprise Login

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/env.d.ts`
- Modify: `src/matrix/auth.ts`
- Modify: `src/features/auth/components/LoginPage.vue`
- Test: `tests/unit/enterprise/deeplink.test.ts`
- Test: `tests/components/LoginPage.enterprise.test.ts`

- [ ] **Step 1: Write failing deeplink parser tests**

Create `tests/unit/enterprise/deeplink.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseEnterpriseAuthCallback } from '../../../src/matrix/auth'

describe('enterprise deeplink parsing', () => {
  it('accepts muon auth callback codes', () => {
    expect(parseEnterpriseAuthCallback('muon://auth/callback?code=abc&state=xyz')).toEqual({
      code: 'abc',
      state: 'xyz',
    })
  })

  it('rejects non-auth deeplinks', () => {
    expect(parseEnterpriseAuthCallback('muon://settings')).toBeNull()
  })
})
```

- [ ] **Step 2: Write failing LoginPage enterprise test**

Create `tests/components/LoginPage.enterprise.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LoginPage from '@/features/auth/components/LoginPage.vue'

vi.mock('@matrix/index', () => ({
  bindClientEvents: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  startEnterpriseLogin: vi.fn(),
  startSync: vi.fn(),
}))

describe('LoginPage enterprise login', () => {
  it('shows enterprise login when an API URL is configured', () => {
    vi.stubEnv('VITE_MUON_API_BASE_URL', 'http://127.0.0.1:8787')
    const wrapper = mount(LoginPage)

    expect(wrapper.text()).toContain('企业登录')
  })
})
```

- [ ] **Step 3: Run deeplink tests to verify they fail**

Run: `pnpm vitest run tests/unit/enterprise/deeplink.test.ts tests/components/LoginPage.enterprise.test.ts`

Expected: fail because parser and UI do not exist.

- [ ] **Step 4: Implement Electron and renderer flow**

Implement:

- Electron protocol registration and URL forwarding.
- Preload event subscription for `muon:auth-callback`.
- `parseEnterpriseAuthCallback()`.
- `startEnterpriseLogin()` that opens browser authorization.
- `completeEnterpriseLogin()` that exchanges code, persists `muon_auth`, binds events, and starts sync.
- Login page enterprise button when `VITE_MUON_API_BASE_URL` is set.

- [ ] **Step 5: Run deeplink tests to verify they pass**

Run: `pnpm vitest run tests/unit/enterprise/deeplink.test.ts tests/components/LoginPage.enterprise.test.ts`

Expected: pass.

## Task 8: Docker, Scripts, Docs, And Verification

**Files:**
- Modify: `docker/docker-compose.yml`
- Modify: `README.md`
- Modify: `package.json`
- Test: existing focused tests and broad repo checks.

- [ ] **Step 1: Add scripts**

Add root scripts:

```json
"dev": "bash scripts/dev-all.sh",
"dev:api": "pnpm --filter @muon/api dev",
"dev:admin": "pnpm --filter @muon/admin dev",
"build": "pnpm build:contracts && pnpm build:api && pnpm build:admin && pnpm build:desktop",
"build:contracts": "pnpm --filter @muon/enterprise-contracts build",
"build:api": "pnpm --filter @muon/api build",
"build:admin": "pnpm --filter @muon/admin build",
"test:enterprise": "vitest run tests/unit/enterprise tests/components/AdminApp.test.ts tests/components/LoginPage.enterprise.test.ts"
```

- [ ] **Step 2: Update Docker Compose**

Add `postgres`, `api`, and `admin` services with local development environment variables and links to existing Conduit.

- [ ] **Step 3: Update README**

Document enterprise development commands, Admin Web URL, API URL, and Electron enterprise login environment.

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm test:enterprise
pnpm vitest run tests/unit/matrix/auth.test.ts tests/components/LoginPage.auth-errors.test.ts tests/e2e/auth.spec.ts
```

Expected: all pass.

- [ ] **Step 5: Run broad verification**

Run:

```bash
pnpm type-check
pnpm lint
pnpm test:unit
pnpm build:web
git diff --check
```

Expected: all pass, or any unrelated pre-existing failures are documented with exact output.
