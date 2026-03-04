<script setup lang="ts">
import { Calendar, CheckSquare, Download, FileText, Mail, MessageCircle, Settings, Users, Video } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useConversations } from '../../features/chat/composables/useConversations'
import { useDownloadStore } from '../../features/chat/stores/downloadStore'
import ThemeToggle from './ThemeToggle.vue'

const emit = defineEmits<{ toggleDownloads: [] }>()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const downloadStore = useDownloadStore()
const { totalUnreadCount } = useConversations()

const mainNavItems = [
  { icon: MessageCircle, path: '/chat', name: 'chat', labelKey: 'sidebar.messages' },
  { icon: Users, path: '/contacts', name: 'contacts', labelKey: 'sidebar.contacts' },
  { icon: Calendar, path: '/calendar', name: 'calendar', labelKey: 'sidebar.calendar' },
  { icon: Video, path: '/calls', name: 'calls', labelKey: 'sidebar.video_meetings' },
  { icon: FileText, path: '/docs', name: 'docs', labelKey: 'sidebar.docs' },
]

const toolNavItems = [
  { icon: CheckSquare, path: '/approvals', name: 'approvals', labelKey: 'sidebar.approvals' },
  { icon: Mail, path: '/email', name: 'email', labelKey: 'sidebar.email' },
]

function isActive(name: string) {
  return route.matched.some(r => r.name === name)
}
</script>

<template>
  <nav class="flex flex-col items-center w-[60px] bg-muted py-4 gap-1.5">
    <!-- Main navigation -->
    <button
      v-for="item in mainNavItems"
      :key="item.name"
      class="sidebar-btn group relative"
      :class="isActive(item.name) ? 'sidebar-btn-active' : 'sidebar-btn-inactive'"
      :title="t(item.labelKey)"
      @click="router.push(item.path)"
    >
      <component :is="item.icon" :size="20" />
      <span
        v-if="item.name === 'chat' && totalUnreadCount > 0"
        class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium rounded-full bg-destructive text-destructive-foreground"
      >
        {{ totalUnreadCount > 99 ? '99+' : totalUnreadCount }}
      </span>
      <span class="sidebar-tooltip">{{ t(item.labelKey) }}</span>
    </button>

    <!-- Divider -->
    <div class="w-6 h-px bg-border/60 my-1" />

    <!-- Tool navigation -->
    <button
      v-for="item in toolNavItems"
      :key="item.name"
      class="sidebar-btn group relative"
      :class="isActive(item.name) ? 'sidebar-btn-active' : 'sidebar-btn-inactive'"
      :title="t(item.labelKey)"
      @click="router.push(item.path)"
    >
      <component :is="item.icon" :size="20" />
      <span class="sidebar-tooltip">{{ t(item.labelKey) }}</span>
    </button>

    <!-- Bottom tools -->
    <div class="mt-auto flex flex-col items-center gap-1.5">
      <button
        class="sidebar-btn sidebar-btn-inactive relative"
        :title="t('downloads.title')"
        @click="emit('toggleDownloads')"
      >
        <Download :size="20" />
        <span
          v-if="downloadStore.activeCount > 0"
          class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium rounded-full bg-primary text-primary-foreground"
        >
          {{ downloadStore.activeCount }}
        </span>
      </button>

      <button
        class="sidebar-btn sidebar-btn-inactive"
        :title="t('sidebar.settings')"
        @click="router.push('/settings')"
      >
        <Settings :size="20" />
      </button>

      <ThemeToggle />
    </div>
  </nav>
</template>

<style scoped>
.sidebar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.sidebar-btn-active {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.sidebar-btn-inactive {
  color: var(--color-muted-foreground);
}
.sidebar-btn-inactive:hover {
  background: var(--color-accent);
  color: var(--color-foreground);
}

.sidebar-tooltip {
  display: none;
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 8px;
  padding: 4px 10px;
  font-size: 12px;
  white-space: nowrap;
  background: var(--color-popover);
  color: var(--color-popover-foreground);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 50;
  pointer-events: none;
}

.group:hover .sidebar-tooltip {
  display: block;
}
</style>
