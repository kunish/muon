<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settingsStore'

const { t } = useI18n()
const store = useSettingsStore()
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-base font-medium">
      {{ t('settings.notification_title') }}
    </h3>

    <label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.enable_notifications') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.enable_notifications_desc') }}</div>
      </div>
      <input v-model="store.notificationsEnabled" type="checkbox" class="rounded">
    </label>

    <label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.message_preview') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.message_preview_desc') }}</div>
      </div>
      <input v-model="store.notificationPreview" type="checkbox" class="rounded">
    </label>

    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.dnd') }}
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="store.dndStart"
          type="time"
          class="h-8 px-2 text-sm rounded border border-border bg-background outline-none"
        >
        <span class="text-sm text-muted-foreground">{{ t('settings.dnd_to') }}</span>
        <input
          v-model="store.dndEnd"
          type="time"
          class="h-8 px-2 text-sm rounded border border-border bg-background outline-none"
        >
      </div>
    </div>
  </div>
</template>
