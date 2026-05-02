# Muon Enterprise Auth And Admin Design

Date: 2026-05-02

## Goal

Add a production-oriented enterprise layer to Muon inside the current repository:

- A TypeScript API service owned by Muon.
- A separate Admin Web console.
- Organization, user, role, session, and audit management.
- Muon-managed OAuth/OIDC style login for the desktop client.
- Electron-only deeplink login through `muon://auth/callback`.
- Matrix account provisioning through an adapter interface, with Conduit implemented first.

The first version does not integrate third-party identity providers. Muon is the identity provider.

## Chosen Scope

- Repository layout: keep everything in this repo.
- Backend: new TypeScript API app.
- Admin UI: independent Vite app, not embedded in the Electron workspace.
- Storage: Postgres with migrations.
- Initialization: first-visit install wizard creates the first organization and owner.
- Users: administrators manually create users and set initial passwords.
- Client login: Electron desktop only.
- Matrix provisioning: abstract interface, Conduit adapter in the first version.
- SSO protocol: OAuth/OIDC-shaped authorization code flow for Muon desktop, backed by Muon's own identity store.

## Out Of Scope For The First Version

- Third-party IdP templates such as Google Workspace, Azure AD, Okta, Authing, or SAML.
- Email invitation flows.
- Self-service public registration.
- Browser Web client SSO login.
- Full SCIM lifecycle sync.
- Multi-homeserver UI management beyond the adapter boundary.
- Passwordless, passkey, or MFA.

## Repository Layout

```text
apps/
  api/
    src/
      modules/
        audit/
        auth/
        install/
        matrix/
        oauth/
        organizations/
        users/
      db/
        migrations/
        schema.ts
      server.ts
  admin/
    src/
      app/
      features/
        install/
        login/
        organizations/
        users/
        audit/
packages/
  enterprise-contracts/
    src/
      api.ts
      auth.ts
      organization.ts
      user.ts
```

`apps/api` owns persistence and security decisions. `apps/admin` only calls the API. `packages/enterprise-contracts` contains shared request and response schemas used by API, Admin Web, and the Electron renderer.

## Backend Service

The API service exposes JSON HTTP endpoints under `/api`. It uses Postgres for durable data and a migration runner for schema changes. Runtime configuration comes from environment variables and Docker Compose:

- `MUON_API_BASE_URL`
- `MUON_ADMIN_BASE_URL`
- `MUON_DATABASE_URL`
- `MUON_SESSION_SECRET`
- `MUON_MATRIX_ADAPTER=conduit`
- `MUON_MATRIX_SERVER_URL`
- `MUON_MATRIX_ADMIN_TOKEN` or equivalent adapter credential

The API service is responsible for:

- Install state.
- Admin authentication.
- Organization and user management.
- Password hashing and validation.
- OAuth authorization code issuance and token exchange.
- Deeplink callback validation.
- Matrix account provisioning.
- Audit logging.

## Admin Web

The Admin Web console is a separate Vite app. It supports:

- First-run install wizard.
- Admin login.
- Organization overview.
- User list and user creation.
- Initial password setting and password reset.
- Role assignment for `owner`, `admin`, and `member`.
- Audit log list.

The install wizard is available only while no organization exists. Once installation completes, the install endpoint rejects further attempts.

## Data Model

### organizations

- `id`
- `slug`
- `name`
- `status`: `active`, `suspended`
- `created_at`
- `updated_at`

### users

- `id`
- `organization_id`
- `username`
- `email`
- `display_name`
- `password_hash`
- `status`: `active`, `disabled`
- `must_change_password`
- `created_at`
- `updated_at`

The unique identity constraint is `(organization_id, username)`.

### roles and user_roles

Built-in roles:

- `owner`: full organization administration.
- `admin`: user management and audit access.
- `member`: desktop login only.

Every admin endpoint checks both organization membership and role.

### oauth_clients

The first client is `muon-desktop`. It has:

- `client_id`
- `name`
- `redirect_uri`: `muon://auth/callback`
- `status`

### oauth_authorization_codes

Authorization codes are short lived and one-time use:

- `code_hash`
- `organization_id`
- `user_id`
- `client_id`
- `redirect_uri`
- `code_challenge`
- `expires_at`
- `used_at`

### device_sessions

Muon API sessions for desktop devices:

- `id`
- `organization_id`
- `user_id`
- `device_name`
- `refresh_token_hash`
- `expires_at`
- `revoked_at`

### matrix_accounts

Maps a Muon user to a Matrix account:

- `organization_id`
- `user_id`
- `matrix_user_id`
- `matrix_device_id`
- `provisioning_status`
- `last_provisioned_at`

Matrix access tokens should be returned during login exchange but not stored as plaintext long term unless an adapter requires it. If storage becomes necessary, encrypt at rest with an application secret.

### audit_logs

Append-only audit events:

- `organization_id`
- `actor_user_id`
- `action`
- `target_type`
- `target_id`
- `metadata`
- `ip_address`
- `user_agent`
- `created_at`

Audited actions include install, admin login, user creation, password reset, role changes, desktop login, Matrix provisioning, session revocation, and failed sensitive operations.

## Auth And Login Flow

### Admin Login

Admin Web posts username, password, and organization slug to the API. The API validates credentials, checks the user has `owner` or `admin`, creates an HTTP-only admin session, and writes an audit event.

### Desktop Login

1. Electron login page calls `/api/oauth/authorize-url` or builds an authorization URL for `muon-desktop`.
2. Electron opens the system browser.
3. Browser shows Muon login page hosted by the API.
4. User enters organization, username, and password.
5. API validates credentials and checks the user is active.
6. API provisions or verifies the user's Matrix account through the Matrix adapter.
7. API creates a one-time authorization code.
8. Browser redirects to `muon://auth/callback?code=...&state=...`.
9. Electron receives the deeplink and calls `/api/oauth/token` with the code and PKCE verifier.
10. API marks the code used and returns:
    - Muon API session.
    - Matrix `serverUrl`, `userId`, `accessToken`, and `deviceId`.
11. Electron persists Matrix data in the existing `muon_auth` format and starts the existing Matrix sync.

The existing password login UI remains as a fallback only if enterprise auth is not configured.

## Electron Deeplink Handling

Electron registers `muon://` as the protocol in development and packaged builds. Main process handling must cover:

- App already running: `second-instance` receives the deeplink.
- App closed: OS launches the app with the deeplink.
- macOS: `open-url` event.

The main process forwards validated auth callback URLs to the renderer through the preload bridge. The renderer exchanges the code through the API and never trusts data embedded directly in the deeplink beyond `code` and `state`.

## Matrix Provisioning

The API defines:

```ts
interface MatrixProvisioningAdapter {
  ensureUser(input: {
    organizationSlug: string
    username: string
    displayName: string
  }): Promise<{
    matrixUserId: string
    accessToken: string
    deviceId: string
  }>
}
```

The Conduit adapter is the first implementation. It creates or ensures a Matrix user and returns credentials that the desktop client can use. The adapter boundary keeps homeserver-specific details out of OAuth, users, and Admin Web modules.

## Security Rules

- Passwords use Argon2id.
- Authorization codes are hashed at rest.
- Refresh tokens are hashed at rest.
- Desktop flow uses `state` and PKCE.
- Admin session cookies are HTTP-only, secure in production, and same-site.
- All admin endpoints require organization and role checks.
- Install endpoint is disabled after first organization creation.
- Audit logs are append-only.
- Failed login attempts are rate-limited by organization, username, and IP.
- Deeplink code lifetime is short, expected under five minutes.

## API Surface

Initial endpoints:

- `GET /api/install/status`
- `POST /api/install`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/organization`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-password`
- `GET /api/admin/audit-logs`
- `GET /api/oauth/authorize`
- `POST /api/oauth/login`
- `POST /api/oauth/token`
- `POST /api/oauth/refresh`
- `POST /api/oauth/revoke`

## Testing Strategy

Unit tests:

- Password hashing and verification.
- Role authorization.
- Install guard.
- Authorization code expiry and one-time use.
- PKCE validation.
- Audit event creation.
- Matrix provisioning adapter contract.

Integration tests:

- Install wizard creates organization and owner.
- Admin creates member with initial password.
- Desktop OAuth login provisions Matrix account.
- Deeplink code exchange writes Matrix session payload shape compatible with `muon_auth`.
- Used or expired code is rejected.

Client tests:

- Electron auth callback parser.
- Login page opens enterprise auth URL when configured.
- Existing Matrix password login fallback still works when enterprise auth is disabled.

Verification commands should include targeted Vitest runs, API tests, `pnpm type-check`, `pnpm lint`, `pnpm test:unit`, and `pnpm build:web` or equivalent new app builds.

## Deployment

Docker Compose should add:

- `api`
- `admin`
- `postgres`

Existing services remain:

- `conduit`
- `livekit`
- `minio`

Development scripts should include:

- `pnpm dev`
- `pnpm dev:api`
- `pnpm dev:admin`
- `pnpm build`
- `pnpm build:contracts`
- `pnpm build:api`
- `pnpm build:admin`
- `pnpm services:up`
- `pnpm test:enterprise`

## Implementation Sequence

1. Add workspace app structure and shared enterprise contracts.
2. Add API service skeleton, health check, config, and test setup.
3. Add Postgres schema and migrations.
4. Implement install wizard API and Admin Web install screen.
5. Implement admin login/session and RBAC.
6. Implement user management.
7. Implement audit logging.
8. Implement OAuth authorization code flow with PKCE.
9. Implement Matrix provisioning interface and Conduit adapter.
10. Implement Electron protocol/deeplink handling.
11. Implement renderer enterprise login flow and Matrix session persistence.
12. Update Docker Compose, README, and verification coverage.
