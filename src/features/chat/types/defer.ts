export const DEFER_STORAGE_KEY = 'muon:defer:v1'

export type DeferStatus = 'deferred' | 'completed' | 'archived'

export type ReminderPreset =
  | 'in-1-hour'
  | 'tonight'
  | 'tomorrow-morning'
  | 'tomorrow'
  | 'later-today'
  | 'next-week'
  | 'custom'

export interface DeferItem {
  id: string
  roomId: string
  eventId: string
  dueAt: number
  status: DeferStatus
  createdAt: number
  updatedAt: number
}

export interface CreateDeferItemInput {
  id: string
  roomId: string
  eventId: string
  dueAt: number
  now?: number
}

export function createDeferItem(input: CreateDeferItemInput): DeferItem {
  const now = input.now ?? Date.now()
  return {
    id: input.id,
    roomId: input.roomId,
    eventId: input.eventId,
    dueAt: input.dueAt,
    status: 'deferred',
    createdAt: now,
    updatedAt: now,
  }
}

export function transitionDeferStatus(item: DeferItem, status: Exclude<DeferStatus, 'deferred'>): DeferItem {
  return {
    ...item,
    status,
    updatedAt: Date.now(),
  }
}

export function isDeferActive(item: DeferItem) {
  return item.status === 'deferred'
}
