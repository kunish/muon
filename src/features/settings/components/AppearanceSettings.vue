<script setup lang="ts">
import type { ThemeMode } from '../stores/settingsStore'
import { useSettingsStore } from '../stores/settingsStore'

const store = useSettingsStore()

const themeOptions: { value: ThemeMode, label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

const localeOptions = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
]
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-base font-medium">
      外观设置
    </h3>

    <div class="space-y-2">
      <div class="text-sm">
        主题
      </div>
      <div class="flex gap-2">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          class="px-4 py-2 text-sm rounded-lg border transition-colors"
          :class="store.theme === opt.value
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border hover:bg-accent'"
          @click="store.theme = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <div class="text-sm">
        语言
      </div>
      <div class="flex gap-2">
        <button
          v-for="opt in localeOptions"
          :key="opt.value"
          class="px-4 py-2 text-sm rounded-lg border transition-colors"
          :class="store.locale === opt.value
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border hover:bg-accent'"
          @click="store.locale = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
  </div>
</template>
