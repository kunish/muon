<script setup lang="ts">
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useResizablePane } from '@/shared/composables/useResizablePane'
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

const RAIL_WIDTH_STORAGE_KEY = 'muon_workspace_rail_width'
const RAIL_COLLAPSED_STORAGE_KEY = 'muon_workspace_rail_collapsed'
const DEFAULT_RAIL_WIDTH = 148
const MIN_RAIL_WIDTH = 132
const MAX_RAIL_WIDTH = 188
const COLLAPSED_RAIL_WIDTH = 72
const RAIL_COLLAPSE_THRESHOLD = 104

const activeApp = computed(() => getWorkspaceAppForPath(route.path))
const {
  paneWidth: railWidth,
  paneStyle: railStyle,
  isCollapsed: isRailCollapsed,
  isResizing: isRailResizing,
  startResize: startRailResize,
  toggleCollapse: toggleRailCollapse,
  restorePane: restoreRail,
  onResizeHandleKeydown,
} = useResizablePane({
  widthStorageKey: RAIL_WIDTH_STORAGE_KEY,
  collapsedStorageKey: RAIL_COLLAPSED_STORAGE_KEY,
  defaultWidth: DEFAULT_RAIL_WIDTH,
  minWidth: MIN_RAIL_WIDTH,
  maxWidth: MAX_RAIL_WIDTH,
  collapsedWidth: COLLAPSED_RAIL_WIDTH,
  resizeFromCollapsed: true,
  collapseThreshold: RAIL_COLLAPSE_THRESHOLD,
})
const railToggleLabel = computed(() =>
  isRailCollapsed.value ? t('sidebar.expand_workspace_rail') : t('sidebar.collapse_workspace_rail'),
)
const railResizeLabel = computed(() => t('sidebar.resize_workspace_rail'))

function openApp(path: string): void {
  router.push(path)
}
</script>

<template>
  <nav
    data-testid="workspace-app-rail"
    class="workspace-rail relative flex h-full shrink-0 select-none flex-col items-center overflow-visible border-r border-sidebar-border bg-server-bar px-2 py-3 shadow-[1px_0_0_color-mix(in_srgb,var(--color-border)_70%,transparent)] transition-[width] duration-150 ease-out"
    :class="[
      isRailResizing && 'transition-none',
    ]"
    :style="railStyle"
    :aria-expanded="!isRailCollapsed"
  >
    <div
      data-testid="workspace-app-rail-content"
      class="flex h-full w-full flex-col items-center overflow-hidden"
    >
      <div
        class="mb-3 flex h-11 items-center rounded-[18px]"
        :class="isRailCollapsed ? 'w-11 justify-center shadow-[0_12px_28px_color-mix(in_srgb,var(--color-primary)_30%,transparent)]' : 'w-full justify-start gap-2 px-1'"
        title="Muon"
      >
        <div class="flex size-11 shrink-0 items-center justify-center rounded-[18px] shadow-[0_12px_28px_color-mix(in_srgb,var(--color-primary)_30%,transparent)]">
          <img
            data-testid="workspace-brand-logo"
            src="/muon-logo.svg"
            alt="Muon"
            class="size-10 rounded-[16px]"
            draggable="false"
          >
        </div>
        <span
          v-if="!isRailCollapsed"
          class="min-w-0 truncate text-[13px] font-semibold text-foreground/90"
          data-testid="workspace-brand-label"
        >
          Muon
        </span>
      </div>

      <button
        class="mb-2 flex h-12 items-center rounded-[18px] text-muted-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="isRailCollapsed ? 'w-12 justify-center' : 'w-full justify-start gap-3 px-3'"
        data-testid="workspace-global-search"
        :aria-label="t('settings.shortcut_search')"
        :title="`${t('settings.shortcut_search')} (Ctrl/Cmd + K)`"
        @click="globalUi.openGlobalSearch"
      >
        <Search :size="20" class="shrink-0" />
        <span
          :class="isRailCollapsed ? 'sr-only' : 'min-w-0 truncate text-[13px] font-medium'"
          data-testid="workspace-global-search-label"
        >
          {{ t('settings.shortcut_search') }}
        </span>
      </button>

      <div class="flex w-full flex-1 flex-col items-center gap-2">
        <button
          v-for="app in workspaceApps"
          :key="app.id"
          class="group relative flex h-12 items-center rounded-[18px] text-[11px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="[
            isRailCollapsed ? 'w-12 justify-center' : 'w-full justify-start gap-3 px-3',
            activeApp.id === app.id ? 'bg-primary/12 text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
          ]"
          :data-testid="`workspace-app-${app.id}`"
          :aria-current="activeApp.id === app.id ? 'page' : undefined"
          :aria-label="t(app.labelKey)"
          :title="t(app.labelKey)"
          @click="openApp(app.path)"
        >
          <component :is="app.icon" :size="20" class="shrink-0" />
          <span
            :class="isRailCollapsed ? 'sr-only' : 'min-w-0 truncate text-[13px]'"
            :data-testid="`workspace-app-label-${app.id}`"
          >
            {{ t(app.labelKey) }}
          </span>
          <span
            v-if="app.id === 'messages' && messageUnreadCount > 0"
            class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
          >
            {{ messageUnreadCount > 99 ? '99+' : messageUnreadCount }}
          </span>
        </button>
      </div>
    </div>

    <button
      type="button"
      data-testid="workspace-rail-toggle"
      class="absolute right-[-13px] top-3 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-sidebar-border/80 bg-server-bar text-muted-foreground shadow-[0_4px_14px_color-mix(in_srgb,var(--color-foreground)_12%,transparent)] transition-all duration-150 hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
      :aria-label="railToggleLabel"
      :title="railToggleLabel"
      @click="toggleRailCollapse"
      @dblclick.stop.prevent="restoreRail"
    >
      <PanelLeftOpen v-if="isRailCollapsed" :size="14" />
      <PanelLeftClose v-else :size="14" />
    </button>

    <div
      data-testid="workspace-rail-resize-handle"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-label="railResizeLabel"
      :aria-valuemin="MIN_RAIL_WIDTH"
      :aria-valuemax="MAX_RAIL_WIDTH"
      :aria-valuenow="isRailCollapsed ? COLLAPSED_RAIL_WIDTH : railWidth"
      class="absolute right-[-3px] top-0 z-20 h-full w-1.5 cursor-col-resize rounded-full transition-colors duration-150 hover:bg-primary/22 focus-visible:bg-primary/25 focus-visible:outline-none"
      :class="isRailResizing && 'bg-primary/28'"
      @pointerdown="startRailResize"
      @dblclick.stop.prevent="restoreRail"
      @keydown="onResizeHandleKeydown"
    />
  </nav>
</template>
