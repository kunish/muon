export const TASK_STORAGE_KEY = 'muon:task:v1'

export type TaskStatus = 'todo' | 'doing' | 'done'

export interface TaskSourceRef {
  roomId: string
  eventId: string
}

export interface TaskItem {
  id: string
  title: string
  assignee: string
  dueAt: number
  status: TaskStatus
  sourceRef: TaskSourceRef
  createdAt: number
  updatedAt: number
}

export interface CreateTaskItemInput {
  id: string
  title: string
  assignee: string
  dueAt: number
  sourceRef: TaskSourceRef
  now?: number
}

const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['doing'],
  doing: ['todo', 'done'],
  done: [],
}

export function createTaskItem(input: CreateTaskItemInput): TaskItem {
  const now = input.now ?? Date.now()
  return {
    id: input.id,
    title: input.title,
    assignee: input.assignee,
    dueAt: input.dueAt,
    status: 'todo',
    sourceRef: input.sourceRef,
    createdAt: now,
    updatedAt: now,
  }
}

export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus) {
  return TASK_STATUS_TRANSITIONS[from].includes(to)
}
