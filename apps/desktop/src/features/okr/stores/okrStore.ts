import type { KeyResult, KeyResultStatus, Objective, ObjectiveConfidence } from '../types/okr'
import { Store } from '@tanstack/vue-store'
import {
  generateKeyResultId,
  generateObjectiveId,
  isValidObjective,
  isValidPeriod,
  OKR_STORAGE_KEY,
} from '../types/okr'

interface PersistedOkrState {
  version: 1
  objectives: Objective[]
}

interface LoadedOkrState {
  objectives: Objective[]
  normalized: boolean
}

interface AddObjectiveInput {
  id?: string
  period: string
  title: string
  owner?: string
  confidence?: ObjectiveConfidence
  keyResults?: { title: string; progress?: number; status?: KeyResultStatus }[]
  now?: number
}

interface AddKeyResultInput {
  title: string
  progress?: number
  status?: KeyResultStatus
  now?: number
}

function normalizePersistedObjectives(objectives: unknown[]): LoadedOkrState {
  const deduped = new Map<string, Objective>()
  let normalized = false

  for (const objective of objectives) {
    if (!isValidObjective(objective)) {
      normalized = true
      continue
    }
    if (deduped.has(objective.id)) normalized = true
    deduped.set(objective.id, objective)
  }

  return { objectives: [...deduped.values()], normalized }
}

function loadState(): LoadedOkrState {
  try {
    const raw = localStorage.getItem(OKR_STORAGE_KEY)
    if (!raw) return { objectives: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedOkrState>
    if (parsed.version !== 1 || !Array.isArray(parsed.objectives)) return { objectives: [], normalized: false }

    return normalizePersistedObjectives(parsed.objectives)
  } catch {
    return { objectives: [], normalized: false }
  }
}

function persistObjectives(objectives: Objective[]): void {
  const payload: PersistedOkrState = { version: 1, objectives }
  try {
    localStorage.setItem(OKR_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[okrStore] Failed to persist objectives:', err)
  }
}

export interface OkrState {
  /** 用户创建的目标，持久化到 localStorage（version-1 信封）。 */
  objectives: Objective[]
  hydrated: boolean
}

function createInitialState(): OkrState {
  const { objectives, normalized } = loadState()
  // 加载时若丢弃了非法/重复目标，立即回写，使磁盘信封与内存快照一致。
  if (normalized) persistObjectives(objectives)
  return { objectives, hydrated: true }
}

export const okrStore = new Store<OkrState>(createInitialState())

/** 响应式读取目标列表 —— 消费方通过 `useSelector` 选用。 */
export function selectObjectives(state: OkrState): Objective[] {
  return state.objectives
}

/** 从 localStorage 重新读取目标到 store。 */
export function hydrate(): void {
  const { objectives, normalized } = loadState()
  okrStore.setState((s) => ({ ...s, objectives, hydrated: true }))
  if (normalized) persistObjectives(objectives)
}

function commit(objectives: Objective[]): void {
  okrStore.setState((s) => ({ ...s, objectives }))
  persistObjectives(okrStore.state.objectives)
}

export function addObjective(input: AddObjectiveInput): Objective {
  const title = input.title.trim()
  if (!title) throw new Error('Objective title is required')
  if (!isValidPeriod(input.period)) throw new Error('Invalid OKR period')

  const now = input.now ?? Date.now()
  const objective: Objective = {
    id: input.id ?? generateObjectiveId(now),
    period: input.period,
    title,
    owner: input.owner?.trim() || '我',
    confidence: input.confidence ?? 'medium',
    keyResults: (input.keyResults ?? [])
      .filter((kr) => kr.title.trim())
      .map((kr) => ({
        id: generateKeyResultId(now),
        title: kr.title.trim(),
        progress: clampProgress(kr.progress ?? 0),
        status: kr.status ?? 'on_track',
      })),
    createdAt: now,
  }

  if (!isValidObjective(objective)) throw new Error('Invalid objective')

  commit([objective, ...okrStore.state.objectives])
  return objective
}

export function updateObjective(id: string, patch: Partial<Pick<Objective, 'title' | 'owner' | 'period'>>): void {
  const next = okrStore.state.objectives.map((objective) =>
    objective.id === id
      ? {
          ...objective,
          ...(patch.title !== undefined ? { title: patch.title.trim() || objective.title } : {}),
          ...(patch.owner !== undefined ? { owner: patch.owner.trim() || objective.owner } : {}),
          ...(patch.period !== undefined && isValidPeriod(patch.period) ? { period: patch.period } : {}),
        }
      : objective,
  )
  commit(next)
}

export function removeObjective(id: string): void {
  const remaining = okrStore.state.objectives.filter((objective) => objective.id !== id)
  if (remaining.length === okrStore.state.objectives.length) return
  // 清理指向被删目标的对齐，避免悬挂引用
  const next = remaining.map((objective) => (objective.alignsTo === id ? stripAlignment(objective) : objective))
  commit(next)
}

function stripAlignment(objective: Objective): Objective {
  const { alignsTo: _omit, ...rest } = objective
  return rest
}

/** 设置目标对齐到的上级（传 null/空/自身即清除）；拒绝指向不存在的目标或形成环。 */
export function setAlignment(id: string, alignsTo: string | null): void {
  const objectives = okrStore.state.objectives
  const objective = objectives.find((item) => item.id === id)
  if (!objective) return

  if (!alignsTo || alignsTo === id) {
    if (objective.alignsTo === undefined) return
    commit(objectives.map((item) => (item.id === id ? stripAlignment(item) : item)))
    return
  }

  const byId = new Map(objectives.map((item) => [item.id, item]))
  if (!byId.has(alignsTo)) return

  // 防环：沿候选上级的对齐链上溯，若回到自身则拒绝
  let cursor: string | undefined = alignsTo
  for (let steps = 0; cursor && steps <= objectives.length; steps += 1) {
    if (cursor === id) return
    cursor = byId.get(cursor)?.alignsTo
  }

  commit(objectives.map((item) => (item.id === id ? { ...item, alignsTo } : item)))
}

export function setConfidence(id: string, confidence: ObjectiveConfidence): void {
  const next = okrStore.state.objectives.map((objective) =>
    objective.id === id ? { ...objective, confidence } : objective,
  )
  commit(next)
}

export function addKeyResult(objectiveId: string, input: AddKeyResultInput): void {
  const title = input.title.trim()
  if (!title) return
  const now = input.now ?? Date.now()
  const keyResult: KeyResult = {
    id: generateKeyResultId(now),
    title,
    progress: clampProgress(input.progress ?? 0),
    status: input.status ?? 'on_track',
  }
  const next = okrStore.state.objectives.map((objective) =>
    objective.id === objectiveId ? { ...objective, keyResults: [...objective.keyResults, keyResult] } : objective,
  )
  commit(next)
}

export function updateKeyResult(
  objectiveId: string,
  keyResultId: string,
  patch: Partial<Pick<KeyResult, 'title' | 'progress' | 'status'>>,
): void {
  const next = okrStore.state.objectives.map((objective) => {
    if (objective.id !== objectiveId) return objective
    return {
      ...objective,
      keyResults: objective.keyResults.map((kr) =>
        kr.id === keyResultId
          ? {
              ...kr,
              ...(patch.title !== undefined ? { title: patch.title.trim() || kr.title } : {}),
              ...(patch.progress !== undefined ? { progress: clampProgress(patch.progress) } : {}),
              ...(patch.status !== undefined ? { status: patch.status } : {}),
            }
          : kr,
      ),
    }
  })
  commit(next)
}

export function removeKeyResult(objectiveId: string, keyResultId: string): void {
  const next = okrStore.state.objectives.map((objective) =>
    objective.id === objectiveId
      ? { ...objective, keyResults: objective.keyResults.filter((kr) => kr.id !== keyResultId) }
      : objective,
  )
  commit(next)
}

/** 设置某个 KR 的完成度（0–100，越界自动夹取），并在达成 100% 时标记为已完成。 */
export function setKeyResultProgress(objectiveId: string, keyResultId: string, progress: number): void {
  const clamped = clampProgress(progress)
  const patch: Partial<Pick<KeyResult, 'title' | 'progress' | 'status'>> = { progress: clamped }
  if (clamped >= 100) patch.status = 'done'
  updateKeyResult(objectiveId, keyResultId, patch)
}

/** 一次 check-in：更新信心指数并记录备注（飞书周更 OKR 的核心动作）。 */
export function checkIn(objectiveId: string, confidence: ObjectiveConfidence, note: string): void {
  const trimmed = note.trim()
  const next = okrStore.state.objectives.map((objective) =>
    objective.id === objectiveId
      ? { ...objective, confidence, lastCheckIn: trimmed || objective.lastCheckIn }
      : objective,
  )
  commit(next)
}

/** 重置内存状态，从 localStorage 重新水合（createInitialState 会读取它）。 */
export function resetOkrStore(): void {
  okrStore.setState(() => createInitialState())
}

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}
