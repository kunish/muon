<script setup lang="ts">
import { computed } from 'vue'
import { getDesktopBridge } from '@/electron/bridge'

const desktopPlatform = getDesktopBridge()?.platform
const isMac = computed(() => isMacPlatform(desktopPlatform) || (!desktopPlatform && typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad|iPod/.test(`${navigator.platform} ${navigator.userAgent}`)
))

function isMacPlatform(platform: string | undefined): boolean {
  const normalizedPlatform = platform?.toLowerCase()
  return normalizedPlatform === 'darwin'
    || normalizedPlatform === 'mac'
    || normalizedPlatform === 'macos'
    || normalizedPlatform === 'osx'
}
</script>

<template>
  <header
    class="window-titlebar"
    :class="{ 'window-titlebar--mac': isMac }"
    data-testid="window-titlebar"
  >
    <div
      class="window-titlebar__drag-region"
      data-electron-drag-region
      data-testid="window-titlebar-drag-region"
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
  background-color: var(--color-card, #e5e7eb);
  background-image: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-card) 92%, var(--color-background)) 0%,
    color-mix(in srgb, var(--color-background) 94%, var(--color-card)) 100%
  );
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 78%, transparent);
  color: var(--color-foreground, #111827);
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
</style>
