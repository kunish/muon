import { Store } from '@tanstack/vue-store'

export const SCHEDULED_MESSAGES_STORAGE_KEY = 'muon.chat.scheduledMessages.v1'

export interface ScheduledMessage {
  id: string
  roomId: string
  body: string
  html?: string
  /** epoch ms 发送时间 */
  sendAt: number
}

interface PersistedState {
  version: 1
  messages: ScheduledMessage[]
}

function isValidScheduledMessage(value: unknown): value is ScheduledMessage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ScheduledMessage>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.roomId === 'string' &&
    !!candidate.roomId &&
    typeof candidate.body === 'string' &&
    typeof candidate.sendAt === 'number' &&
    (candidate.html === undefined || typeof candidate.html === 'string')
  )
}

function loadState(): ScheduledMessage[] {
  try {
    const raw = localStorage.getItem(SCHEDULED_MESSAGES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (parsed.version !== 1 || !Array.isArray(parsed.messages)) return []
    return parsed.messages.filter(isValidScheduledMessage)
  } catch {
    return []
  }
}

function generateId(now: number): string {
  return `sched:${now}:${Math.random().toString(36).slice(2, 10)}`
}

export interface ScheduledMessageState {
  messages: ScheduledMessage[]
}

function createInitialState(): ScheduledMessageState {
  return { messages: loadState() }
}

export const scheduledMessageStore = new Store<ScheduledMessageState>(createInitialState())

function persist(): void {
  const payload: PersistedState = { version: 1, messages: scheduledMessageStore.state.messages }
  try {
    localStorage.setItem(SCHEDULED_MESSAGES_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[scheduledMessageStore] Failed to persist:', err)
  }
}

scheduledMessageStore.subscribe(() => persist())

export function schedule(input: {
  roomId: string
  body: string
  html?: string
  sendAt: number
  now?: number
}): ScheduledMessage {
  const message: ScheduledMessage = {
    id: generateId(input.now ?? Date.now()),
    roomId: input.roomId,
    body: input.body,
    html: input.html,
    sendAt: input.sendAt,
  }
  scheduledMessageStore.setState((s) => ({
    messages: [...s.messages, message].sort((a, b) => a.sendAt - b.sendAt),
  }))
  return message
}

export function cancel(id: string): void {
  const next = scheduledMessageStore.state.messages.filter((m) => m.id !== id)
  if (next.length === scheduledMessageStore.state.messages.length) return
  scheduledMessageStore.setState((s) => ({
    messages: s.messages.filter((m) => m.id !== id),
  }))
}

export function remove(ids: string[]): void {
  if (ids.length === 0) return
  const idSet = new Set(ids)
  scheduledMessageStore.setState((s) => ({
    messages: s.messages.filter((m) => !idSet.has(m.id)),
  }))
}

export function dueMessages(now: number): ScheduledMessage[] {
  return scheduledMessageStore.state.messages.filter((m) => m.sendAt <= now)
}

export function pendingForRoom(roomId: string): ScheduledMessage[] {
  return scheduledMessageStore.state.messages.filter((m) => m.roomId === roomId)
}

export function selectPendingCount(state: ScheduledMessageState): number {
  return state.messages.length
}

export function resetScheduledMessageStore(): void {
  scheduledMessageStore.setState(() => createInitialState())
}
