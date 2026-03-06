import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  canTransitionTaskStatus,
  createTaskItem,
  TASK_STORAGE_KEY,
} from '../types/task'
import type { TaskItem, TaskSourceRef, TaskStatus } from '../types/task'

interface PersistedTaskState {
  version: 1
  items: TaskItem[]
}

interface LoadedTaskState {
  items: TaskItem[]
  normalized: boolean
}

interface CreateTaskInput {
  id?: string
  title: string
  assignee: string
  dueAt: number | string
  status?: TaskStatus
  sourceRef: TaskSourceRef
  now?: number
}

interface UpdateTaskInput {
  title?: string
  assignee?: string
  dueAt?: number | string
}

function isValidTaskStatus(status: unknown): status is TaskStatus {
  return status === 'todo' || status === 'doing' || status === 'done'
}

function isValidTaskSourceRef(sourceRef: unknown): sourceRef is TaskSourceRef {
  if (!sourceRef || typeof sourceRef !== 'object')
    return false

  const candidate = sourceRef as Partial<TaskSourceRef>
  return !!candidate.roomId && !!candidate.eventId
}

function isValidTaskItem(value: unknown): value is TaskItem {
  if (!value || typeof value !== 'object')
    return false

  const candidate = value as Partial<TaskItem>
  return !!candidate.id
    && !!candidate.title
    && !!candidate.assignee
    && typeof candidate.dueAt === 'number'
    && isValidTaskStatus(candidate.status)
    && isValidTaskSourceRef(candidate.sourceRef)
    && typeof candidate.createdAt === 'number'
    && typeof candidate.updatedAt === 'number'
}

function parseDueAt(value: number | string): number {
  if (typeof value === 'number')
    return value

  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed))
    throw new Error('Invalid dueAt')
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

    if (deduped.has(item.id))
      normalized = true

    deduped.set(item.id, item)
  }

  return {
    items: [...deduped.values()],
    normalized,
  }
}

function loadState(): LoadedTaskState {
  try {
    const raw = localStorage.getItem(TASK_STORAGE_KEY)
    if (!raw)
      return { items: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedTaskState>
    if (parsed.version !== 1 || !Array.isArray(parsed.items))
      return { items: [], normalized: false }

    return normalizePersistedItems(parsed.items)
  }
  catch {
    return { items: [], normalized: false }
  }
}

function persistState(items: TaskItem[]) {
  const payload: PersistedTaskState = {
    version: 1,
    items,
  }

  try {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(payload))
  }
  catch {
  }
}

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<TaskItem[]>([])
  const hydrated = ref(false)

  const tasksByStatus = computed(() => {
    const todo = tasks.value.filter(item => item.status === 'todo')
    const doing = tasks.value.filter(item => item.status === 'doing')
    const done = tasks.value.filter(item => item.status === 'done')

    return {
      todo,
      doing,
      done,
    }
  })

  function hydrate() {
    const { items, normalized } = loadState()
    hydrated.value = true
    tasks.value = items

    if (normalized)
      persistState(items)
  }

  function createTask(input: CreateTaskInput): TaskItem {
    const title = input.title.trim()
    const assignee = input.assignee.trim()
    if (!title || !assignee || !isValidTaskSourceRef(input.sourceRef))
      throw new Error('Invalid task input')

    const now = input.now ?? Date.now()
    const dueAt = parseDueAt(input.dueAt)
    const id = input.id ?? generateTaskId(now)
    const status = input.status ?? 'todo'

    if (!isValidTaskStatus(status))
      throw new Error('Invalid task status')

    const task = createTaskItem({
      id,
      title,
      assignee,
      dueAt,
      sourceRef: input.sourceRef,
      now,
    })

    if (status !== 'todo') {
      if (!canTransitionTaskStatus('todo', status))
        throw new Error(`Invalid status transition: todo -> ${status}`)
      task.status = status
      task.updatedAt = now
    }

    tasks.value.push(task)
    persistState(tasks.value)
    return task
  }

  function updateTask(id: string, update: UpdateTaskInput) {
    const index = tasks.value.findIndex(item => item.id === id)
    if (index < 0)
      return

    const current = tasks.value[index]
    const nextTitle = update.title?.trim() || current.title
    const nextAssignee = update.assignee?.trim() || current.assignee
    const nextDueAt = update.dueAt === undefined ? current.dueAt : parseDueAt(update.dueAt)

    tasks.value[index] = {
      ...current,
      title: nextTitle,
      assignee: nextAssignee,
      dueAt: nextDueAt,
      updatedAt: Date.now(),
    }

    persistState(tasks.value)
  }

  function transitionStatus(id: string, to: TaskStatus) {
    const index = tasks.value.findIndex(item => item.id === id)
    if (index < 0)
      return

    const current = tasks.value[index]
    if (current.status === to)
      return

    if (!canTransitionTaskStatus(current.status, to))
      throw new Error(`Invalid status transition: ${current.status} -> ${to}`)

    tasks.value[index] = {
      ...current,
      status: to,
      updatedAt: Date.now(),
    }

    persistState(tasks.value)
  }

  hydrate()

  return {
    tasks,
    hydrated,
    tasksByStatus,
    hydrate,
    createTask,
    updateTask,
    transitionStatus,
  }
})
