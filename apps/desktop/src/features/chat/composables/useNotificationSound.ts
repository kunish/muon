import type { MatrixEvent } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'
import { matrixEvents } from '@matrix/index'
import { selectNormalizedNotificationChannels, settingsStore } from '@shared/stores/settingsStore'
import { playNotificationSound } from '@/shared/lib/audio'
import { chatStore, isMuted } from '../stores/chatStore'

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  return hours * 60 + minutes
}

function isWithinDoNotDisturb(start: string, end: string, now = new Date()): boolean {
  const startMinutes = parseTimeToMinutes(start)
  const endMinutes = parseTimeToMinutes(end)
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return false

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  if (startMinutes < endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes

  return nowMinutes >= startMinutes || nowMinutes < endMinutes
}

/**
 * 监听新消息，在非当前会话收到消息时播放提示音
 */
export function useNotificationSound() {
  const { t } = useI18n()

  function senderNameFor(event: MatrixEvent): string {
    return event.getSender() || t('notifications.new_message')
  }

  function notificationBodyFor(event: MatrixEvent): string {
    const sender = senderNameFor(event)
    if (!settingsStore.state.notificationPreview) return t('notifications.new_message_from', { name: sender })

    const body = event.getContent()?.body
    return typeof body === 'string' && body.trim() ? body : t('notifications.new_message_from', { name: sender })
  }

  function showDesktopNotification(payload: { roomId: string; event: MatrixEvent }): void {
    const NotificationCtor = globalThis.Notification
    if (typeof NotificationCtor !== 'function') return

    if (NotificationCtor.permission !== 'granted') return

    const notification = new NotificationCtor(t('notifications.new_message'), {
      body: notificationBodyFor(payload.event),
      tag: payload.roomId,
    })
    void notification
  }

  function isUrgentEvent(event: MatrixEvent): boolean {
    return event.getContent()?.['xyz.muon.urgent'] === true
  }

  function shouldHandleMessageNotification(payload: { roomId: string; event: MatrixEvent }): boolean {
    if (!settingsStore.state.notificationsEnabled) return false

    if (selectNormalizedNotificationChannels(settingsStore.state).messages === false) return false

    // 加急/DING 消息强制提醒：绕过免打扰时段与房间免打扰
    const urgent = isUrgentEvent(payload.event)

    if (!urgent && isWithinDoNotDisturb(settingsStore.state.dndStart, settingsStore.state.dndEnd)) return false

    const client = getClient()
    const myUserId = client.getUserId()

    // 不对自己发的消息播放提示音
    if (payload.event.getSender() === myUserId) return false

    // 当前正在查看的房间不播放提示音
    if (payload.roomId === chatStore.state.currentRoomId) return false

    // 免打扰的房间不播放（加急消息除外）
    if (!urgent && isMuted(payload.roomId)) return false

    return true
  }

  function onNewMessage(payload: { roomId: string; event: MatrixEvent }) {
    if (!shouldHandleMessageNotification(payload)) return

    if (settingsStore.state.notificationSound) playNotificationSound()

    showDesktopNotification(payload)
  }

  onMounted(() => {
    matrixEvents.on('room.message', onNewMessage)
  })

  onUnmounted(() => {
    matrixEvents.off('room.message', onNewMessage)
  })
}
