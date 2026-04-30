<script setup lang="ts">
import type { UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Maximize2, Minimize2, Minus, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

type AppWindow = ReturnType<typeof getCurrentWindow>

const { t } = useI18n()
const isMaximized = shallowRef(false)

const isMac = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad|iPod/.test(`${navigator.platform} ${navigator.userAgent}`)

let unlistenResized: UnlistenFn | undefined

const maximizeLabel = computed(() => {
  return isMaximized.value ? t('common.restore_window') : t('common.maximize_window')
})

function resolveWindow(): AppWindow | null {
  try {
    return getCurrentWindow()
  }
  catch {
    return null
  }
}

function syncWindowFrameClass(): void {
  document.documentElement.classList.toggle('muon-window-maximized', isMaximized.value)
}

async function runWindowAction(action: (appWindow: AppWindow) => Promise<void>): Promise<void> {
  const appWindow = resolveWindow()
  if (!appWindow)
    return

  try {
    await action(appWindow)
  }
  catch (err) {
    console.warn('[WindowTitleBar] window action failed:', err)
  }
}

async function refreshMaximizedState(): Promise<void> {
  const appWindow = resolveWindow()
  if (!appWindow)
    return

  try {
    isMaximized.value = await appWindow.isMaximized()
    syncWindowFrameClass()
  }
  catch (err) {
    console.warn('[WindowTitleBar] failed to read window state:', err)
  }
}

async function minimizeWindow(): Promise<void> {
  await runWindowAction(appWindow => appWindow.minimize())
}

async function toggleMaximizedWindow(): Promise<void> {
  await runWindowAction(appWindow => appWindow.toggleMaximize())
  await refreshMaximizedState()
}

async function closeWindow(): Promise<void> {
  await runWindowAction(appWindow => appWindow.close())
}

function handleTitlebarDoubleClick(): void {
  void toggleMaximizedWindow()
}

onMounted(async () => {
  await refreshMaximizedState()

  const appWindow = resolveWindow()
  if (!appWindow)
    return

  try {
    unlistenResized = await appWindow.onResized(() => {
      void refreshMaximizedState()
    })
  }
  catch (err) {
    console.warn('[WindowTitleBar] failed to bind resize listener:', err)
  }
})

onUnmounted(() => {
  unlistenResized?.()
  document.documentElement.classList.remove('muon-window-maximized')
})
</script>

<template>
  <header
    class="window-titlebar"
    :class="{ 'window-titlebar--mac': isMac }"
    data-testid="window-titlebar"
  >
    <div v-if="isMac" class="window-titlebar__controls window-titlebar__controls--mac">
      <button
        type="button"
        class="window-titlebar__control window-titlebar__control--dot window-titlebar__control--close-dot"
        :aria-label="t('common.close_window')"
        :title="t('common.close_window')"
        data-testid="window-close"
        @click="closeWindow"
      >
        <X :size="9" :stroke-width="3" class="window-titlebar__dot-icon" />
      </button>
      <button
        type="button"
        class="window-titlebar__control window-titlebar__control--dot window-titlebar__control--minimize-dot"
        :aria-label="t('common.minimize_window')"
        :title="t('common.minimize_window')"
        data-testid="window-minimize"
        @click="minimizeWindow"
      >
        <Minus :size="9" :stroke-width="3" class="window-titlebar__dot-icon" />
      </button>
      <button
        type="button"
        class="window-titlebar__control window-titlebar__control--dot window-titlebar__control--maximize-dot"
        :aria-label="maximizeLabel"
        :title="maximizeLabel"
        data-testid="window-maximize"
        @click="toggleMaximizedWindow"
      >
        <component
          :is="isMaximized ? Minimize2 : Maximize2"
          :size="8"
          :stroke-width="3"
          class="window-titlebar__dot-icon"
        />
      </button>
    </div>

    <div
      class="window-titlebar__drag-region"
      data-tauri-drag-region
      data-testid="window-titlebar-drag-region"
      @dblclick="handleTitlebarDoubleClick"
    >
      <div class="window-titlebar__brand" data-tauri-drag-region>
        <span class="window-titlebar__logo" data-tauri-drag-region>M</span>
        <span class="window-titlebar__name" data-tauri-drag-region>Muon</span>
      </div>
    </div>

    <div v-if="!isMac" class="window-titlebar__controls window-titlebar__controls--default">
      <button
        type="button"
        class="window-titlebar__control window-titlebar__control--button"
        :aria-label="t('common.minimize_window')"
        :title="t('common.minimize_window')"
        data-testid="window-minimize"
        @click="minimizeWindow"
      >
        <Minus :size="14" :stroke-width="2" />
      </button>
      <button
        type="button"
        class="window-titlebar__control window-titlebar__control--button"
        :aria-label="maximizeLabel"
        :title="maximizeLabel"
        data-testid="window-maximize"
        @click="toggleMaximizedWindow"
      >
        <component :is="isMaximized ? Minimize2 : Maximize2" :size="14" :stroke-width="2" />
      </button>
      <button
        type="button"
        class="window-titlebar__control window-titlebar__control--button window-titlebar__control--close"
        :aria-label="t('common.close_window')"
        :title="t('common.close_window')"
        data-testid="window-close"
        @click="closeWindow"
      >
        <X :size="15" :stroke-width="2" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.window-titlebar {
  position: relative;
  z-index: 30;
  display: flex;
  flex: 0 0 36px;
  height: 36px;
  overflow: hidden;
  cursor: default;
  user-select: none;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-card) 92%, var(--color-background)) 0%,
    color-mix(in srgb, var(--color-background) 94%, var(--color-card)) 100%
  );
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 78%, transparent);
  color: var(--color-foreground);
}

.window-titlebar * {
  cursor: default;
}

.window-titlebar__drag-region {
  display: flex;
  flex: 1;
  height: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  padding: 0 132px;
}

.window-titlebar--mac .window-titlebar__drag-region {
  padding-right: 132px;
  padding-left: 132px;
}

.window-titlebar__brand {
  display: inline-flex;
  max-width: min(220px, 44vw);
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: color-mix(in srgb, var(--color-foreground) 76%, transparent);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0;
  line-height: 1;
}

.window-titlebar__logo {
  display: inline-flex;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.window-titlebar__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-titlebar__controls {
  position: absolute;
  top: 0;
  z-index: 2;
  display: flex;
  height: 100%;
  align-items: center;
}

.window-titlebar__controls--mac {
  left: 0;
  gap: 8px;
  padding: 0 14px;
}

.window-titlebar__controls--default {
  right: 0;
}

.window-titlebar__control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  outline: none;
  -webkit-app-region: no-drag;
}

.window-titlebar__control:focus-visible {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-ring) 72%, transparent);
}

.window-titlebar__control--button {
  width: 46px;
  height: 36px;
  color: color-mix(in srgb, var(--color-foreground) 64%, transparent);
  background: transparent;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.window-titlebar__control--button:hover {
  color: var(--color-foreground);
  background: color-mix(in srgb, var(--color-accent) 72%, transparent);
}

.window-titlebar__control--button:active {
  background: color-mix(in srgb, var(--color-accent) 92%, transparent);
}

.window-titlebar__control--close:hover {
  color: white;
  background: oklch(58% 0.23 27);
}

.window-titlebar__control--dot {
  width: 12px;
  height: 12px;
  padding: 0;
  border-radius: 999px;
  color: rgb(70 54 54 / 72%);
}

.window-titlebar__control--close-dot {
  background: #ff5f57;
}

.window-titlebar__control--minimize-dot {
  background: #ffbd2e;
}

.window-titlebar__control--maximize-dot {
  background: #28c840;
}

.window-titlebar__dot-icon {
  opacity: 0;
  transition: opacity 100ms ease;
}

.window-titlebar__controls--mac:hover .window-titlebar__dot-icon,
.window-titlebar__control--dot:focus-visible .window-titlebar__dot-icon {
  opacity: 1;
}
</style>
