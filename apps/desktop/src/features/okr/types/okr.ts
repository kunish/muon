export const OKR_STORAGE_KEY = 'muon.okr.objectives.v1'

/** 目标信心指数：高 / 中 / 低（check-in 时由负责人主观评估） */
export type ObjectiveConfidence = 'high' | 'medium' | 'low'

/** 关键结果状态：正常 / 有风险 / 滞后 / 已完成 */
export type KeyResultStatus = 'on_track' | 'at_risk' | 'behind' | 'done'

export interface KeyResult {
  id: string
  title: string
  /** 完成度 0–100 */
  progress: number
  status: KeyResultStatus
}

export interface Objective {
  id: string
  /** 周期，形如 2026-Q2 */
  period: string
  title: string
  /** 负责人，默认「我」 */
  owner: string
  confidence: ObjectiveConfidence
  keyResults: KeyResult[]
  /** 最近一次 check-in 备注 */
  lastCheckIn?: string
  /** 对齐到的上级目标 id（目标级联对齐）；不设则为顶层目标 */
  alignsTo?: string
  /** 创建时间戳（毫秒），用于稳定排序 */
  createdAt: number
}

export const OBJECTIVE_CONFIDENCES: readonly ObjectiveConfidence[] = ['high', 'medium', 'low']
export const KEY_RESULT_STATUSES: readonly KeyResultStatus[] = ['on_track', 'at_risk', 'behind', 'done']

const PERIOD_RE = /^\d{4}-Q[1-4]$/

function isValidKeyResult(value: unknown): value is KeyResult {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<KeyResult>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.title === 'string' &&
    typeof candidate.progress === 'number' &&
    candidate.progress >= 0 &&
    candidate.progress <= 100 &&
    typeof candidate.status === 'string' &&
    KEY_RESULT_STATUSES.includes(candidate.status as KeyResultStatus)
  )
}

export function isValidObjective(value: unknown): value is Objective {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Objective>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.period === 'string' &&
    PERIOD_RE.test(candidate.period) &&
    typeof candidate.title === 'string' &&
    typeof candidate.owner === 'string' &&
    typeof candidate.confidence === 'string' &&
    OBJECTIVE_CONFIDENCES.includes(candidate.confidence as ObjectiveConfidence) &&
    Array.isArray(candidate.keyResults) &&
    candidate.keyResults.every(isValidKeyResult) &&
    (candidate.lastCheckIn === undefined || typeof candidate.lastCheckIn === 'string') &&
    (candidate.alignsTo === undefined || typeof candidate.alignsTo === 'string') &&
    typeof candidate.createdAt === 'number'
  )
}

export function isValidPeriod(value: string): boolean {
  return PERIOD_RE.test(value)
}

/** 目标整体进度 = 各 KR 进度的算术平均（四舍五入），无 KR 时为 0。 */
export function objectiveProgress(objective: Objective): number {
  if (objective.keyResults.length === 0) return 0
  const total = objective.keyResults.reduce((sum, kr) => sum + kr.progress, 0)
  return Math.round(total / objective.keyResults.length)
}

/** 当前自然季度对应的周期标识，形如 2026-Q2。 */
export function currentPeriod(now: number): string {
  const date = new Date(now)
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `${date.getFullYear()}-Q${quarter}`
}

export function generateObjectiveId(now: number): string {
  const suffix = Math.random().toString(36).slice(2, 10)
  return `objective:${now}:${suffix}`
}

export function generateKeyResultId(now: number): string {
  const suffix = Math.random().toString(36).slice(2, 10)
  return `kr:${now}:${suffix}`
}
