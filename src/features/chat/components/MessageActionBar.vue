<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk'
import type { TaskStatus } from '../types/task'
/**
 * 消息悬浮操作栏
 * 显示在消息右上角，包含：Add Reaction、Reply、More 下拉菜单
 */
import { getClient } from '@matrix/client'
import { redactMessage } from '@matrix/index'
import {
  isMessagePinned,
  pinMessage,
  unpinMessage,
} from '@matrix/rooms'
import {
  Copy,
  Edit,
  Link,
  MessageSquareText,
  MoreHorizontal,
  Pin,
  PinOff,
  Reply,
  Smile,
  Trash2,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { ask } from '@/electron/dialog'
import { getFloatingPosition } from '../composables/useFloatingPosition'
import { copyMessageContentToClipboard } from '../lib/messageClipboard'
import { useChatStore } from '../stores/chatStore'
import { useDeferStore } from '../stores/deferStore'
import { useTaskStore } from '../stores/taskStore'
import TaskComposerDialog from './TaskComposerDialog.vue'

const props = defineProps<{
  event: MatrixEvent
  roomId: string
}>()

const emit = defineEmits<{
  react: []
  reply: []
  menuOpenChange: [open: boolean]
}>()

const store = useChatStore()
const deferStore = useDeferStore()
const taskStore = useTaskStore()
const { t } = useI18n()
const showMore = ref(false)
const showDeferMenu = ref(false)
const customDeferValue = ref('')
const showTaskComposer = ref(false)
const creatingTask = ref(false)
const moreTriggerRef = ref<HTMLElement>()
const moreMenuRef = ref<HTMLElement>()
const moreMenuStyle = ref({ left: '0px', top: '0px' })
const moreMenuPositioned = ref(false)

const myUserId = computed(() => getClient().getUserId())
const isMine = computed(() => props.event.getSender() === myUserId.value)
const eventId = computed(() => props.event.getId() || '')
const content = computed(() => props.event.getContent() ?? {})
const body = computed(() => props.event.getContent()?.body || '')

const isPinned = computed(() => {
  if (!props.roomId || !eventId.value)
    return false
  return isMessagePinned(props.roomId, eventId.value)
})

function updateMoreMenuPosition() {
  const trigger = moreTriggerRef.value
  const menu = moreMenuRef.value
  if (!trigger || !menu)
    return
  moreMenuStyle.value = getFloatingPosition(trigger, menu, { margin: 12, offset: 6 })
}

function closeMoreMenu() {
  showMore.value = false
  showDeferMenu.value = false
}

function onMoreMenuAfterLeave() {
  if (!showMore.value)
    moreMenuPositioned.value = false
}

function toggleMore() {
  if (showMore.value) {
    closeMoreMenu()
    return
  }
  moreMenuPositioned.value = false
  showMore.value = true
}

function onReply() {
  store.setReplyingTo(props.event)
  emit('reply')
}

function onEdit() {
  store.setEditingEvent(props.event)
  showMore.value = false
}

async function onDelete() {
  showMore.value = false
  const confirmed = await ask(t('chat.delete_confirm'), {
    title: t('chat.delete_message'),
    kind: 'warning',
  })
  if (!confirmed)
    return
  try {
    await redactMessage(props.roomId, eventId.value)
  }
  catch {
    toast.error(t('auth.error'))
  }
}

async function onTogglePin() {
  showMore.value = false
  if (!props.roomId || !eventId.value)
    return
  try {
    if (isPinned.value) {
      await unpinMessage(props.roomId, eventId.value)
    }
    else {
      await pinMessage(props.roomId, eventId.value)
    }
  }
  catch {
    toast.error(t('auth.error'))
  }
}

function onCopyText() {
  void copyMessageContentToClipboard(content.value)
  showMore.value = false
}

function onCopyLink() {
  const link = `https://matrix.to/#/${props.roomId}/${eventId.value}`
  navigator.clipboard.writeText(link)
  showMore.value = false
}

function onReact() {
  emit('react')
}

function onOpenThread() {
  if (!eventId.value)
    return
  store.openThread(eventId.value)
  showMore.value = false
}

function onToggleDeferMenu() {
  showDeferMenu.value = !showDeferMenu.value
}

function createDeferredFromMessage(preset: 'in-1-hour' | 'tonight' | 'tomorrow-morning' | 'tomorrow', suffix: string) {
  if (!eventId.value || !props.roomId)
    return
  deferStore.createDeferredItem({
    id: `message:${props.roomId}:${eventId.value}:${suffix}`,
    roomId: props.roomId,
    eventId: eventId.value,
    reminder: { preset },
  })
  showDeferMenu.value = false
  showMore.value = false
}

function submitCustomDeferredFromMessage() {
  if (!eventId.value || !props.roomId)
    return

  const dueAt = Date.parse(customDeferValue.value)
  if (!Number.isFinite(dueAt))
    return

  deferStore.createDeferredItem({
    id: `message:${props.roomId}:${eventId.value}:custom`,
    roomId: props.roomId,
    eventId: eventId.value,
    reminder: {
      preset: 'custom',
      dueAt,
    },
  })
  showDeferMenu.value = false
  showMore.value = false
  customDeferValue.value = ''
}

function onOpenTaskComposer() {
  showTaskComposer.value = true
  showMore.value = false
  showDeferMenu.value = false
}

function onCloseTaskComposer() {
  if (creatingTask.value)
    return
  showTaskComposer.value = false
}

async function onSubmitTask(payload: { title: string, assignee: string, dueAt: string, status: TaskStatus }) {
  if (creatingTask.value || !props.roomId || !eventId.value)
    return

  creatingTask.value = true
  try {
    await Promise.resolve(taskStore.createTask({
      title: payload.title,
      assignee: payload.assignee,
      dueAt: payload.dueAt,
      status: payload.status,
      sourceRef: {
        roomId: props.roomId,
        eventId: eventId.value,
      },
    }))
    showTaskComposer.value = false
  }
  finally {
    creatingTask.value = false
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!showMore.value)
    return
  const target = event.target as Node | null
  if (!target)
    return
  if (moreTriggerRef.value?.contains(target) || moreMenuRef.value?.contains(target))
    return
  closeMoreMenu()
}

function onViewportChange() {
  if (showMore.value)
    updateMoreMenuPosition()
}

watch(showMore, async (open) => {
  emit('menuOpenChange', open)
  if (!open)
    return

  await nextTick()
  updateMoreMenuPosition()
  moreMenuPositioned.value = true
})

watch(showDeferMenu, async () => {
  if (!showMore.value)
    return
  await nextTick()
  updateMoreMenuPosition()
})

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('resize', onViewportChange)
  document.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('resize', onViewportChange)
  document.removeEventListener('scroll', onViewportChange, true)
  emit('menuOpenChange', false)
})
</script>

<template>
  <div
    class="action-bar flex items-center overflow-visible bg-popover border border-border rounded-md shadow-sm"
  >
    <!-- Add Reaction -->
    <button
      class="flex size-8 cursor-pointer items-center justify-center text-muted-foreground transition-all duration-100 hover:bg-muted hover:text-foreground"
      :title="t('chat.add_reaction')"
      @click.stop="onReact"
    >
      <Smile :size="16" />
    </button>

    <!-- Reply -->
    <button
      class="flex size-8 cursor-pointer items-center justify-center text-muted-foreground transition-all duration-100 hover:bg-muted hover:text-foreground"
      :title="t('common.reply')"
      @click.stop="onReply"
    >
      <Reply :size="16" />
    </button>

    <!-- More -->
    <div>
      <button
        ref="moreTriggerRef"
        class="flex size-8 cursor-pointer items-center justify-center text-muted-foreground transition-all duration-100 hover:bg-muted hover:text-foreground"
        :title="t('chat.more_actions')"
        data-testid="message-more-trigger"
        @click.stop="toggleMore"
      >
        <MoreHorizontal :size="16" />
      </button>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-[opacity,transform] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        leave-active-class="transition-opacity duration-75 ease-in"
        enter-from-class="opacity-0 -translate-y-1 scale-[0.96]"
        leave-to-class="opacity-0"
        @after-leave="onMoreMenuAfterLeave"
      >
        <div
          v-if="showMore"
          ref="moreMenuRef"
          class="fixed z-[200] max-h-[min(420px,calc(100vh-24px))] min-w-[160px] overflow-y-auto rounded-md border border-[var(--color-muted)]/30 bg-card py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          :class="moreMenuPositioned ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'"
          :style="{ left: moreMenuStyle.left, top: moreMenuStyle.top }"
          data-testid="message-more-menu"
          @click.stop
        >
          <!-- Edit (own msg) -->
          <button
            v-if="isMine"
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            @click.stop="onEdit"
          >
            <Edit :size="14" />
            <span>{{ t('chat.edit_message') }}</span>
          </button>

          <!-- Pin / Unpin -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            @click.stop="onTogglePin"
          >
            <component :is="isPinned ? PinOff : Pin" :size="14" />
            <span>{{ isPinned ? t('chat.unpin_message') : t('chat.pin_message') }}</span>
          </button>

          <!-- Open Thread -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            @click.stop="onOpenThread"
          >
            <MessageSquareText :size="14" />
            <span>{{ t('chat.thread') }}</span>
          </button>

          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            :aria-expanded="showDeferMenu"
            aria-haspopup="menu"
            data-testid="message-defer-trigger"
            @click.stop="onToggleDeferMenu"
          >
            <span>{{ t('chat.defer') }}</span>
          </button>

          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            data-testid="message-convert-task-trigger"
            @click.stop="onOpenTaskComposer"
          >
            <span>{{ t('chat.convert_to_task') }}</span>
          </button>

          <Transition
            enter-active-class="transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
            leave-active-class="transition-[opacity,transform] duration-100 ease-in"
            enter-from-class="opacity-0 translate-x-1.5 -translate-y-1 scale-[0.98]"
            leave-to-class="opacity-0 translate-x-1 -translate-y-0.5 scale-[0.98]"
          >
            <div
              v-if="showDeferMenu"
              class="mx-2 my-1 origin-top-right transform-gpu will-change-transform rounded-md border border-[var(--color-muted)]/20 p-2"
              role="menu"
              data-testid="message-defer-submenu"
            >
              <div class="space-y-1">
                <button
                  class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
                  data-testid="message-defer-preset-1h"
                  @click.stop="createDeferredFromMessage('in-1-hour', '1h')"
                >
                  <span>{{ t('chat.defer_preset_1h') }}</span>
                </button>
                <button
                  class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
                  data-testid="message-defer-preset-tonight"
                  @click.stop="createDeferredFromMessage('tonight', 'tonight')"
                >
                  <span>{{ t('chat.defer_preset_tonight') }}</span>
                </button>
                <button
                  class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
                  data-testid="message-defer-preset-tomorrow-morning"
                  @click.stop="createDeferredFromMessage('tomorrow-morning', 'tomorrow-morning')"
                >
                  <span>{{ t('chat.defer_preset_tomorrow_morning') }}</span>
                </button>
                <button
                  class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
                  data-testid="message-defer-preset-tomorrow"
                  @click.stop="createDeferredFromMessage('tomorrow', 'tomorrow')"
                >
                  <span>{{ t('chat.defer_preset_tomorrow') }}</span>
                </button>
              </div>

              <button
                class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
                data-testid="message-defer-custom-toggle"
                @click.stop
              >
                <span>{{ t('chat.defer_custom') }}</span>
              </button>
              <input
                v-model="customDeferValue"
                type="datetime-local"
                class="mt-1 w-full rounded border border-[var(--color-muted)]/40 bg-background px-2 py-1 text-xs"
                data-testid="message-defer-custom-input"
              >
              <button
                class="mt-1 w-full rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                :disabled="!customDeferValue"
                data-testid="message-defer-custom-submit"
                @click.stop="submitCustomDeferredFromMessage"
              >
                {{ t('common.confirm') }}
              </button>
            </div>
          </Transition>

          <!-- Copy Text -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            @click.stop="onCopyText"
          >
            <Copy :size="14" />
            <span>{{ t('chat.copy_text') }}</span>
          </button>

          <!-- Copy Link -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            @click.stop="onCopyLink"
          >
            <Link :size="14" />
            <span>{{ t('chat.copy_message_link') }}</span>
          </button>

          <!-- Separator -->
          <div v-if="isMine" class="h-px bg-[var(--color-muted)]/20 my-1" />

          <!-- Delete (own/admin) -->
          <button
            v-if="isMine"
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-destructive transition-colors duration-100 hover:bg-destructive hover:text-white"
            @click.stop="onDelete"
          >
            <Trash2 :size="14" />
            <span>{{ t('chat.delete_message') }}</span>
          </button>
        </div>
      </Transition>
    </Teleport>

    <TaskComposerDialog
      :open="showTaskComposer"
      :initial-title="body"
      :submitting="creatingTask"
      @close="onCloseTaskComposer"
      @submit="onSubmitTask"
    />
  </div>
</template>
