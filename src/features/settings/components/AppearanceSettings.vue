<script setup lang="ts">
import type { MessageAlignment, ThemeMode } from '../stores/settingsStore'
import { useI18n } from 'vue-i18n'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
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
      <Tabs :model-value="store.theme" @update:model-value="v => store.theme = v as ThemeMode">
        <TabsList>
          <TabsTrigger v-for="opt in themeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label() }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.language') }}
      </div>
      <Tabs :model-value="store.locale" @update:model-value="v => store.locale = v as string">
        <TabsList>
          <TabsTrigger v-for="opt in localeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label() }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.msg_align') }}
      </div>
      <Tabs :model-value="store.messageAlignment" @update:model-value="v => store.messageAlignment = v as MessageAlignment">
        <TabsList>
          <TabsTrigger v-for="opt in alignmentOptions" :key="opt.value" :value="opt.value" :title="opt.desc()">
            {{ opt.label() }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <p class="text-xs text-muted-foreground">
        {{ alignmentOptions.find(o => o.value === store.messageAlignment)?.desc() }}
      </p>
    </div>
  </div>
</template>
