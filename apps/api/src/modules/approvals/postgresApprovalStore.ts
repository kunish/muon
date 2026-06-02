import type { ApprovalRecord, ApprovalStatus, ApprovalStore } from './approvalService'
import { Pool } from 'pg'
import { migratePostgres } from '../../db/postgresRepository'

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : []
}

function approvalFromRow(row: Record<string, unknown>): ApprovalRecord {
  const record: ApprovalRecord = {
    id: String(row.id),
    title: String(row.title),
    requester: String(row.requester),
    stages: toStringArray(row.stages),
    currentStageIndex: Number(row.current_stage_index ?? 0),
    status: row.status as ApprovalStatus,
    handler: String(row.handler ?? ''),
    comments: toStringArray(row.comments),
  }
  if (row.template_id != null) record.templateId = String(row.template_id)
  if (row.form_data != null && typeof row.form_data === 'object') {
    record.formData = row.form_data as Record<string, unknown>
  }
  return record
}

/**
 * Postgres 审批仓储。与 {@link createInMemoryApprovalStore} 接口一致，但持久化、
 * 重启不丢、跨实例共享。迁移幂等，可安全重复调用。
 */
export async function createPostgresApprovalStore(databaseUrl: string): Promise<ApprovalStore> {
  const pool = new Pool({ connectionString: databaseUrl })
  await migratePostgres(pool)

  return {
    async list() {
      const result = await pool.query('SELECT * FROM approvals ORDER BY created_at DESC')
      return result.rows.map(approvalFromRow)
    },
    async get(id) {
      const result = await pool.query('SELECT * FROM approvals WHERE id = $1', [id])
      return result.rows[0] ? approvalFromRow(result.rows[0]) : null
    },
    async save(record) {
      await pool.query(
        `INSERT INTO approvals
           (id, title, requester, stages, current_stage_index, status, handler, comments, template_id, form_data, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9, $10::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           requester = EXCLUDED.requester,
           stages = EXCLUDED.stages,
           current_stage_index = EXCLUDED.current_stage_index,
           status = EXCLUDED.status,
           handler = EXCLUDED.handler,
           comments = EXCLUDED.comments,
           template_id = EXCLUDED.template_id,
           form_data = EXCLUDED.form_data,
           updated_at = now()`,
        [
          record.id,
          record.title,
          record.requester,
          JSON.stringify(record.stages),
          record.currentStageIndex,
          record.status,
          record.handler,
          JSON.stringify(record.comments),
          record.templateId ?? null,
          record.formData ? JSON.stringify(record.formData) : null,
        ],
      )
      return record
    },
  }
}
