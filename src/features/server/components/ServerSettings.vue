<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useServerStore } from '@/features/server/stores/serverStore'
import ChannelManager from './ChannelManager.vue'
import MemberManager from './MemberManager.vue'
import RoleManager from './RoleManager.vue'
import ServerOverview from './ServerOverview.vue'

const open = defineModel<boolean>('open', { default: false })

const serverStore = useServerStore()

const currentSection = ref<'overview' | 'roles' | 'channels' | 'members'>('overview')

const currentServer = computed(() => {
  if (!serverStore.currentServerId)
    return null
  return serverStore.servers.find(s => s.spaceId === serverStore.currentServerId) ?? null
})

const navSections = [
  { key: 'overview' as const, label: 'Overview' },
  { key: 'roles' as const, label: 'Roles' },
  { key: 'channels' as const, label: 'Channels' },
  { key: 'members' as const, label: 'Members' },
]

function close() {
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="settings-overlay">
      <div
        v-if="open && currentServer"
        class="fixed inset-0 z-[100] flex bg-[#111214]"
      >
        <!-- Left nav sidebar -->
        <div class="flex w-[218px] shrink-0 flex-col items-end bg-[#1e1f22] overflow-y-auto">
          <nav class="w-[190px] py-[60px] pr-2 pl-5">
            <div class="mb-2 px-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground/50">
              {{ currentServer.name }}
            </div>
            <button
              v-for="section in navSections"
              :key="section.key"
              class="flex w-full items-center rounded-[4px] px-2.5 py-1.5 text-[15px] font-medium transition-colors"
              :class="
                currentSection === section.key
                  ? 'bg-accent/40 text-foreground'
                  : 'text-muted-foreground hover:bg-accent/20 hover:text-foreground'
              "
              @click="currentSection = section.key"
            >
              {{ section.label }}
            </button>
          </nav>
        </div>

        <!-- Right content area -->
        <div class="relative flex flex-1 flex-col overflow-hidden">
          <!-- Close button -->
          <button
            class="absolute right-4 top-[60px] z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#4e5058]/40 text-muted-foreground transition-colors hover:border-[#4e5058] hover:text-foreground"
            title="ESC"
            @click="close"
          >
            <X :size="18" />
          </button>
          <div class="absolute right-[9px] top-[96px] text-[11px] font-semibold text-muted-foreground/50">
            ESC
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto py-[60px] pl-10 pr-20 scrollbar-thin">
            <div class="max-w-[660px]">
              <ServerOverview
                v-if="currentSection === 'overview'"
                :server-id="currentServer.spaceId"
                :server-name="currentServer.name"
                :server-topic="currentServer.topic"
                :server-avatar="currentServer.avatar"
              />
              <RoleManager
                v-else-if="currentSection === 'roles'"
                :server-id="currentServer.spaceId"
              />
              <ChannelManager
                v-else-if="currentSection === 'channels'"
                :server-id="currentServer.spaceId"
              />
              <MemberManager
                v-else-if="currentSection === 'members'"
                :server-id="currentServer.spaceId"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-overlay-enter-active {
  transition: opacity 0.15s ease-out;
}
.settings-overlay-leave-active {
  transition: opacity 0.1s ease-in;
}
.settings-overlay-enter-from,
.settings-overlay-leave-to {
  opacity: 0;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--color-muted-foreground);
  opacity: 0.15;
  border-radius: 3px;
}
</style>
