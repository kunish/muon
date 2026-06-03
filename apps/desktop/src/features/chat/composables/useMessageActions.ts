import type { MatrixEvent } from 'matrix-js-sdk'
import type { MaybeRefOrGetter } from 'vue'
import { redactMessage, sendReaction } from '@matrix/index'
import { isMessagePinned, isMessageStarred, pinMessage, starMessage, unpinMessage, unstarMessage } from '@matrix/rooms'
import { computed, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { ask } from '@/desktop/dialog'
import { useChatStore } from '../stores/chatStore'
import { useMessageClipboardFeedback } from './useMessageClipboardFeedback'

/**
 * 单条消息的动作集合（单一来源），供悬浮操作条与右键菜单等多个入口复用。
 *
 * 仅封装与 matrix/store 交互的纯逻辑；转发对话框、翻译结果、延后/任务等需要就地渲染的
 * UI 状态保留在各自组件内，避免把渲染关注点泄漏进 composable。
 */
export function useMessageActions(event: MaybeRefOrGetter<MatrixEvent>, roomId: MaybeRefOrGetter<string>) {
  const store = useChatStore()
  const { t } = useI18n()
  const { copyMessageContentWithFeedback } = useMessageClipboardFeedback()

  const currentEvent = () => toValue(event)
  const currentRoomId = () => toValue(roomId)
  const eventId = () => currentEvent().getId() || ''

  const isPinned = computed(() => {
    const id = eventId()
    const room = currentRoomId()
    return !!room && !!id && isMessagePinned(room, id)
  })

  const isStarred = computed(() => {
    const id = eventId()
    const room = currentRoomId()
    return !!room && !!id && isMessageStarred(room, id)
  })

  function reply() {
    store.setReplyingTo(currentEvent())
  }

  function edit() {
    store.setEditingEvent(currentEvent())
  }

  async function react(emoji: string) {
    const id = eventId()
    const room = currentRoomId()
    if (!room || !id) return
    try {
      await sendReaction(room, id, emoji)
    } catch {
      toast.error(t('chat.reaction_failed'))
    }
  }

  async function togglePin() {
    const id = eventId()
    const room = currentRoomId()
    if (!room || !id) return
    try {
      if (isPinned.value) await unpinMessage(room, id)
      else await pinMessage(room, id)
    } catch {
      toast.error(t('auth.error'))
    }
  }

  async function toggleStar() {
    const id = eventId()
    const room = currentRoomId()
    if (!room || !id) return
    try {
      if (isStarred.value) await unstarMessage(room, id)
      else await starMessage(room, id)
    } catch {
      toast.error(t('auth.error'))
    }
  }

  function multiSelect() {
    store.enterMultiSelect()
    const id = eventId()
    if (id) store.toggleMessageSelection(id)
  }

  function hideForMe() {
    const id = eventId()
    if (id) store.hideMessage(id)
  }

  function openThread() {
    const id = eventId()
    if (id) store.openThread(id)
  }

  function copyText() {
    void copyMessageContentWithFeedback(currentEvent().getContent() ?? {})
  }

  async function copyLink(): Promise<void> {
    const id = eventId()
    const room = currentRoomId()
    if (!room || !id || !navigator.clipboard?.writeText) {
      toast.error(t('chat.copy_message_link_failed'))
      return
    }
    const link = `https://matrix.to/#/${room}/${id}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success(t('chat.message_link_copied'))
    } catch {
      toast.error(t('chat.copy_message_link_failed'))
    }
  }

  /** 撤回（Matrix redaction），带确认；本地"仅对自己隐藏"用 hideForMe。 */
  async function recall(): Promise<void> {
    const id = eventId()
    const room = currentRoomId()
    if (!room || !id) return
    const confirmed = await ask(t('chat.recall_confirm'), {
      title: t('chat.recall_title'),
      kind: 'warning',
    })
    if (!confirmed) return
    try {
      await redactMessage(room, id)
    } catch {
      toast.error(t('auth.error'))
    }
  }

  return {
    isPinned,
    isStarred,
    reply,
    edit,
    react,
    togglePin,
    toggleStar,
    multiSelect,
    hideForMe,
    openThread,
    copyText,
    copyLink,
    recall,
  }
}
