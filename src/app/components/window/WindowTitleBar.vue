<script setup lang="ts">
import type { UnlistenFn } from '@/electron/window'
import { Maximize2, Minimize2, Minus, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  currentMonitor,
  getCurrentWindow,
  getDesktopPlatform,
  PhysicalPosition,
  PhysicalSize,
} from '@/electron/window'

type AppWindow = ReturnType<typeof getCurrentWindow>
interface WindowFrameBounds {
  position: { x: number, y: number }
  size: { height: number, width: number }
}

interface WindowWorkAreaState {
  fillsWorkArea: boolean
  verticallyFlush: boolean
}

const SCREEN_EDGE_TOLERANCE_PX = 8
const WINDOW_FRAME_SETTLE_DELAY_MS = 180

const { t } = useI18n()
const isMaximized = shallowRef(false)
const isCustomWorkAreaExpanded = shallowRef(false)
const isVerticallyFlushWithScreen = shallowRef(false)
const isWindowFocused = shallowRef(true)

const desktopPlatform = getDesktopPlatform()
const isMac = isMacPlatform(desktopPlatform) || (!desktopPlatform && typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad|iPod/.test(`${navigator.platform} ${navigator.userAgent}`)
)

let unlistenBlurred: UnlistenFn | undefined
let unlistenFocused: UnlistenFn | undefined
let unlistenResized: UnlistenFn | undefined
let unlistenMoved: UnlistenFn | undefined
let windowFrameRefreshId = 0
let windowFrameRefreshTimer: number | undefined
let restoreWindowFrameBounds: WindowFrameBounds | undefined

const maximizeLabel = computed(() => {
  return isMaximized.value || isCustomWorkAreaExpanded.value
    ? t('common.restore_window')
    : t('common.maximize_window')
})

function isMacPlatform(platform: string | undefined): boolean {
  const normalizedPlatform = platform?.toLowerCase()
  return normalizedPlatform === 'darwin'
    || normalizedPlatform === 'mac'
    || normalizedPlatform === 'macos'
    || normalizedPlatform === 'osx'
}

function resolveWindow(): AppWindow | null {
  try {
    return getCurrentWindow()
  }
  catch {
    return null
  }
}

function syncWindowFrameClass(): void {
  document.documentElement.classList.toggle(
    'muon-window-maximized',
    isCustomWorkAreaExpanded.value || (isMaximized.value && isVerticallyFlushWithScreen.value),
  )
  document.documentElement.classList.toggle(
    'muon-window-flush-frame',
    isVerticallyFlushWithScreen.value,
  )
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= SCREEN_EDGE_TOLERANCE_PX
}

async function readWindowWorkAreaState(appWindow: AppWindow): Promise<WindowWorkAreaState> {
  try {
    const [monitor, position, size] = await Promise.all([
      currentMonitor(),
      appWindow.outerPosition(),
      appWindow.outerSize(),
    ])

    if (!monitor)
      return { fillsWorkArea: false, verticallyFlush: false }

    const workAreaTop = monitor.workArea.position.y
    const workAreaBottom = workAreaTop + monitor.workArea.size.height
    const workAreaLeft = monitor.workArea.position.x
    const workAreaRight = workAreaLeft + monitor.workArea.size.width
    const windowTop = position.y
    const windowBottom = position.y + size.height
    const windowLeft = position.x
    const windowRight = position.x + size.width

    const verticallyFlush = nearlyEqual(windowTop, workAreaTop) && nearlyEqual(windowBottom, workAreaBottom)
    const horizontallyFlush = nearlyEqual(windowLeft, workAreaLeft) && nearlyEqual(windowRight, workAreaRight)

    return {
      fillsWorkArea: verticallyFlush && horizontallyFlush,
      verticallyFlush,
    }
  }
  catch {
    return { fillsWorkArea: false, verticallyFlush: false }
  }
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

function clearScheduledWindowFrameRefresh(): void {
  if (windowFrameRefreshTimer == null)
    return

  window.clearTimeout(windowFrameRefreshTimer)
  windowFrameRefreshTimer = undefined
}

function scheduleWindowFrameRefresh(): void {
  if (typeof window === 'undefined') {
    void refreshMaximizedState()
    return
  }

  clearScheduledWindowFrameRefresh()
  windowFrameRefreshTimer = window.setTimeout(() => {
    windowFrameRefreshTimer = undefined
    void refreshMaximizedState()
  }, WINDOW_FRAME_SETTLE_DELAY_MS)
}

async function refreshMaximizedState(): Promise<void> {
  const appWindow = resolveWindow()
  if (!appWindow)
    return

  const refreshId = ++windowFrameRefreshId

  try {
    const maximized = await appWindow.isMaximized()
    const workAreaState = await readWindowWorkAreaState(appWindow)
    if (refreshId !== windowFrameRefreshId)
      return

    isMaximized.value = maximized
    isVerticallyFlushWithScreen.value = workAreaState.verticallyFlush
    if (isCustomWorkAreaExpanded.value && !workAreaState.fillsWorkArea)
      isCustomWorkAreaExpanded.value = false
    syncWindowFrameClass()
  }
  catch (err) {
    console.warn('[WindowTitleBar] failed to read window state:', err)
  }
}

async function refreshWindowFocusState(): Promise<void> {
  const appWindow = resolveWindow()
  if (!appWindow)
    return

  try {
    isWindowFocused.value = await appWindow.isFocused()
  }
  catch (err) {
    console.warn('[WindowTitleBar] failed to read window focus state:', err)
  }
}

async function minimizeWindow(): Promise<void> {
  await runWindowAction(appWindow => appWindow.minimize())
}

async function expandWindowToWorkArea(appWindow: AppWindow): Promise<void> {
  const [monitor, position, size] = await Promise.all([
    currentMonitor(),
    appWindow.outerPosition(),
    appWindow.outerSize(),
  ])

  if (!monitor) {
    await appWindow.maximize()
    await refreshMaximizedState()
    return
  }

  restoreWindowFrameBounds = {
    position: { x: position.x, y: position.y },
    size: { height: size.height, width: size.width },
  }

  const { position: workAreaPosition, size: workAreaSize } = monitor.workArea
  await appWindow.setPosition(new PhysicalPosition(workAreaPosition.x, workAreaPosition.y))
  await appWindow.setSize(new PhysicalSize(workAreaSize.width, workAreaSize.height))
  isCustomWorkAreaExpanded.value = true
  isMaximized.value = false
  isVerticallyFlushWithScreen.value = true
  syncWindowFrameClass()
}

async function restoreWindowFrame(appWindow: AppWindow): Promise<void> {
  if (restoreWindowFrameBounds) {
    const { position, size } = restoreWindowFrameBounds
    restoreWindowFrameBounds = undefined
    await appWindow.setPosition(new PhysicalPosition(position.x, position.y))
    await appWindow.setSize(new PhysicalSize(size.width, size.height))
  }
  else if (await appWindow.isMaximized()) {
    await appWindow.unmaximize()
  }

  isCustomWorkAreaExpanded.value = false
  await refreshMaximizedState()
}

async function toggleMaximizedWindow(): Promise<void> {
  clearScheduledWindowFrameRefresh()
  await runWindowAction(async (appWindow) => {
    if (isCustomWorkAreaExpanded.value || await appWindow.isMaximized())
      await restoreWindowFrame(appWindow)
    else
      await expandWindowToWorkArea(appWindow)
  })
}

async function closeWindow(): Promise<void> {
  await runWindowAction(appWindow => appWindow.close())
}

function handleTitlebarDoubleClick(): void {
  void toggleMaximizedWindow()
}

onMounted(async () => {
  await Promise.all([
    refreshMaximizedState(),
    refreshWindowFocusState(),
  ])

  const appWindow = resolveWindow()
  if (!appWindow)
    return

  try {
    unlistenFocused = await appWindow.onFocused(() => {
      isWindowFocused.value = true
    })
    unlistenBlurred = await appWindow.onBlurred(() => {
      isWindowFocused.value = false
    })
    unlistenResized = await appWindow.onResized(() => {
      scheduleWindowFrameRefresh()
    })
    unlistenMoved = await appWindow.onMoved(() => {
      scheduleWindowFrameRefresh()
    })
  }
  catch (err) {
    console.warn('[WindowTitleBar] failed to bind window frame listeners:', err)
  }
})

onUnmounted(() => {
  windowFrameRefreshId += 1
  clearScheduledWindowFrameRefresh()
  unlistenFocused?.()
  unlistenBlurred?.()
  unlistenResized?.()
  unlistenMoved?.()
  document.documentElement.classList.remove('muon-window-maximized')
  document.documentElement.classList.remove('muon-window-flush-frame')
})
</script>

<template>
  <header
    class="window-titlebar"
    :class="{
      'window-titlebar--inactive': !isWindowFocused,
      'window-titlebar--mac': isMac,
    }"
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
      data-electron-drag-region
      data-testid="window-titlebar-drag-region"
      @dblclick="handleTitlebarDoubleClick"
    >
      <div class="window-titlebar__brand" data-electron-drag-region>
        <img
          class="window-titlebar__logo"
          data-testid="window-titlebar-logo"
          data-electron-drag-region
          src="/muon-logo.svg"
          alt="Muon"
          draggable="false"
        >
        <span class="window-titlebar__name" data-electron-drag-region>Muon</span>
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
  --window-titlebar-default-controls-width: 138px;
  --window-titlebar-mac-controls-width: 92px;

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
  margin-right: var(--window-titlebar-default-controls-width);
  padding: 0 24px;
  -webkit-app-region: drag;
}

.window-titlebar--mac .window-titlebar__drag-region {
  margin-right: var(--window-titlebar-mac-controls-width);
  margin-left: var(--window-titlebar-mac-controls-width);
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

.window-titlebar--inactive .window-titlebar__brand {
  color: color-mix(in srgb, var(--color-muted-foreground) 68%, transparent);
}

.window-titlebar__logo {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border-radius: 6px;
  user-select: none;
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
  -webkit-app-region: no-drag;
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

.window-titlebar--inactive .window-titlebar__control--button {
  color: color-mix(in srgb, var(--color-muted-foreground) 62%, transparent);
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
  transition:
    box-shadow 100ms ease,
    filter 100ms ease,
    transform 100ms ease;
}

.window-titlebar__control--dot:hover {
  box-shadow: inset 0 0 0 0.5px rgb(0 0 0 / 14%);
  filter: brightness(1.04);
}

.window-titlebar__control--dot:active {
  transform: scale(0.92);
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
.window-titlebar__control--dot:hover .window-titlebar__dot-icon,
.window-titlebar__control--dot:focus-visible .window-titlebar__dot-icon {
  opacity: 1;
}
</style>
