import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

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

export const useScheduledMessageStore = defineStore('scheduledMessages', () => {
  const messages = ref<ScheduledMessage[]>(loadState())

  function persist(): void {
    const payload: PersistedState = { version: 1, messages: messages.value }
    try {
      localStorage.setItem(SCHEDULED_MESSAGES_STORAGE_KEY, JSON.stringify(payload))
    } catch (err) {
      console.warn('[scheduledMessageStore] Failed to persist:', err)
    }
  }

  function schedule(input: {
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
    messages.value = [...messages.value, message].sort((a, b) => a.sendAt - b.sendAt)
    persist()
    return message
  }

  function cancel(id: string): void {
    const next = messages.value.filter((message) => message.id !== id)
    if (next.length === messages.value.length) return
    messages.value = next
    persist()
  }

  function dueMessages(now: number): ScheduledMessage[] {
    return messages.value.filter((message) => message.sendAt <= now)
  }

  function remove(ids: string[]): void {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    messages.value = messages.value.filter((message) => !idSet.has(message.id))
    persist()
  }

  function pendingForRoom(roomId: string): ScheduledMessage[] {
    return messages.value.filter((message) => message.roomId === roomId)
  }

  const pendingCount = computed(() => messages.value.length)

  return {
    messages,
    pendingCount,
    schedule,
    cancel,
    dueMessages,
    remove,
    pendingForRoom,
  }
})
