<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useGlobalUiStore } from '../../stores/globalUiStore'
import { getWorkspaceAppForPath, workspaceApps } from './navigation'

withDefaults(defineProps<{
  messageUnreadCount?: number
}>(), {
  messageUnreadCount: 0,
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const globalUi = useGlobalUiStore()

const activeApp = computed(() => getWorkspaceAppForPath(route.path))

function openApp(path: string): void {
  router.push(path)
}
</script>

<template>
  <nav class="workspace-rail flex h-full w-[72px] shrink-0 select-none flex-col items-center border-r border-sidebar-border bg-server-bar px-2 py-3 shadow-[1px_0_0_color-mix(in_srgb,var(--color-border)_70%,transparent)]">
    <div class="mb-3 flex size-11 items-center justify-center rounded-[18px] shadow-[0_12px_28px_color-mix(in_srgb,var(--color-primary)_30%,transparent)]" title="Muon">
      <img
        data-testid="workspace-brand-logo"
        src="/muon-logo.svg"
        alt="Muon"
        class="size-10 rounded-[16px]"
        draggable="false"
      >
    </div>

    <button
      class="mb-2 flex size-12 items-center justify-center rounded-[18px] text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="workspace-global-search"
      :aria-label="t('settings.shortcut_search')"
      :title="`${t('settings.shortcut_search')} (Ctrl/Cmd + K)`"
      @click="globalUi.openGlobalSearch"
    >
      <Search :size="20" class="shrink-0" />
      <span class="sr-only">{{ t('settings.shortcut_search') }}</span>
    </button>

    <div class="flex w-full flex-1 flex-col items-center gap-2">
      <button
        v-for="app in workspaceApps"
        :key="app.id"
        class="group relative flex size-12 items-center justify-center rounded-[18px] text-[11px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="activeApp.id === app.id ? 'bg-primary/12 text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'"
        :data-testid="`workspace-app-${app.id}`"
        :aria-current="activeApp.id === app.id ? 'page' : undefined"
        :aria-label="t(app.labelKey)"
        :title="t(app.labelKey)"
        @click="openApp(app.path)"
      >
        <component :is="app.icon" :size="20" class="shrink-0" />
        <span class="sr-only" :data-testid="`workspace-app-label-${app.id}`">{{ t(app.labelKey) }}</span>
        <span
          v-if="app.id === 'messages' && messageUnreadCount > 0"
          class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
        >
          {{ messageUnreadCount > 99 ? '99+' : messageUnreadCount }}
        </span>
      </button>
    </div>
  </nav>
</template>
