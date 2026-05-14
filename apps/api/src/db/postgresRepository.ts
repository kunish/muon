import type { AuditLog, Organization } from '@muon/enterprise-contracts'
import type {
  AppendAuditLogInput,
  AuthorizationCodeRecord,
  CreateAuthorizationCodeInput,
  CreateDeviceSessionInput,
  CreateOrganizationInput,
  CreateUserInput,
  EnterpriseRepository,
  EnterpriseUserRecord,
  MatrixAccountRecord,
  ResetUserPasswordInput,
  UpdateUserInput,
} from '../repository'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

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
    roles: Array.isArray(row.roles) ? row.roles as EnterpriseUserRecord['roles'] : [],
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
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    createdAt: iso(row.created_at as string | Date),
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

export async function loadMigrationFiles(dirUrl: URL): Promise<MigrationFile[]> {
  const dirPath = fileURLToPath(dirUrl)
  const entries = await readdir(dirPath)
  const sqlFiles = entries.filter(entry => entry.endsWith('.sql')).sort()
  return Promise.all(sqlFiles.map(async (name) => {
    const sql = await readFile(new URL(name, dirUrl), 'utf8')
    return { name, sql }
  }))
}

export async function migratePostgres(pool: Pool): Promise<void> {
  const migrations = await loadMigrationFiles(new URL('./migrations/', import.meta.url))
  for (const migration of migrations)
    await pool.query(migration.sql)
}

export async function createPostgresEnterpriseRepository(databaseUrl: string): Promise<EnterpriseRepository> {
  const pool = new Pool({ connectionString: databaseUrl })
  await migratePostgres(pool)

  return {
    auditLogs: [],
    authorizationCodes: [],
    deviceSessions: [],
    matrixAccounts: [],
    organizations: [],
    users: [],

    async appendAuditLog(input: AppendAuditLogInput) {
      const result = await pool.query(
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
      )
      return auditLogFromRow(result.rows[0])
    },

    async createAuthorizationCode(input: CreateAuthorizationCodeInput) {
      const result = await pool.query(
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
      )
      return authorizationCodeFromRow(result.rows[0])
    },

    async createDeviceSession(input: CreateDeviceSessionInput) {
      const result = await pool.query(
        `INSERT INTO device_sessions (id, organization_id, user_id, device_name, access_token, refresh_token_hash, expires_at, revoked_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
         RETURNING *`,
        [
          randomUUID(),
          input.organizationId,
          input.userId,
          input.deviceName,
          input.accessToken,
          input.refreshTokenHash,
          input.expiresAt,
          nowIso(),
        ],
      )
      return {
        id: String(result.rows[0].id),
        organizationId: String(result.rows[0].organization_id),
        userId: String(result.rows[0].user_id),
        deviceName: String(result.rows[0].device_name),
        accessToken: String(result.rows[0].access_token),
        refreshTokenHash: String(result.rows[0].refresh_token_hash),
        expiresAt: iso(result.rows[0].expires_at),
        revokedAt: result.rows[0].revoked_at ? iso(result.rows[0].revoked_at) : null,
        createdAt: iso(result.rows[0].created_at),
      }
    },

    async createOrganization(input: CreateOrganizationInput) {
      const createdAt = nowIso()
      const result = await pool.query(
        `INSERT INTO organizations (id, slug, name, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING *`,
        [randomUUID(), input.slug, input.name, input.status ?? 'active', createdAt],
      )
      return organizationFromRow(result.rows[0])
    },

    async createUser(input: CreateUserInput) {
      const createdAt = nowIso()
      const result = await pool.query(
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
      )
      return userFromRow(result.rows[0])
    },

    async findAuthorizationCodeByHash(codeHash: string) {
      const result = await pool.query('SELECT * FROM oauth_authorization_codes WHERE code_hash = $1', [codeHash])
      return result.rows[0] ? authorizationCodeFromRow(result.rows[0]) : null
    },

    async findMatrixAccount(organizationId: string, userId: string) {
      const result = await pool.query('SELECT * FROM matrix_accounts WHERE organization_id = $1 AND user_id = $2', [organizationId, userId])
      return result.rows[0] ? matrixAccountFromRow(result.rows[0]) : null
    },

    async findOrganizationBySlug(slug: string) {
      const result = await pool.query('SELECT * FROM organizations WHERE slug = $1', [slug])
      return result.rows[0] ? organizationFromRow(result.rows[0]) : null
    },

    async findUserByUsername(organizationId: string, username: string) {
      const result = await pool.query('SELECT * FROM users WHERE organization_id = $1 AND username = $2', [organizationId, username])
      return result.rows[0] ? userFromRow(result.rows[0]) : null
    },

    getPublicUser(user) {
      const { passwordHash: _passwordHash, ...safeUser } = user
      return safeUser
    },

    async isInstalled() {
      const result = await pool.query('SELECT EXISTS (SELECT 1 FROM organizations) AS installed')
      return Boolean(result.rows[0]?.installed)
    },

    async listAuditLogsByOrganization(organizationId: string) {
      const result = await pool.query('SELECT * FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC', [organizationId])
      return result.rows.map(auditLogFromRow)
    },

    async listOrganizations() {
      const result = await pool.query('SELECT * FROM organizations ORDER BY created_at ASC')
      return result.rows.map(organizationFromRow)
    },

    async listUsersByOrganization(organizationId: string) {
      const result = await pool.query('SELECT * FROM users WHERE organization_id = $1 ORDER BY created_at ASC', [organizationId])
      return result.rows.map(userFromRow)
    },

    async markAuthorizationCodeUsed(id: string) {
      const result = await pool.query(
        'UPDATE oauth_authorization_codes SET used_at = $2 WHERE id = $1 RETURNING *',
        [id, nowIso()],
      )
      if (!result.rows[0])
        throw new Error('Authorization code not found')
      return authorizationCodeFromRow(result.rows[0])
    },

    async resetUserPassword(organizationId: string, userId: string, input: ResetUserPasswordInput) {
      const result = await pool.query(
        `UPDATE users
         SET password_hash = $3, must_change_password = $4, updated_at = $5
         WHERE organization_id = $1 AND id = $2
         RETURNING *`,
        [organizationId, userId, input.passwordHash, input.mustChangePassword, nowIso()],
      )
      if (!result.rows[0])
        throw new Error('User not found')
      return userFromRow(result.rows[0])
    },

    async updateUser(organizationId: string, userId: string, input: UpdateUserInput) {
      const result = await pool.query(
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
      )
      if (!result.rows[0])
        throw new Error('User not found')
      return userFromRow(result.rows[0])
    },

    async upsertMatrixAccount(input) {
      const result = await pool.query(
        `INSERT INTO matrix_accounts (organization_id, user_id, matrix_user_id, matrix_device_id, access_token, provisioning_status, last_provisioned_at)
         VALUES ($1, $2, $3, $4, $5, 'active', $6)
         ON CONFLICT (organization_id, user_id)
         DO UPDATE SET matrix_user_id = EXCLUDED.matrix_user_id,
           matrix_device_id = EXCLUDED.matrix_device_id,
           access_token = EXCLUDED.access_token,
           provisioning_status = 'active',
           last_provisioned_at = EXCLUDED.last_provisioned_at
         RETURNING *`,
        [
          input.organizationId,
          input.userId,
          input.matrixUserId,
          input.matrixDeviceId,
          input.accessToken,
          nowIso(),
        ],
      )
      return matrixAccountFromRow(result.rows[0])
    },
  }
}
