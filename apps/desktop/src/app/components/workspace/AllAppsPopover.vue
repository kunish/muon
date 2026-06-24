<script setup lang="ts">
import type { WorkspaceApp } from './navigation';
import { useStore } from '@tanstack/vue-store';
import { Pin } from 'lucide-vue-next';
import { settingsStore, togglePinnedApp } from '@/shared/stores/settingsStore';
import { primaryWorkspaceApps } from './navigation';

const emit = defineEmits<{ open: [app: WorkspaceApp] }>();

const { t } = useI18n();
const pinnedIds = useStore(settingsStore, (s) => s.pinnedApps);

function isPinned(id: string): boolean {
  return pinnedIds.value.includes(id);
}
</script>

<template>
  <div data-testid="all-apps-panel" class="w-72 p-2">
    <div class="mb-2 px-1 text-xs font-medium text-muted-foreground">{{ t('sidebar.allApps') }}</div>
    <div class="grid grid-cols-4 gap-1">
      <div v-for="app in primaryWorkspaceApps" :key="app.id" class="group relative">
        <button
          type="button"
          class="flex h-16 w-full flex-col items-center justify-center gap-1 rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :data-testid="`all-apps-open-${app.id}`"
          :aria-label="t(app.labelKey)"
          @click="emit('open', app)"
        >
          <component :is="app.icon" :size="18" aria-hidden="true" />
          <span class="max-w-full truncate px-0.5 text-[10px] leading-tight">{{ t(app.labelKey) }}</span>
        </button>
        <button
          type="button"
          class="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100"
          :class="isPinned(app.id) ? 'text-primary opacity-100' : ''"
          :data-testid="`all-apps-pin-${app.id}`"
          :aria-label="isPinned(app.id) ? t('sidebar.unpinApp') : t('sidebar.pinApp')"
          @click.stop="togglePinnedApp(app.id)"
        >
          <Pin :size="11" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
