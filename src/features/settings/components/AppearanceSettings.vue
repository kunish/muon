<script setup lang="ts">
import type { MessageAlignment, ThemeMode } from '../stores/settingsStore'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settingsStore'

const { t } = useI18n()
const store = useSettingsStore()

const themeOptions: { value: ThemeMode, label: () => string }[] = [
  { value: 'light', label: () => t('settings.theme_light') },
  { value: 'dark', label: () => t('settings.theme_dark') },
  { value: 'system', label: () => t('settings.theme_system') },
]

const localeOptions = [
  { value: 'zh', label: () => t('settings.lang_zh') },
  { value: 'en', label: () => 'English' },
]

const alignmentOptions: { value: MessageAlignment, label: () => string, desc: () => string }[] = [
  { value: 'left', label: () => t('settings.align_left'), desc: () => t('settings.align_left_desc') },
  { value: 'leftright', label: () => t('settings.align_bubble'), desc: () => t('settings.align_bubble_desc') },
]
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-base font-medium">
      {{ t('settings.appearance_title') }}
    </h3>

    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.theme') }}
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
          {{ opt.label() }}
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.language') }}
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
          {{ opt.label() }}
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.msg_align') }}
      </div>
      <div class="flex gap-2">
        <button
          v-for="opt in alignmentOptions"
          :key="opt.value"
          class="px-4 py-2 text-sm rounded-lg border transition-colors"
          :class="store.messageAlignment === opt.value
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border hover:bg-accent'"
          :title="opt.desc()"
          @click="store.messageAlignment = opt.value"
        >
          {{ opt.label() }}
        </button>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ alignmentOptions.find(o => o.value === store.messageAlignment)?.desc() }}
      </p>
    </div>
  </div>
</template>
