import type { TaskItem, TaskSourceRef, TaskStatus } from '../types/task'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Store } from '@tanstack/vue-store'
import { Effect } from 'effect'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'
import { canTransitionTaskStatus, createTaskItem, TASK_STORAGE_KEY } from '../types/task'

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

interface PersistedTaskState {
  version: 1
  items: TaskItem[]
}

interface LoadedTaskState {
  items: TaskItem[]
  normalized: boolean
}

// ---------------------------------------------------------------------------
// Public input types
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  id?: string
  title: string
  assignee: string
  dueAt: number | string
  status?: TaskStatus
  sourceRef: TaskSourceRef
  now?: number
}

export interface UpdateTaskInput {
  title?: string
  assignee?: string
  dueAt?: number | string
}

// ---------------------------------------------------------------------------
// Validation helpers (kept exactly as before)
// ---------------------------------------------------------------------------

function isValidTaskStatus(status: unknown): status is TaskStatus {
  return status === 'todo' || status === 'doing' || status === 'done'
}

function isValidTaskSourceRef(sourceRef: unknown): sourceRef is TaskSourceRef {
  if (!sourceRef || typeof sourceRef !== 'object') return false

  const candidate = sourceRef as Partial<TaskSourceRef>
  return !!candidate.roomId && !!candidate.eventId
}

function isValidTaskItem(value: unknown): value is TaskItem {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<TaskItem>
  return (
    !!candidate.id &&
    !!candidate.title &&
    !!candidate.assignee &&
    typeof candidate.dueAt === 'number' &&
    isValidTaskStatus(candidate.status) &&
    isValidTaskSourceRef(candidate.sourceRef) &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number'
  )
}

function parseDueAt(value: number | string): number {
  if (typeof value === 'number') return value

  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error('Invalid dueAt')
  return parsed
}

function generateTaskId(now: number): string {
  const suffix = Math.random().toString(36).slice(2, 10)
  return `task:${now}:${suffix}`
}

function normalizePersistedItems(items: unknown[]): LoadedTaskState {
  const deduped = new Map<string, TaskItem>()
  let normalized = false

  for (const item of items) {
    if (!isValidTaskItem(item)) {
      normalized = true
      continue
    }

    if (deduped.has(item.id)) normalized = true

    deduped.set(item.id, item)
  }

  return {
    items: [...deduped.values()],
    normalized,
  }
}

// ---------------------------------------------------------------------------
// localStorage helpers (kept as-is — self-contained Effect wrappers)
// ---------------------------------------------------------------------------

function loadStateEffect(): DesktopEffect<LoadedTaskState> {
  return fromSync(() => {
    const raw = localStorage.getItem(TASK_STORAGE_KEY)
    if (!raw) return { items: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedTaskState>
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) return { items: [], normalized: false }

    return normalizePersistedItems(parsed.items)
  }).pipe(Effect.catchAll(() => Effect.succeed({ items: [], normalized: false })))
}

function loadState(): LoadedTaskState {
  return runDesktopSync(loadStateEffect())
}

function persistStateEffect(payload: PersistedTaskState): DesktopEffect<void> {
  return fromSync(() => localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(payload))).pipe(
    Effect.catchAll((err) => fromSync(() => console.warn('[taskStore] Failed to persist tasks:', err))),
  )
}

function persistState(items: TaskItem[]) {
  const payload: PersistedTaskState = {
    version: 1,
    items,
  }

  runDesktopSync(persistStateEffect(payload))
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface TaskState {
  tasks: TaskItem[]
  hydrated: boolean
}

function createInitialState(): TaskState {
  const { items, normalized } = loadState()
  if (normalized) persistState(items)
  return { tasks: items, hydrated: true }
}

export const taskStore = new Store<TaskState>(createInitialState())

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

export function selectTasksByStatus(state: TaskState): { todo: TaskItem[]; doing: TaskItem[]; done: TaskItem[] } {
  return {
    todo: state.tasks.filter((item) => item.status === 'todo'),
    doing: state.tasks.filter((item) => item.status === 'doing'),
    done: state.tasks.filter((item) => item.status === 'done'),
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function hydrate(): void {
  const { items, normalized } = loadState()
  if (normalized) persistState(items)
  taskStore.setState(() => ({ tasks: items, hydrated: true }))
}

export function createTask(input: CreateTaskInput): TaskItem {
  const title = input.title.trim()
  const assignee = input.assignee.trim()
  if (!title || !assignee || !isValidTaskSourceRef(input.sourceRef)) throw new Error('Invalid task input')

  const now = input.now ?? Date.now()
  const dueAt = parseDueAt(input.dueAt)
  const id = input.id ?? generateTaskId(now)
  const status = input.status ?? 'todo'

  if (!isValidTaskStatus(status)) throw new Error('Invalid task status')

  const task = createTaskItem({
    id,
    title,
    assignee,
    dueAt,
    sourceRef: input.sourceRef,
    now,
  })

  if (status !== 'todo') {
    if (!canTransitionTaskStatus('todo', status)) throw new Error(`Invalid status transition: todo -> ${status}`)
    task.status = status
    task.updatedAt = now
  }

  taskStore.setState((s) => ({ ...s, tasks: [...s.tasks, task] }))
  persistState(taskStore.state.tasks)
  return task
}

export function updateTask(id: string, update: UpdateTaskInput): void {
  const index = taskStore.state.tasks.findIndex((item) => item.id === id)
  if (index < 0) return

  const current = taskStore.state.tasks[index]
  const nextTitle = update.title?.trim() || current.title
  const nextAssignee = update.assignee?.trim() || current.assignee
  const nextDueAt = update.dueAt === undefined ? current.dueAt : parseDueAt(update.dueAt)

  const updated: TaskItem = {
    ...current,
    title: nextTitle,
    assignee: nextAssignee,
    dueAt: nextDueAt,
    updatedAt: Date.now(),
  }

  taskStore.setState((s) => {
    const next = [...s.tasks]
    next[index] = updated
    return { ...s, tasks: next }
  })
  persistState(taskStore.state.tasks)
}

export function transitionStatus(id: string, to: TaskStatus): void {
  const index = taskStore.state.tasks.findIndex((item) => item.id === id)
  if (index < 0) return

  const current = taskStore.state.tasks[index]
  if (current.status === to) return

  if (!canTransitionTaskStatus(current.status, to))
    throw new Error(`Invalid status transition: ${current.status} -> ${to}`)

  const updated: TaskItem = {
    ...current,
    status: to,
    updatedAt: Date.now(),
  }

  taskStore.setState((s) => {
    const next = [...s.tasks]
    next[index] = updated
    return { ...s, tasks: next }
  })
  persistState(taskStore.state.tasks)
}

export function resetTaskStore(): void {
  taskStore.setState(() => createInitialState())
}
