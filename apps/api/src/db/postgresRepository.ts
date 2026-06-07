import type { AuditLog, Organization } from '@muon/enterprise-contracts'
import type {
  AdminSessionRecord,
  AppendAuditLogInput,
  AuthorizationCodeRecord,
  CreateAdminSessionInput,
  CreateAuthorizationCodeInput,
  CreateDeviceSessionInput,
  CreateOrganizationInput,
  CreateUserInput,
  DeviceSessionRecord,
  EnterpriseRepository,
  EnterpriseUserRecord,
  MatrixAccountRecord,
  ResetUserPasswordInput,
  UpdateUserInput,
} from '../repository'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { Pool } from 'pg'
import { fromPromise, runApiEffect } from '../effect'

function nowIso(): string {
  return new Date().toISOString()
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function organizationFromRow(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    status: row.status as Organization['status'],
    createdAt: iso(row.created_at as string | Date),
    updatedAt: iso(row.updated_at as string | Date),
  }
}

function userFromRow(row: Record<string, unknown>): EnterpriseUserRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    username: String(row.username),
    email: String(row.email),
    displayName: String(row.display_name),
    passwordHash: String(row.password_hash),
    status: row.status as EnterpriseUserRecord['status'],
    mustChangePassword: Boolean(row.must_change_password),
    roles: Array.isArray(row.roles) ? (row.roles as EnterpriseUserRecord['roles']) : [],
    createdAt: iso(row.created_at as string | Date),
    updatedAt: iso(row.updated_at as string | Date),
  }
}

function auditLogFromRow(row: Record<string, unknown>): AuditLog {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    action: String(row.action),
    targetType: String(row.target_type),
    targetId: row.target_id ? String(row.target_id) : null,
    metadata: row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {},
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    createdAt: iso(row.created_at as string | Date),
  }
}

function adminSessionFromRow(row: Record<string, unknown>): AdminSessionRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    accessTokenHash: String(row.access_token_hash),
    refreshTokenHash: String(row.refresh_token_hash),
    expiresAt: iso(row.expires_at as string | Date),
    revokedAt: row.revoked_at ? iso(row.revoked_at as string | Date) : null,
    createdAt: iso(row.created_at as string | Date),
    lastSeenAt: iso(row.last_seen_at as string | Date),
  }
}

function authorizationCodeFromRow(row: Record<string, unknown>): AuthorizationCodeRecord {
  return {
    id: String(row.id),
    codeHash: String(row.code_hash),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    clientId: String(row.client_id),
    redirectUri: String(row.redirect_uri),
    codeChallenge: String(row.code_challenge),
    codeChallengeMethod: row.code_challenge_method as AuthorizationCodeRecord['codeChallengeMethod'],
    matrixSession: row.matrix_session as AuthorizationCodeRecord['matrixSession'],
    expiresAt: iso(row.expires_at as string | Date),
    usedAt: row.used_at ? iso(row.used_at as string | Date) : null,
    createdAt: iso(row.created_at as string | Date),
  }
}

function deviceSessionFromRow(row: Record<string, unknown>): DeviceSessionRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    deviceName: String(row.device_name),
    accessTokenHash: String(row.access_token_hash),
    refreshTokenHash: String(row.refresh_token_hash),
    expiresAt: iso(row.expires_at as string | Date),
    revokedAt: row.revoked_at ? iso(row.revoked_at as string | Date) : null,
    createdAt: iso(row.created_at as string | Date),
  }
}

function matrixAccountFromRow(row: Record<string, unknown>): MatrixAccountRecord {
  return {
    organizationId: String(row.organization_id),
    userId: String(row.user_id),
    matrixUserId: String(row.matrix_user_id),
    matrixDeviceId: String(row.matrix_device_id),
    accessToken: String(row.access_token),
    provisioningStatus: row.provisioning_status as MatrixAccountRecord['provisioningStatus'],
    lastProvisionedAt: iso(row.last_provisioned_at as string | Date),
  }
}

export interface MigrationFile {
  name: string
  sql: string
}

export function loadMigrationFilesEffect(dirUrl: URL) {
  return Effect.gen(function* () {
    const dirPath = fileURLToPath(dirUrl)
    const entries = yield* fromPromise(() => readdir(dirPath))
    const sqlFiles = entries.filter((entry) => entry.endsWith('.sql')).sort()
    return yield* fromPromise(() =>
      Promise.all(
        sqlFiles.map((name) =>
          readFile(new URL(name, dirUrl), 'utf8').then((sql) => ({
            name,
            sql,
          })),
        ),
      ),
    )
  })
}

export function loadMigrationFiles(dirUrl: URL): Promise<MigrationFile[]> {
  return runApiEffect(loadMigrationFilesEffect(dirUrl))
}

export function migratePostgresEffect(pool: Pool) {
  return Effect.gen(function* () {
    const migrations = yield* loadMigrationFilesEffect(new URL('./migrations/', import.meta.url))
    for (const migration of migrations) yield* fromPromise(() => pool.query(migration.sql))
  })
}

export function migratePostgres(pool: Pool): Promise<void> {
  return runApiEffect(migratePostgresEffect(pool))
}

export function createPostgresEnterpriseRepositoryEffect(databaseUrl: string) {
  return Effect.gen(function* () {
    const pool = new Pool({ connectionString: databaseUrl })
    yield* migratePostgresEffect(pool)
    const query = (text: string, values?: unknown[]) => runApiEffect(fromPromise(() => pool.query(text, values)))

    return {
      adminSessions: [],
      auditLogs: [],
      authorizationCodes: [],
      deviceSessions: [],
      matrixAccounts: [],
      organizations: [],
      users: [],

      createAdminSession(input: CreateAdminSessionInput) {
        const createdAt = nowIso()
        return query(
          `INSERT INTO admin_sessions
           (id, organization_id, user_id, access_token_hash, refresh_token_hash, expires_at, revoked_at, created_at, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $7)
         RETURNING *`,
          [
            randomUUID(),
            input.organizationId,
            input.userId,
            input.accessTokenHash,
            input.refreshTokenHash,
            input.expiresAt,
            createdAt,
          ],
        ).then((result) => adminSessionFromRow(result.rows[0]))
      },

      appendAuditLog(input: AppendAuditLogInput) {
        return query(
          `INSERT INTO audit_logs (id, organization_id, actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
          [
            randomUUID(),
            input.organizationId,
            input.actorUserId,
            input.action,
            input.targetType,
            input.targetId ?? null,
            input.metadata ?? {},
            input.ipAddress ?? null,
            input.userAgent ?? null,
            nowIso(),
          ],
        ).then((result) => auditLogFromRow(result.rows[0]))
      },

      createAuthorizationCode(input: CreateAuthorizationCodeInput) {
        return query(
          `INSERT INTO oauth_authorization_codes (id, code_hash, organization_id, user_id, client_id, redirect_uri, code_challenge, code_challenge_method, matrix_session, expires_at, used_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, $11)
         RETURNING *`,
          [
            randomUUID(),
            input.codeHash,
            input.organizationId,
            input.userId,
            input.clientId,
            input.redirectUri,
            input.codeChallenge,
            input.codeChallengeMethod,
            input.matrixSession,
            input.expiresAt,
            nowIso(),
          ],
        ).then((result) => authorizationCodeFromRow(result.rows[0]))
      },

      createDeviceSession(input: CreateDeviceSessionInput) {
        return query(
          `INSERT INTO device_sessions (id, organization_id, user_id, device_name, access_token_hash, refresh_token_hash, expires_at, revoked_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
         RETURNING *`,
          [
            randomUUID(),
            input.organizationId,
            input.userId,
            input.deviceName,
            input.accessTokenHash,
            input.refreshTokenHash,
            input.expiresAt,
            nowIso(),
          ],
        ).then((result) => deviceSessionFromRow(result.rows[0]))
      },

      createOrganization(input: CreateOrganizationInput) {
        const createdAt = nowIso()
        return query(
          `INSERT INTO organizations (id, slug, name, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING *`,
          [randomUUID(), input.slug, input.name, input.status ?? 'active', createdAt],
        ).then((result) => organizationFromRow(result.rows[0]))
      },

      createUser(input: CreateUserInput) {
        const createdAt = nowIso()
        return query(
          `INSERT INTO users (id, organization_id, username, email, display_name, password_hash, status, must_change_password, roles, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
         RETURNING *`,
          [
            randomUUID(),
            input.organizationId,
            input.username,
            input.email,
            input.displayName,
            input.passwordHash,
            input.status,
            input.mustChangePassword,
            input.roles,
            createdAt,
          ],
        ).then((result) => userFromRow(result.rows[0]))
      },

      findActiveDeviceSessionsByUser(organizationId: string, userId: string) {
        return query(
          `SELECT * FROM device_sessions
          WHERE organization_id = $1
            AND user_id = $2
            AND revoked_at IS NULL
            AND expires_at > NOW()
          ORDER BY created_at DESC`,
          [organizationId, userId],
        ).then((result) => result.rows.map(deviceSessionFromRow))
      },

      findAdminSessionByTokenHash(accessTokenHash: string) {
        return query('SELECT * FROM admin_sessions WHERE access_token_hash = $1', [accessTokenHash]).then((result) =>
          result.rows[0] ? adminSessionFromRow(result.rows[0]) : null,
        )
      },

      findAuthorizationCodeByHash(codeHash: string) {
        return query('SELECT * FROM oauth_authorization_codes WHERE code_hash = $1', [codeHash]).then((result) =>
          result.rows[0] ? authorizationCodeFromRow(result.rows[0]) : null,
        )
      },

      findDeviceSessionById(id: string) {
        return query('SELECT * FROM device_sessions WHERE id = $1', [id]).then((result) =>
          result.rows[0] ? deviceSessionFromRow(result.rows[0]) : null,
        )
      },

      findDeviceSessionByRefreshTokenHash(refreshTokenHash: string) {
        return query('SELECT * FROM device_sessions WHERE refresh_token_hash = $1', [refreshTokenHash]).then((result) =>
          result.rows[0] ? deviceSessionFromRow(result.rows[0]) : null,
        )
      },

      findMatrixAccount(organizationId: string, userId: string) {
        return query('SELECT * FROM matrix_accounts WHERE organization_id = $1 AND user_id = $2', [
          organizationId,
          userId,
        ]).then((result) => (result.rows[0] ? matrixAccountFromRow(result.rows[0]) : null))
      },

      findOrganizationBySlug(slug: string) {
        return query('SELECT * FROM organizations WHERE slug = $1', [slug]).then((result) =>
          result.rows[0] ? organizationFromRow(result.rows[0]) : null,
        )
      },

      findUserById(organizationId: string, userId: string) {
        return query('SELECT * FROM users WHERE organization_id = $1 AND id = $2', [organizationId, userId]).then(
          (result) => (result.rows[0] ? userFromRow(result.rows[0]) : null),
        )
      },

      findUserByUsername(organizationId: string, username: string) {
        return query('SELECT * FROM users WHERE organization_id = $1 AND username = $2', [
          organizationId,
          username,
        ]).then((result) => (result.rows[0] ? userFromRow(result.rows[0]) : null))
      },

      getPublicUser(user) {
        const { passwordHash: _passwordHash, ...safeUser } = user
        return safeUser
      },

      isInstalled() {
        return query('SELECT EXISTS (SELECT 1 FROM organizations) AS installed').then((result) =>
          Boolean(result.rows[0]?.installed),
        )
      },

      listAuditLogsByOrganization(organizationId: string) {
        return query('SELECT * FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC', [
          organizationId,
        ]).then((result) => result.rows.map(auditLogFromRow))
      },

      listOrganizations() {
        return query('SELECT * FROM organizations ORDER BY created_at ASC').then((result) =>
          result.rows.map(organizationFromRow),
        )
      },

      listUsersByOrganization(organizationId: string) {
        return query('SELECT * FROM users WHERE organization_id = $1 ORDER BY created_at ASC', [organizationId]).then(
          (result) => result.rows.map(userFromRow),
        )
      },

      markAuthorizationCodeUsed(id: string) {
        return query('UPDATE oauth_authorization_codes SET used_at = $2 WHERE id = $1 RETURNING *', [
          id,
          nowIso(),
        ]).then((result) => {
          if (!result.rows[0]) throw new Error('Authorization code not found')
          return authorizationCodeFromRow(result.rows[0])
        })
      },

      revokeAdminSession(id: string) {
        return query('UPDATE admin_sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE id = $1', [
          id,
          nowIso(),
        ]).then(() => undefined)
      },

      revokeDeviceSession(id: string) {
        return query(
          'UPDATE device_sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE id = $1 AND revoked_at IS NULL RETURNING id',
          [id, nowIso()],
        ).then((result) => (result.rowCount ?? 0) > 0)
      },

      revokeAllAdminSessionsForUserExcept(organizationId: string, userId: string, exceptSessionId: string) {
        return query(
          `UPDATE admin_sessions
            SET revoked_at = $4
          WHERE organization_id = $1
            AND user_id = $2
            AND id <> $3
            AND revoked_at IS NULL`,
          [organizationId, userId, exceptSessionId, nowIso()],
        ).then(() => undefined)
      },

      resetUserPassword(organizationId: string, userId: string, input: ResetUserPasswordInput) {
        return query(
          `UPDATE users
         SET password_hash = $3, must_change_password = $4, updated_at = $5
         WHERE organization_id = $1 AND id = $2
         RETURNING *`,
          [organizationId, userId, input.passwordHash, input.mustChangePassword, nowIso()],
        ).then((result) => {
          if (!result.rows[0]) throw new Error('User not found')
          return userFromRow(result.rows[0])
        })
      },

      touchAdminSession(id: string) {
        return query('UPDATE admin_sessions SET last_seen_at = $2 WHERE id = $1', [id, nowIso()]).then(() => undefined)
      },

      updateUser(organizationId: string, userId: string, input: UpdateUserInput) {
        return query(
          `UPDATE users
         SET username = COALESCE($3, username),
           email = COALESCE($4, email),
           display_name = COALESCE($5, display_name),
           status = COALESCE($6, status),
           roles = COALESCE($7, roles),
           updated_at = $8
         WHERE organization_id = $1 AND id = $2
         RETURNING *`,
          [
            organizationId,
            userId,
            input.username ?? null,
            input.email ?? null,
            input.displayName ?? null,
            input.status ?? null,
            input.roles ?? null,
            nowIso(),
          ],
        ).then((result) => {
          if (!result.rows[0]) throw new Error('User not found')
          return userFromRow(result.rows[0])
        })
      },

      upsertMatrixAccount(input) {
        return query(
          `INSERT INTO matrix_accounts (organization_id, user_id, matrix_user_id, matrix_device_id, access_token, provisioning_status, last_provisioned_at)
         VALUES ($1, $2, $3, $4, $5, 'active', $6)
         ON CONFLICT (organization_id, user_id)
         DO UPDATE SET matrix_user_id = EXCLUDED.matrix_user_id,
           matrix_device_id = EXCLUDED.matrix_device_id,
           access_token = EXCLUDED.access_token,
           provisioning_status = 'active',
           last_provisioned_at = EXCLUDED.last_provisioned_at
         RETURNING *`,
          [input.organizationId, input.userId, input.matrixUserId, input.matrixDeviceId, input.accessToken, nowIso()],
        ).then((result) => matrixAccountFromRow(result.rows[0]))
      },
    } satisfies EnterpriseRepository
  })
}

export function createPostgresEnterpriseRepository(databaseUrl: string): Promise<EnterpriseRepository> {
  return runApiEffect(createPostgresEnterpriseRepositoryEffect(databaseUrl))
}
