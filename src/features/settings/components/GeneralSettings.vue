<script setup lang="ts">
import { useSettingsStore } from '../stores/settingsStore'

const store = useSettingsStore()
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-base font-medium">
      通用设置
    </h3>

    <label class="flex items-center justify-between">
      <div>
        <div class="text-sm">开机自启动</div>
        <div class="text-xs text-muted-foreground">系统启动时自动运行 Muon</div>
      </div>
      <input v-model="store.autoLaunch" type="checkbox" class="rounded">
    </label>

    <label class="flex items-center justify-between">
      <div>
        <div class="text-sm">关闭时最小化到托盘</div>
        <div class="text-xs text-muted-foreground">关闭窗口后继续在后台运行</div>
      </div>
      <input v-model="store.closeToTray" type="checkbox" class="rounded">
    </label>
  </div>
</template>
