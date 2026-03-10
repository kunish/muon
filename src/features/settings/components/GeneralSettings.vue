<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
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

    <Label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.auto_launch') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.auto_launch_desc') }}</div>
      </div>
      <Switch :checked="store.autoLaunch" @update:checked="val => store.autoLaunch = val" />
    </Label>

    <Label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.close_to_tray') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.close_to_tray_desc') }}</div>
      </div>
      <Switch :checked="store.closeToTray" @update:checked="val => store.closeToTray = val" />
    </Label>

    <Label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.analytics') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.analytics_desc') }}</div>
      </div>
      <Switch :checked="store.analyticsEnabled" @update:checked="val => store.analyticsEnabled = val" />
    </Label>
  </div>
</template>
