import type { MatrixEvent } from 'matrix-js-sdk'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useNotificationSound } from '@/features/chat/composables/useNotificationSound'
import { useChatStore } from '@/features/chat/stores/chatStore'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { matrixEvents } from '@/matrix/events'

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

describe('useNotificationSound', () => {
  beforeEach(() => {
    localStorage.clear()
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
    const settings = useSettingsStore()
    const wrapper = mount(createHost())

    settings.notificationsEnabled = false
    emitMessage()
    expect(playNotificationSound).not.toHaveBeenCalled()

    settings.notificationsEnabled = true
    settings.notificationSound = false
    emitMessage()
    expect(playNotificationSound).not.toHaveBeenCalled()

    settings.notificationSound = true
    settings.setNotificationChannel('messages', false)
    emitMessage()
    expect(playNotificationSound).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('suppresses sounds during do-not-disturb time windows', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 4, 22, 30))
    const settings = useSettingsStore()
    settings.dndStart = '22:00'
    settings.dndEnd = '08:00'
    const wrapper = mount(createHost())

    emitMessage()

    expect(playNotificationSound).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('plays sounds for enabled notifications outside the current room', () => {
    useSettingsStore()
    const chatStore = useChatStore()
    chatStore.setCurrentRoom('!current:localhost')
    const wrapper = mount(createHost())

    emitMessage('!other:localhost')

    expect(playNotificationSound).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('shows desktop notifications without message content when preview is disabled', () => {
    const settings = useSettingsStore()
    settings.notificationSound = false
    settings.notificationPreview = false
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
