import type { Department } from '@muon/enterprise-contracts'
import type { DepartmentStore } from './departmentService'
import { Pool } from 'pg'
import { migratePostgres } from '../../db/postgresRepository'

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return new Date(String(value)).toISOString()
}

function departmentFromRow(row: Record<string, unknown>): Department {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    parentId: row.parent_id == null ? null : String(row.parent_id),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

/** Postgres 部门仓储。迁移幂等，可安全重复调用。 */
export async function createPostgresDepartmentStore(databaseUrl: string): Promise<DepartmentStore> {
  const pool = new Pool({ connectionString: databaseUrl })
  await migratePostgres(pool)

  return {
    async listByOrganization(organizationId) {
      const result = await pool.query('SELECT * FROM departments WHERE organization_id = $1 ORDER BY name ASC', [
        organizationId,
      ])
      return result.rows.map(departmentFromRow)
    },
    async get(id) {
      const result = await pool.query('SELECT * FROM departments WHERE id = $1', [id])
      return result.rows[0] ? departmentFromRow(result.rows[0]) : null
    },
    async save(department) {
      await pool.query(
        `INSERT INTO departments (id, organization_id, name, parent_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           parent_id = EXCLUDED.parent_id,
           updated_at = EXCLUDED.updated_at`,
        [
          department.id,
          department.organizationId,
          department.name,
          department.parentId,
          department.createdAt,
          department.updatedAt,
        ],
      )
      return department
    },
    async delete(id) {
      await pool.query('DELETE FROM departments WHERE id = $1', [id])
    },
  }
}
