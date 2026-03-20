<script setup lang="ts">
import type { SpaceMember } from '@/matrix/spaces'
import { MessageCircle, X } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { avatarGradient } from '@/features/chat/lib/format'
import { getClient } from '@/matrix/client'
import { getUserPresenceInfo } from '@/matrix/profile'
import { findOrCreateDm } from '@/matrix/rooms'
import { Avatar } from '@/shared/components/ui/avatar'

const props = defineProps<{
  member: SpaceMember | null
  position: { x: number, y: number }
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const isVisible = computed(() => !!props.member)

// ── 头像 ──
const avatarMxc = computed(() => props.member?.avatarUrl)
const fallbackGradient = computed(() => props.member ? avatarGradient(props.member.userId) : '')

// ── 状态 ──
const presence = computed(() => {
  if (!props.member)
    return { presence: 'offline' }
  return getUserPresenceInfo(props.member.userId)
})

const presenceLabel = computed(() => {
  switch (presence.value.presence) {
    case 'online': return 'Online'
    case 'unavailable': return 'Idle'
    case 'busy': return 'Do Not Disturb'
    default: return 'Offline'
  }
})

const presenceDotColor = computed(() => {
  switch (presence.value.presence) {
    case 'online': return 'bg-success'
    case 'unavailable': return 'bg-warning'
    case 'busy': return 'bg-destructive'
    default: return 'bg-muted-foreground/50'
  }
})

// ── 角色 ──
const roleLabel = computed(() => {
  if (!props.member)
    return ''
  const pl = props.member.powerLevel
  if (pl >= 100)
    return 'Owner'
  if (pl >= 75)
    return 'Admin'
  if (pl >= 50)
    return 'Moderator'
  return 'Member'
})

const roleColor = computed(() => {
  if (!props.member)
    return ''
  const pl = props.member.powerLevel
  if (pl >= 100)
    return '#c08b2e'
  if (pl >= 75)
    return '#b85c4a'
  if (pl >= 50)
    return '#4a9882'
  return 'var(--color-muted-foreground)'
})

// ── 面板定位 ──
const panelStyle = computed(() => {
  if (!isVisible.value)
    return { display: 'none' }
  const panelW = 300
  const panelH = 340
  const margin = 8
  let x = props.position.x + margin
  let y = props.position.y

  if (x + panelW > window.innerWidth - margin) {
    x = props.position.x - panelW - margin
  }
  if (x < margin)
    x = margin
  if (y + panelH > window.innerHeight - margin) {
    y = window.innerHeight - panelH - margin
  }
  if (y < margin)
    y = margin

  return {
    position: 'fixed' as const,
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 100,
  }
})

// ── 发起私聊 ──
const isSelf = computed(() => {
  if (!props.member)
    return true
  const myId = getClient().getUserId()
  return props.member.userId === myId
})

async function onMessage() {
  if (!props.member || isSelf.value)
    return
  emit('close')
  try {
    const _roomId = await findOrCreateDm(props.member.userId)
    // 跳转由外部通过事件处理或 router 处理
    // 这里只确保房间已创建
  }
  catch (err) {
    console.error('Failed to open DM:', err)
    toast.error(t('auth.error'))
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- 遮罩 -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isVisible"
        class="fixed inset-0 z-[99] bg-black/5 backdrop-blur-[1px]"
        @click="emit('close')"
      />
    </Transition>

    <!-- Popover 面板 -->
    <Transition
      enter-active-class="transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      leave-active-class="transition-all duration-150 ease-[cubic-bezier(0.4,0,1,1)]"
      enter-from-class="scale-[0.92] opacity-0 -translate-y-1"
      leave-to-class="scale-[0.96] opacity-0 -translate-y-0.5"
    >
      <div
        v-if="isVisible && member"
        :style="panelStyle"
        class="w-[300px] bg-popover/95 text-popover-foreground rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.06)] overflow-hidden backdrop-blur-xl"
      >
        <!-- Banner -->
        <div
          class="h-14 relative overflow-hidden"
          :style="{ background: fallbackGradient }"
        >
          <div class="absolute inset-0 bg-gradient-to-b from-white/10 to-black/10" />
          <button
            class="absolute top-2 right-2 p-1 rounded-lg bg-black/15 hover:bg-black/25 text-white/80 hover:text-white transition-all duration-150"
            @click="emit('close')"
          >
            <X :size="13" />
          </button>
        </div>

        <!-- 头像 -->
        <div class="flex flex-col items-center -mt-8 px-5 pb-1">
          <div class="relative">
            <Avatar
              :src="avatarMxc"
              :alt="member.displayName"
              :color-id="member.userId"
              size="xl"
              shape="rounded"
              class="ring-[3px] ring-popover shadow-md"
            />
            <!-- 状态圆点 -->
            <div
              class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ring-[3px] ring-popover"
              :class="presenceDotColor"
            />
          </div>

          <!-- Display Name -->
          <h3 class="mt-3 text-base font-semibold truncate max-w-full">
            {{ member.displayName }}
          </h3>

          <!-- User ID -->
          <p class="text-xs text-muted-foreground/60 mt-0.5 truncate max-w-full font-mono">
            {{ member.userId }}
          </p>

          <!-- 在线状态文字 -->
          <div class="flex items-center gap-1.5 mt-1.5">
            <div class="w-2 h-2 rounded-full" :class="presenceDotColor" />
            <span class="text-xs text-muted-foreground">{{ presenceLabel }}</span>
          </div>
        </div>

        <!-- 角色 Badge -->
        <div class="px-5 pt-2 pb-1">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">Roles</span>
          </div>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border"
              :style="{
                borderColor: roleColor,
                color: roleColor,
              }"
            >
              <span
                class="w-1.5 h-1.5 rounded-full mr-1.5"
                :style="{ backgroundColor: roleColor }"
              />
              {{ roleLabel }}
            </span>
          </div>
        </div>

        <!-- Divider -->
        <div class="mx-5 my-2 h-px bg-border/50" />

        <!-- 操作按钮 -->
        <div class="px-5 pb-4 pt-1">
          <button
            v-if="!isSelf"
            class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 active:scale-[0.98] transition-all duration-150 shadow-sm"
            @click="onMessage"
          >
            <MessageCircle :size="14" />
            Message
          </button>
          <p
            v-else
            class="text-center text-xs text-muted-foreground/40"
          >
            This is you
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
