<script setup lang="ts">
import { Label } from '@muon/ui/label';
import { Switch } from '@muon/ui/switch';
import { useSelector } from '@tanstack/vue-store';
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { setAnalyticsEnabled as setAnalyticsEnabledLib } from '@/shared/lib/analytics';
import {
  setAnalyticsEnabled,
  setAutoLaunch,
  setCloseToTray,
  setDebugMode,
  settingsStore,
} from '@/shared/stores/settingsStore';

const { t } = useI18n();

const autoLaunch = useSelector(settingsStore, (s) => s.autoLaunch);
const closeToTray = useSelector(settingsStore, (s) => s.closeToTray);
const analyticsEnabled = useSelector(settingsStore, (s) => s.analyticsEnabled);
const debugMode = useSelector(settingsStore, (s) => s.debugMode);

watch(
  analyticsEnabled,
  (val) => {
    setAnalyticsEnabledLib(val);
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-lg font-semibold">
      {{ t('settings.general_title') }}
    </h2>

    <Label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.auto_launch') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.auto_launch_desc') }}</div>
      </div>
      <Switch :model-value="autoLaunch" @update:model-value="setAutoLaunch" />
    </Label>

    <Label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.close_to_tray') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.close_to_tray_desc') }}</div>
      </div>
      <Switch :model-value="closeToTray" @update:model-value="setCloseToTray" />
    </Label>

    <Label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.analytics') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.analytics_desc') }}</div>
      </div>
      <Switch :model-value="analyticsEnabled" @update:model-value="setAnalyticsEnabled" />
    </Label>

    <div class="space-y-3">
      <h3 class="text-sm font-medium text-foreground/80">
        {{ t('settings.developer') }}
      </h3>

      <Label class="flex items-center justify-between">
        <div>
          <div class="text-sm">{{ t('settings.debug_mode') }}</div>
          <div class="text-xs text-muted-foreground">{{ t('settings.debug_mode_desc') }}</div>
        </div>
        <Switch :model-value="debugMode" @update:model-value="setDebugMode" />
      </Label>
    </div>
  </div>
</template>
