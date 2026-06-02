import type {
  ApprovalDecisionContract,
  ApprovalRecordContract,
  ApprovalStatusContract,
  ApprovalTemplate,
  CreateApprovalRequest,
} from '@muon/enterprise-contracts'
import type { ApiEffect } from '../../effect'
import { randomUUID } from 'node:crypto'
import { createApprovalRequestSchema } from '@muon/enterprise-contracts'
import { Effect } from 'effect'
import { fromPromise, fromSync } from '../../effect'
import { BUILT_IN_APPROVAL_TEMPLATES, findApprovalTemplate } from './approvalTemplates'

// 单一契约来源：类型定义在 @muon/enterprise-contracts，此处仅做本地别名
export type ApprovalStatus = ApprovalStatusContract
export type ApprovalDecision = ApprovalDecisionContract
export type ApprovalRecord = ApprovalRecordContract

const DEFAULT_STAGE = '审批'

export interface ApprovalStore {
  list: () => Promise<ApprovalRecord[]>
  get: (id: string) => Promise<ApprovalRecord | null>
  save: (record: ApprovalRecord) => Promise<ApprovalRecord>
}

/** 进程内审批仓储（开发/测试用;生产可替换为 postgres 实现,接口不变） */
export function createInMemoryApprovalStore(seed?: ApprovalRecord[]): ApprovalStore {
  const records = new Map<string, ApprovalRecord>()
  const initial = seed ?? [
    {
      id: 'request-1',
      title: '生产访问申请',
      requester: '工程团队',
      stages: ['主管审批', '安全复核'],
      currentStageIndex: 0,
      status: 'pending' as const,
      handler: '主管审批',
      comments: [],
    },
    {
      id: 'request-2',
      title: '上线预算调整',
      requester: '增长团队',
      stages: ['财务确认', '管理层审批'],
      currentStageIndex: 0,
      status: 'pending' as const,
      handler: '财务确认',
      comments: [],
    },
  ]
  for (const record of initial)
    records.set(record.id, { ...record, stages: [...record.stages], comments: [...record.comments] })

  return {
    list: () => Promise.resolve([...records.values()]),
    get: (id) => Promise.resolve(records.get(id) ?? null),
    save: (record) => {
      records.set(record.id, record)
      return Promise.resolve(record)
    },
  }
}

export class ApprovalNotFoundError extends Error {
  constructor(id: string) {
    super(`approval ${id} not found`)
  }
}

export interface ApprovalEffectService {
  list: () => ApiEffect<ApprovalRecord[]>
  listTemplates: () => ApiEffect<ApprovalTemplate[]>
  create: (input: CreateApprovalRequest) => ApiEffect<ApprovalRecord>
  decide: (id: string, decision: ApprovalDecision) => ApiEffect<ApprovalRecord>
  transfer: (id: string, handler: string) => ApiEffect<ApprovalRecord>
  comment: (id: string, comment: string) => ApiEffect<ApprovalRecord>
}

export function createApprovalEffectService({ store }: { store: ApprovalStore }): ApprovalEffectService {
  function load(id: string): ApiEffect<ApprovalRecord> {
    return Effect.gen(function* () {
      const record = yield* fromPromise(() => store.get(id))
      if (!record) return yield* Effect.fail(new ApprovalNotFoundError(id))
      return record
    })
  }

  return {
    list: () => fromPromise(() => store.list()),

    listTemplates: () => fromSync(() => BUILT_IN_APPROVAL_TEMPLATES),

    create(input) {
      return Effect.gen(function* () {
        const parsed = yield* fromSync(() => createApprovalRequestSchema.parse(input))
        const template = parsed.templateId ? findApprovalTemplate(parsed.templateId) : undefined
        // 审批链优先级：显式 stages > 模板 stages > 默认
        const stages =
          parsed.stages && parsed.stages.length > 0 ? parsed.stages : template ? template.stages : [DEFAULT_STAGE]
        const record: ApprovalRecord = {
          id: generateApprovalId(),
          title: parsed.title,
          requester: parsed.requester,
          stages,
          currentStageIndex: 0,
          status: 'pending',
          handler: stages[0]!,
          comments: [],
          ...(parsed.templateId ? { templateId: parsed.templateId } : {}),
          ...(parsed.formData ? { formData: parsed.formData } : {}),
        }
        return yield* fromPromise(() => store.save(record))
      })
    },

    decide(id, decision) {
      return Effect.gen(function* () {
        const record = yield* load(id)
        if (record.status !== 'pending') return record

        let next: ApprovalRecord
        if (decision === 'rejected') {
          next = { ...record, status: 'rejected', handler: '已退回' }
        } else if (record.currentStageIndex < record.stages.length - 1) {
          // 还有后续环节:推进到下一环节,整体仍在审批中
          const currentStageIndex = record.currentStageIndex + 1
          next = { ...record, currentStageIndex, handler: record.stages[currentStageIndex]! }
        } else {
          // 最后一环节通过:整体通过
          next = { ...record, status: 'approved', handler: '已归档' }
        }
        return yield* fromPromise(() => store.save(next))
      })
    },

    transfer(id, handler) {
      return Effect.gen(function* () {
        const cleaned = yield* fromSync(() => handler.trim())
        if (!cleaned) return yield* load(id)
        const record = yield* load(id)
        return yield* fromPromise(() => store.save({ ...record, handler: cleaned }))
      })
    },

    comment(id, comment) {
      return Effect.gen(function* () {
        const cleaned = yield* fromSync(() => comment.trim())
        const record = yield* load(id)
        if (!cleaned) return record
        return yield* fromPromise(() => store.save({ ...record, comments: [...record.comments, cleaned] }))
      })
    },
  }
}

export function generateApprovalId(): string {
  return `request-${randomUUID()}`
}
