<script setup lang="ts">
import type { SpaceMember } from '@/matrix/spaces'
import {
  AtSign,
  Ban,
  MessageCircle,
  MicOff,
  Pencil,
  User,
  UserX,
} from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { getClient } from '@/matrix/client'
import { findOrCreateDm } from '@/matrix/rooms'

const props = defineProps<{
  member: SpaceMember | null
  position: { x: number, y: number }
}>()

const emit = defineEmits<{
  close: []
  mention: [userId: string]
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
  // 简单取当前用户的 power level（需要房间上下文，这里近似）
  myPowerLevel.value = 0
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
  // TODO: 打开用户完整资料面板
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

// TODO: onChangeNickname, onMute, onKick, onBan — not yet implemented, buttons are disabled in template
</script>

<template>
  <Teleport to="body">
    <Transition name="ctx-menu">
      <div
        v-if="isOpen && member"
        ref="menuRef"
        class="fixed z-50 min-w-[180px] py-1.5 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]"
        :style="style"
        @contextmenu.prevent
      >
        <!-- 基础操作 -->
        <button class="ctx-item" @click="onProfile">
          <User :size="14" />
          <span>{{ t('member.profile') }}</span>
        </button>

        <button v-if="!isSelf" class="ctx-item" @click="onMessage">
          <MessageCircle :size="14" />
          <span>{{ t('member.message') }}</span>
        </button>

        <button class="ctx-item" @click="onMention">
          <AtSign :size="14" />
          <span>{{ t('member.mention') }}</span>
        </button>

        <!-- Admin 操作 -->
        <template v-if="isAdmin && !isSelf">
          <div class="ctx-divider" />

          <button class="ctx-item ctx-disabled" disabled title="Not implemented yet">
            <Pencil :size="14" />
            <span>{{ t('member.change_nickname') }}</span>
          </button>

          <button class="ctx-item ctx-disabled" disabled title="Not implemented yet">
            <MicOff :size="14" />
            <span>{{ t('member.mute') }}</span>
          </button>

          <div class="ctx-divider" />

          <button class="ctx-item ctx-danger ctx-disabled" disabled title="Not implemented yet">
            <UserX :size="14" />
            <span>{{ t('member.kick_title') }}</span>
          </button>

          <button class="ctx-item ctx-danger ctx-disabled" disabled title="Not implemented yet">
            <Ban :size="14" />
            <span>{{ t('member.ban_title') }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ctx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 8px);
  padding: 7px 14px;
  font-size: 13px;
  color: var(--color-foreground);
  cursor: pointer;
  transition: all 0.12s ease;
  border-radius: 6px;
  margin: 0 4px;
}
.ctx-item:hover {
  background: var(--color-accent);
}
.ctx-item:active {
  transform: scale(0.98);
}

.ctx-danger {
  color: var(--color-destructive);
}
.ctx-danger:hover {
  background: color-mix(in srgb, var(--color-destructive) 10%, transparent);
}

.ctx-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ctx-disabled:hover {
  background: transparent;
}

.ctx-divider {
  height: 1px;
  margin: 4px 12px;
  background: var(--color-border);
  opacity: 0.5;
}

/* 动画 */
.ctx-menu-enter-active {
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.ctx-menu-leave-active {
  transition: all 0.12s ease-in;
}
.ctx-menu-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(-4px);
}
.ctx-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
