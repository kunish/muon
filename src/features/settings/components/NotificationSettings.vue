<script setup lang="ts">
import { useSettingsStore } from '../stores/settingsStore'

const store = useSettingsStore()
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-base font-medium">
      通知设置
    </h3>

    <label class="flex items-center justify-between">
      <div>
        <div class="text-sm">启用通知</div>
        <div class="text-xs text-muted-foreground">接收新消息的系统通知</div>
      </div>
      <input v-model="store.notificationsEnabled" type="checkbox" class="rounded">
    </label>

    <label class="flex items-center justify-between">
      <div>
        <div class="text-sm">消息预览</div>
        <div class="text-xs text-muted-foreground">在通知中显示消息内容</div>
      </div>
      <input v-model="store.notificationPreview" type="checkbox" class="rounded">
    </label>

    <div class="space-y-2">
      <div class="text-sm">
        免打扰时段
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="store.dndStart"
          type="time"
          class="h-8 px-2 text-sm rounded border border-border bg-background outline-none"
        >
        <span class="text-sm text-muted-foreground">至</span>
        <input
          v-model="store.dndEnd"
          type="time"
          class="h-8 px-2 text-sm rounded border border-border bg-background outline-none"
        >
      </div>
    </div>
  </div>
</template>
