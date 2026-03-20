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
      class="group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] transition-all duration-200"
      :class="isActive(item.name) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
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
      <span class="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-[0_4px_12px_rgba(0,0,0,0.1)] group-hover:block">{{ t(item.labelKey) }}</span>
    </button>

    <!-- Divider -->
    <div class="w-6 h-px bg-border/60 my-1" />

    <!-- Tool navigation -->
    <button
      v-for="item in toolNavItems"
      :key="item.name"
      class="group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] transition-all duration-200"
      :class="isActive(item.name) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
      :title="t(item.labelKey)"
      @click="router.push(item.path)"
    >
      <component :is="item.icon" :size="20" />
      <span class="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-[0_4px_12px_rgba(0,0,0,0.1)] group-hover:block">{{ t(item.labelKey) }}</span>
    </button>

    <!-- Bottom tools -->
    <div class="mt-auto flex flex-col items-center gap-1.5">
      <button
        class="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
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
        class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
        :title="t('sidebar.settings')"
        @click="router.push('/settings')"
      >
        <Settings :size="20" />
      </button>

      <ThemeToggle />
    </div>
  </nav>
</template>
