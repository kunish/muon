<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { setAnalyticsEnabled } from '@/shared/lib/analytics'
import { useSettingsStore } from '../stores/settingsStore'

const { t } = useI18n()
const store = useSettingsStore()

watch(() => store.analyticsEnabled, (val) => {
  setAnalyticsEnabled(val)
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-base font-medium">
      {{ t('settings.general_title') }}
    </h3>

    <label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.auto_launch') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.auto_launch_desc') }}</div>
      </div>
      <input v-model="store.autoLaunch" type="checkbox" class="rounded">
    </label>

    <label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.close_to_tray') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.close_to_tray_desc') }}</div>
      </div>
      <input v-model="store.closeToTray" type="checkbox" class="rounded">
    </label>

    <label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.analytics') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.analytics_desc') }}</div>
      </div>
      <input v-model="store.analyticsEnabled" type="checkbox" class="rounded">
    </label>
  </div>
</template>
