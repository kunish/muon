<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { useSettingsStore } from '../stores/settingsStore'

const { t } = useI18n()
const store = useSettingsStore()
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-base font-medium">
      {{ t('settings.notification_title') }}
    </h3>

    <Label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.enable_notifications') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.enable_notifications_desc') }}</div>
      </div>
      <Switch :checked="store.notificationsEnabled" @update:checked="val => store.notificationsEnabled = val" />
    </Label>

    <Label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.message_preview') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.message_preview_desc') }}</div>
      </div>
      <Switch :checked="store.notificationPreview" @update:checked="val => store.notificationPreview = val" />
    </Label>

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
