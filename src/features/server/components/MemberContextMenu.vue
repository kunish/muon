<script setup lang="ts">
import type { SpaceMember } from '@/matrix/spaces'
import { ask } from '@tauri-apps/plugin-dialog'
import {
  AtSign,
  Ban,
  MessageCircle,
  MicOff,
  Pencil,
  User,
  UserX,
} from 'lucide-vue-next'
import { EventType } from 'matrix-js-sdk'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { blockUser } from '@/matrix/blocking'
import { getClient } from '@/matrix/client'
import { findOrCreateDm } from '@/matrix/rooms'

const props = defineProps<{
  member: SpaceMember | null
  serverId?: string
  position: { x: number, y: number }
}>()

const emit = defineEmits<{
  close: []
  mention: [userId: string]
  profile: [userId: string]
}>()

const menuRef = ref<HTMLElement | null>(null)
const isOpen = computed(() => !!props.member)
const { t } = useI18n()

// ── 权限判断 ──

const myPowerLevel = ref(0)

watch(() => props.member, () => {
  const client = getClient()
  const myId = client.getUserId()
  if (!myId)
    return

  try {
    const room = client.getRoom(props.serverId)
    const powerLevelsEvent = room?.currentState.getStateEvents('m.room.power_levels', '')
    const powerLevels = powerLevelsEvent?.getContent()
    myPowerLevel.value = powerLevels?.users?.[myId] ?? powerLevels?.users_default ?? 0
  }
  catch {
    myPowerLevel.value = 0
  }
})

const isAdmin = computed(() => myPowerLevel.value >= 50)
const isSelf = computed(() => {
  if (!props.member)
    return false
  return props.member.userId === getClient().getUserId()
})

// ── 定位 ──

const style = computed(() => {
  if (!isOpen.value)
    return { display: 'none' }
  const menuW = 200
  const menuH = 280
  const margin = 4
  let x = props.position.x
  let y = props.position.y

  if (x + menuW > window.innerWidth - margin) {
    x = window.innerWidth - menuW - margin
  }
  if (x < margin)
    x = margin
  if (y + menuH > window.innerHeight - margin) {
    y = window.innerHeight - menuH - margin
  }
  if (y < margin)
    y = margin

  return {
    left: `${x}px`,
    top: `${y}px`,
  }
})

// ── 点击外部关闭 ──

function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

watch(isOpen, (open) => {
  if (open) {
    setTimeout(() => document.addEventListener('mousedown', onClickOutside), 0)
  }
  else {
    document.removeEventListener('mousedown', onClickOutside)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
})

// ── 操作 ──

function onProfile() {
  if (!props.member)
    return
  emit('profile', props.member.userId)
  emit('close')
}

async function onMessage() {
  if (!props.member)
    return
  emit('close')
  try {
    await findOrCreateDm(props.member.userId)
  }
  catch (err) {
    console.error('Failed to open DM:', err)
    toast.error(t('auth.error'))
  }
}

function onMention() {
  if (!props.member)
    return
  emit('mention', props.member.userId)
  emit('close')
}

async function onChangeNickname() {
  if (!props.member || !props.serverId)
    return

  // eslint-disable-next-line no-alert -- Tauri has no input prompt dialog; window.prompt is the simplest option
  const nextNickname = window.prompt(t('member.change_nickname'), props.member.displayName)?.trim()
  if (!nextNickname || nextNickname === props.member.displayName)
    return

  try {
    const client = getClient()
    const room = client.getRoom(props.serverId)
    const memberState = room?.currentState.getStateEvents('m.room.member', props.member.userId)
    const currentContent = memberState?.getContent?.() ?? {}

    await client.sendStateEvent(
      props.serverId,
      EventType.RoomMember,
      {
        ...currentContent,
        membership: 'join',
        displayname: nextNickname,
      },
      props.member.userId,
    )
    emit('close')
  }
  catch (err) {
    console.error('Failed to change nickname:', err)
    toast.error(t('auth.error'))
  }
}

async function onMute() {
  if (!props.member)
    return
  try {
    await blockUser(props.member.userId)
    emit('close')
  }
  catch (err) {
    console.error('Failed to mute user:', err)
    toast.error(t('auth.error'))
  }
}

async function onKick() {
  if (!props.member || !props.serverId)
    return
  const confirmKick = await ask(t('member.kick_confirm_msg', { name: props.member.displayName }), {
    title: t('member.kick'),
    kind: 'warning',
  })
  if (!confirmKick)
    return

  try {
    await getClient().kick(props.serverId, props.member.userId, 'Kicked by admin')
    emit('close')
  }
  catch (err) {
    console.error('Failed to kick member:', err)
    toast.error(t('auth.error'))
  }
}

async function onBan() {
  if (!props.member || !props.serverId)
    return
  const confirmBan = await ask(t('member.ban_confirm_msg', { name: props.member.displayName }), {
    title: t('member.ban'),
    kind: 'warning',
  })
  if (!confirmBan)
    return

  try {
    await getClient().ban(props.serverId, props.member.userId, 'Banned by admin')
    emit('close')
  }
  catch (err) {
    console.error('Failed to ban member:', err)
    toast.error(t('auth.error'))
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      leave-active-class="transition-all duration-[120ms] ease-in"
      enter-from-class="translate-y-[-4px] scale-95 opacity-0"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="isOpen && member"
        ref="menuRef"
        class="fixed z-50 min-w-[180px] py-1.5 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]"
        :style="style"
        @contextmenu.prevent
      >
        <!-- 基础操作 -->
        <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-100 hover:bg-accent active:scale-[0.98]" @click="onProfile">
          <User :size="14" />
          <span>{{ t('member.profile') }}</span>
        </button>

        <button v-if="!isSelf" class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-100 hover:bg-accent active:scale-[0.98]" @click="onMessage">
          <MessageCircle :size="14" />
          <span>{{ t('member.message') }}</span>
        </button>

        <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-100 hover:bg-accent active:scale-[0.98]" @click="onMention">
          <AtSign :size="14" />
          <span>{{ t('member.mention') }}</span>
        </button>

        <!-- Admin 操作 -->
        <template v-if="isAdmin && !isSelf">
          <div class="mx-3 my-1 h-px bg-border/50" />

          <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-100 hover:bg-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent" :disabled="!serverId" :title="!serverId ? t('member.missing_server_id') : undefined" @click="onChangeNickname">
            <Pencil :size="14" />
            <span>{{ t('member.change_nickname') }}</span>
          </button>

          <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-100 hover:bg-accent active:scale-[0.98]" @click="onMute">
            <MicOff :size="14" />
            <span>{{ t('member.mute') }}</span>
          </button>

          <div class="mx-3 my-1 h-px bg-border/50" />

          <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-destructive transition-all duration-100 hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent" :disabled="!serverId" :title="!serverId ? t('member.missing_server_id') : undefined" @click="onKick">
            <UserX :size="14" />
            <span>{{ t('member.kick_title') }}</span>
          </button>

          <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-destructive transition-all duration-100 hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent" :disabled="!serverId" :title="!serverId ? t('member.missing_server_id') : undefined" @click="onBan">
            <Ban :size="14" />
            <span>{{ t('member.ban_title') }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>
