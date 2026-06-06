import type { MatrixEvent } from 'matrix-js-sdk'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useNotificationSound } from '@/features/chat/composables/useNotificationSound'
import { resetChatStore, setCurrentRoom } from '@/features/chat/stores/chatStore'
import { matrixEvents } from '@/matrix/events'
import {
  resetSettingsStore,
  setNotificationChannel,
  setNotificationPreview,
  setNotificationsEnabled,
  setNotificationSound,
  settingsStore,
} from '@/shared/stores/settingsStore'

const playNotificationSound = vi.hoisted(() => vi.fn())
const shownNotifications = vi.hoisted<{ title: string; options?: NotificationOptions }[]>(() => [])

vi.mock('@/shared/lib/audio', () => ({
  playNotificationSound,
}))

class FakeNotification {
  static permission: NotificationPermission = 'granted'

  constructor(title: string, options?: NotificationOptions) {
    shownNotifications.push({ title, options })
  }
}

function createHost() {
  return defineComponent({
    setup() {
      useNotificationSound()
      return () => null
    },
  })
}

function emitMessage(roomId = '!other:localhost', sender = '@alice:localhost', body = 'launch checklist ready') {
  matrixEvents.emit('room.message', {
    roomId,
    event: {
      getContent: () => ({ body }),
      getSender: () => sender,
    } as MatrixEvent,
  })
}

function emitUrgentMessage(roomId = '!other:localhost', sender = '@alice:localhost', body = 'deploy now') {
  matrixEvents.emit('room.message', {
    roomId,
    event: {
      getContent: () => ({ body, 'xyz.muon.urgent': true }),
      getSender: () => sender,
    } as MatrixEvent,
  })
}

describe('useNotificationSound', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSettingsStore()
    resetChatStore()
    playNotificationSound.mockClear()
    shownNotifications.length = 0
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: FakeNotification,
    })
    vi.useRealTimers()
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'Notification')
    vi.useRealTimers()
  })

  it('respects notification settings before playing message sounds', () => {
    const wrapper = mount(createHost())

    setNotificationsEnabled(false)
    emitMessage()
    expect(playNotificationSound).not.toHaveBeenCalled()

    setNotificationsEnabled(true)
    setNotificationSound(false)
    emitMessage()
    expect(playNotificationSound).not.toHaveBeenCalled()

    setNotificationSound(true)
    setNotificationChannel('messages', false)
    emitMessage()
    expect(playNotificationSound).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('suppresses sounds during do-not-disturb time windows', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 4, 22, 30))
    settingsStore.setState((s) => ({ ...s, dndStart: '22:00', dndEnd: '08:00' }))
    const wrapper = mount(createHost())

    emitMessage()

    expect(playNotificationSound).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('forces urgent (DING) message sounds through do-not-disturb windows', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 4, 22, 30))
    settingsStore.setState((s) => ({ ...s, dndStart: '22:00', dndEnd: '08:00' }))
    const wrapper = mount(createHost())

    emitMessage()
    expect(playNotificationSound).not.toHaveBeenCalled()

    emitUrgentMessage()
    expect(playNotificationSound).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('plays sounds for enabled notifications outside the current room', () => {
    setCurrentRoom('!current:localhost')
    const wrapper = mount(createHost())

    emitMessage('!other:localhost')

    expect(playNotificationSound).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('shows desktop notifications without message content when preview is disabled', () => {
    setNotificationSound(false)
    setNotificationPreview(false)
    const wrapper = mount(createHost())

    emitMessage('!other:localhost', '@alice:localhost', 'confidential launch checklist')

    expect(playNotificationSound).not.toHaveBeenCalled()
    expect(shownNotifications).toHaveLength(1)
    expect(shownNotifications[0]).toMatchObject({
      options: {
        body: '@alice:localhost 发来消息',
        tag: '!other:localhost',
      },
      title: '新消息',
    })
    expect(JSON.stringify(shownNotifications[0])).not.toContain('confidential launch checklist')
    wrapper.unmount()
  })
})
