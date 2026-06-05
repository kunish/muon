<script setup lang="ts">
import type { WorkspaceApp } from './navigation';
import { Search } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { openGlobalSearch } from '../../stores/globalUiStore';
import { footerWorkspaceApps, getWorkspaceAppForPath, primaryWorkspaceApps } from './navigation';

withDefaults(
  defineProps<{
    messageUnreadCount?: number;
  }>(),
  {
    messageUnreadCount: 0,
  },
);

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const lastMessagesPath = ref('/dm');

const activeApp = computed(() => getWorkspaceAppForPath(route.path));

watch(
  () => route.fullPath,
  () => {
    if (activeApp.value.id === 'messages') {
      lastMessagesPath.value = route.fullPath || route.path || '/dm';
    }
  },
  { immediate: true },
);

function openApp(app: WorkspaceApp): void {
  router.push(app.id === 'messages' ? lastMessagesPath.value : app.path);
}
</script>

<template>
  <nav
    data-testid="workspace-app-rail"
    class="workspace-rail relative flex h-full w-16 shrink-0 select-none flex-col items-center overflow-hidden border-r border-sidebar-border bg-server-bar py-4"
  >
    <div data-testid="workspace-app-rail-content" class="flex h-full w-full flex-col items-center overflow-hidden">
      <div
        class="mb-6 flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/12"
        title="Muon"
      >
        <img
          data-testid="workspace-brand-logo"
          src="/muon-logo.svg"
          alt="Muon"
          class="size-8 rounded-md"
          draggable="false"
        />
      </div>

      <div class="muon-scrollbar-hidden flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto px-2">
        <button
          v-for="app in primaryWorkspaceApps"
          :key="app.id"
          class="group relative flex h-10 w-full items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="
            activeApp.id === app.id
              ? 'bg-sidebar-accent text-primary before:absolute before:left-[-8px] before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:bg-primary before:content-[\'\']'
              : ''
          "
          :data-testid="`workspace-app-${app.id}`"
          :aria-current="activeApp.id === app.id ? 'page' : undefined"
          :aria-label="t(app.labelKey)"
          :title="t(app.labelKey)"
          @click="openApp(app)"
        >
          <component :is="app.icon" :size="16" class="shrink-0" />
          <span
            v-if="app.id === 'messages' && messageUnreadCount > 0"
            class="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
          >
            {{ messageUnreadCount > 99 ? '99+' : messageUnreadCount }}
          </span>
        </button>
      </div>

      <div class="flex w-full flex-col items-center gap-2 px-2">
        <button
          class="relative flex h-10 w-full items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="workspace-global-search"
          :aria-label="t('settings.shortcut_search')"
          :title="`${t('settings.shortcut_search')} (Ctrl/Cmd + K)`"
          @click="openGlobalSearch"
        >
          <Search :size="16" aria-hidden="true" />
        </button>

        <button
          v-for="app in footerWorkspaceApps"
          :key="app.id"
          class="group relative flex h-10 w-full items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="
            activeApp.id === app.id
              ? 'bg-sidebar-accent text-primary before:absolute before:left-[-8px] before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:bg-primary before:content-[\'\']'
              : ''
          "
          :data-testid="`workspace-app-${app.id}`"
          :aria-current="activeApp.id === app.id ? 'page' : undefined"
          :aria-label="t(app.labelKey)"
          :title="t(app.labelKey)"
          @click="openApp(app)"
        >
          <component :is="app.icon" :size="16" class="shrink-0" />
        </button>
      </div>
    </div>
  </nav>
</template>
