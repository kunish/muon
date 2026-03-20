<script setup lang="ts">
/**
 * 消息分组组件
 *
 * 将来自同一用户、5 分钟窗口内的连续消息分为一组：
 * - 组内首条消息显示头像 + 用户名(彩色) + 时间戳
 * - 续接消息不显示头像/用户名，悬浮时在头像列显示 HH:MM
 * - 系统事件（加入、退出等）独立渲染
 * - 未读分割线在适当位置插入
 */
import type { MatrixEvent } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'
import { isSystemEvent } from '@matrix/index'
import { computed } from 'vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import ChatMessage from './ChatMessage.vue'
import MessageGroupAvatar from './MessageGroupAvatar.vue'
import NewMessageSeparator from './NewMessageSeparator.vue'
import SystemMessage from './SystemMessage.vue'
import TimeStamp from './TimeStamp.vue'

const props = defineProps<{
  events: MatrixEvent[]
  roomId: string
  /** 未读分割线应插入在该 eventId 之前（由父组件提供），为空则不显示 */
  unreadEventId?: string | null
}>()

const emit = defineEmits<{
  avatarClick: [userId: string, event: MouseEvent]
  userClick: [userId: string, event: MouseEvent]
}>()

const settingsStore = useSettingsStore()
const currentUserId = computed(() => getClient().getUserId() || '')

function isRightAlignedGroup(senderId: string): boolean {
  return settingsStore.messageAlignment === 'leftright' && senderId === currentUserId.value
}

/**
 * 分组策略：同一发送者的连续消息合并为一组。
 *
 * 注意：这里不再使用固定时间窗口（如 5 分钟）切组，
 * 因为产品要求是"按用户连续消息分组"，
 * 只要中间没有其他用户/系统消息，就保持同组。
 */

// --- 时间分割线（跨日历日时显示） ---
function isDifferentDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1)
  const d2 = new Date(ts2)
  return d1.getFullYear() !== d2.getFullYear()
    || d1.getMonth() !== d2.getMonth()
    || d1.getDate() !== d2.getDate()
}

function shouldShowTimeDivider(idx: number): boolean {
  if (idx === 0)
    return true
  const prev = props.events[idx - 1]
  const curr = props.events[idx]
  return isDifferentDay(prev.getTs(), curr.getTs())
}

// --- 消息分组 ---
interface MessageGroup {
  type: 'user' | 'system'
  senderId: string
  messages: { event: MatrixEvent, idx: number, isFirst: boolean }[]
}

const messageGroups = computed((): MessageGroup[] => {
  const events = props.events
  if (!events.length)
    return []

  const groups: MessageGroup[] = []
  let currentGroup: MessageGroup | null = null

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    // 某些事件（尤其本地回显/解密过渡期）sender 可能短暂为空，
    // 使用当前组 sender 或当前用户兜底，避免错误切组。
    const sender: string = (ev.getSender() || currentGroup?.senderId || currentUserId.value || '') as string

    // 系统事件总是独立一组
    if (isSystemEvent(ev)) {
      if (currentGroup) {
        groups.push(currentGroup)
        currentGroup = null
      }
      groups.push({
        type: 'system',
        senderId: '__system__',
        messages: [{ event: ev, idx: i, isFirst: true }],
      })
      continue
    }

    // 检查是否需要断开分组：
    // 1. 不同发送者
    // 2. 前一组是系统事件
    const shouldBreak = !currentGroup
      || currentGroup.type === 'system'
      || currentGroup.senderId !== sender

    if (shouldBreak) {
      if (currentGroup)
        groups.push(currentGroup)
      currentGroup = {
        type: 'user',
        senderId: sender,
        messages: [{ event: ev, idx: i, isFirst: true }],
      }
    }
    else {
      currentGroup!.messages.push({ event: ev, idx: i, isFirst: false })
    }
  }

  if (currentGroup)
    groups.push(currentGroup)
  return groups
})
</script>

<template>
  <div>
    <template
      v-for="(group, gIdx) in messageGroups"
      :key="`g-${gIdx}-${group.messages[0].event.getId()}`"
    >
      <!-- 系统事件 -->
      <template v-if="group.type === 'system'">
        <template v-for="item in group.messages" :key="item.event.getId()">
          <!-- 时间分割线 -->
          <TimeStamp
            v-if="shouldShowTimeDivider(item.idx)"
            :timestamp="item.event.getTs()"
          />
          <!-- 未读分割线 -->
          <NewMessageSeparator
            v-if="unreadEventId && item.event.getId() === unreadEventId"
          />
          <div :data-event-id="item.event.getId()">
            <SystemMessage
              :event="item.event"
              @user-click="(userId, e) => emit('userClick', userId, e)"
            />
          </div>
        </template>
      </template>

      <!-- 用户消息组 -->
      <template v-else>
        <div
          class="group-shell relative mt-[1.0625rem] grid overflow-visible"
          :class="isRightAlignedGroup(group.senderId)
            ? 'grid-cols-[minmax(0,1fr)_2.5rem] items-stretch gap-x-3 pr-4 pl-12'
            : 'grid-cols-[2.5rem_minmax(0,1fr)] items-stretch gap-x-4 pr-12 pl-4'"
        >
          <!-- 左侧粘性头像（他人消息） -->
          <div
            v-if="!isRightAlignedGroup(group.senderId)"
            class="col-start-1 flex flex-col justify-end self-stretch overflow-visible"
          >
            <div class="sticky bottom-1 top-3 z-[1] self-end">
              <MessageGroupAvatar
                :sender-id="group.senderId"
                :room-id="roomId"
                @avatar-click="(userId, e) => emit('avatarClick', userId, e)"
              />
            </div>
          </div>

          <div
            class="min-w-0 flex flex-col"
            :class="isRightAlignedGroup(group.senderId)
              ? 'col-start-1 self-start w-full items-end max-w-[min(72%,900px)] justify-self-end'
              : 'col-start-2 self-start w-full items-start'"
          >
            <template v-for="(item, mIdx) in group.messages" :key="item.event.getId()">
              <!-- 时间分割线（仅在组首条之前） -->
              <TimeStamp
                v-if="mIdx === 0 && shouldShowTimeDivider(item.idx)"
                :timestamp="item.event.getTs()"
              />
              <!-- 未读分割线 -->
              <NewMessageSeparator
                v-if="unreadEventId && item.event.getId() === unreadEventId"
              />
              <div :data-event-id="item.event.getId()">
                <ChatMessage
                  :event="item.event"
                  :is-first="item.isFirst"
                  :room-id="roomId"
                  :hide-avatar-column="true"
                  @avatar-click="(userId, e) => emit('avatarClick', userId, e)"
                />
              </div>
            </template>
          </div>

          <!-- 右侧粘性头像（自己消息） -->
          <div
            v-if="isRightAlignedGroup(group.senderId)"
            class="col-start-2 flex flex-col justify-end self-stretch overflow-visible"
          >
            <div class="sticky bottom-1 top-3 z-[1] self-end">
              <MessageGroupAvatar
                :sender-id="group.senderId"
                :room-id="roomId"
                @avatar-click="(userId, e) => emit('avatarClick', userId, e)"
              />
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
