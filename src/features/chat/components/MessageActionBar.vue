<script setup lang="ts">
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '../stores/chatStore'
import { useDeferStore } from '../stores/deferStore'
import { useTaskStore } from '../stores/taskStore'
import TaskComposerDialog from './TaskComposerDialog.vue'

const props = defineProps<{
  event: any
  roomId: string
}>()

const emit = defineEmits<{
  react: []
  reply: []
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

const myUserId = computed(() => getClient().getUserId())
const isMine = computed(() => props.event.getSender() === myUserId.value)
const eventId = computed(() => props.event.getId() || '')
const body = computed(() => props.event.getContent()?.body || '')

const isPinned = computed(() => {
  if (!props.roomId || !eventId.value)
    return false
  return isMessagePinned(props.roomId, eventId.value)
})

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
  await redactMessage(props.roomId, eventId.value)
}

async function onTogglePin() {
  showMore.value = false
  if (!props.roomId || !eventId.value)
    return
  if (isPinned.value) {
    await unpinMessage(props.roomId, eventId.value)
  }
  else {
    await pinMessage(props.roomId, eventId.value)
  }
}

function onCopyText() {
  navigator.clipboard.writeText(body.value)
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
</script>

<template>
  <div
    class="action-bar flex items-center bg-popover border border-border rounded-md shadow-sm overflow-hidden"
    @mouseleave="showMore = false"
  >
    <!-- Add Reaction -->
    <button
      class="action-btn"
      :title="t('chat.add_reaction')"
      @click.stop="onReact"
    >
      <Smile :size="16" />
    </button>

    <!-- Reply -->
    <button
      class="action-btn"
      :title="t('common.reply')"
      @click.stop="onReply"
    >
      <Reply :size="16" />
    </button>

    <!-- More -->
    <div class="relative">
      <button
        class="action-btn"
        :title="t('chat.more_actions')"
        data-testid="message-more-trigger"
        @click.stop="showMore = !showMore"
      >
        <MoreHorizontal :size="16" />
      </button>

      <!-- Dropdown -->
      <Transition name="dropdown">
        <div
          v-if="showMore"
          class="absolute top-full right-0 mt-1 min-w-[160px] bg-card border border-[var(--color-muted)]/30 rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1 z-30"
          @click.stop
        >
          <!-- Edit (own msg) -->
          <button
            v-if="isMine"
            class="dropdown-item"
            @click.stop="onEdit"
          >
            <Edit :size="14" />
            <span>{{ t('chat.edit_message') }}</span>
          </button>

          <!-- Pin / Unpin -->
          <button
            class="dropdown-item"
            @click.stop="onTogglePin"
          >
            <component :is="isPinned ? PinOff : Pin" :size="14" />
            <span>{{ isPinned ? t('chat.unpin_message') : t('chat.pin_message') }}</span>
          </button>

          <!-- Open Thread -->
          <button
            class="dropdown-item"
            @click.stop="onOpenThread"
          >
            <MessageSquareText :size="14" />
            <span>{{ t('chat.thread') }}</span>
          </button>

          <button
            class="dropdown-item"
            data-testid="message-defer-trigger"
            @click.stop="onToggleDeferMenu"
          >
            <span>{{ t('chat.defer') }}</span>
          </button>

          <button
            class="dropdown-item"
            data-testid="message-convert-task-trigger"
            @click.stop="onOpenTaskComposer"
          >
            <span>{{ t('chat.convert_to_task') }}</span>
          </button>

          <div v-if="showDeferMenu" class="mx-2 my-1 rounded-md border border-[var(--color-muted)]/20 p-2">
            <div class="space-y-1">
              <button
                class="dropdown-item"
                data-testid="message-defer-preset-1h"
                @click.stop="createDeferredFromMessage('in-1-hour', '1h')"
              >
                <span>{{ t('chat.defer_preset_1h') }}</span>
              </button>
              <button
                class="dropdown-item"
                data-testid="message-defer-preset-tonight"
                @click.stop="createDeferredFromMessage('tonight', 'tonight')"
              >
                <span>{{ t('chat.defer_preset_tonight') }}</span>
              </button>
              <button
                class="dropdown-item"
                data-testid="message-defer-preset-tomorrow-morning"
                @click.stop="createDeferredFromMessage('tomorrow-morning', 'tomorrow-morning')"
              >
                <span>{{ t('chat.defer_preset_tomorrow_morning') }}</span>
              </button>
              <button
                class="dropdown-item"
                data-testid="message-defer-preset-tomorrow"
                @click.stop="createDeferredFromMessage('tomorrow', 'tomorrow')"
              >
                <span>{{ t('chat.defer_preset_tomorrow') }}</span>
              </button>
            </div>

            <button
              class="dropdown-item"
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

          <!-- Copy Text -->
          <button
            class="dropdown-item"
            @click.stop="onCopyText"
          >
            <Copy :size="14" />
            <span>{{ t('chat.copy_text') }}</span>
          </button>

          <!-- Copy Link -->
          <button
            class="dropdown-item"
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
            class="dropdown-item text-destructive"
            @click.stop="onDelete"
          >
            <Trash2 :size="14" />
            <span>{{ t('chat.delete_message') }}</span>
          </button>
        </div>
      </Transition>
    </div>

    <TaskComposerDialog
      :open="showTaskComposer"
      :initial-title="body"
      :submitting="creatingTask"
      @close="onCloseTaskComposer"
      @submit="onSubmitTask"
    />
  </div>
</template>

<style scoped>
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-muted-foreground);
  cursor: pointer;
  transition: all 0.1s ease;
}

.action-btn:hover {
  background: var(--color-muted);
  color: var(--color-foreground);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--color-muted-foreground);
  cursor: pointer;
  transition: background 0.1s ease;
}

.dropdown-item:hover {
  background: var(--color-primary);
  color: white;
}

.dropdown-item.text-destructive:hover {
  background: var(--color-destructive);
  color: white;
}

.dropdown-enter-active {
  transition: all 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-leave-active {
  transition: all 0.08s ease-in;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}
</style>
