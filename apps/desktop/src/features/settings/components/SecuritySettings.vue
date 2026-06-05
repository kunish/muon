<script setup lang="ts">
import { Label } from '@muon/ui/label';
import { Switch } from '@muon/ui/switch';
import { useSelector } from '@tanstack/vue-store';
import { Droplets, Shield, UserX } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { useWatermark } from '@/shared/composables/useWatermark';
import { settingsStore, setWatermarkEnabled } from '@/shared/stores/settingsStore';
import BlockedUsers from './BlockedUsers.vue';
import DeviceList from './DeviceList.vue';

const { t } = useI18n();
const watermarkEnabled = useSelector(settingsStore, (s) => s.watermarkEnabled);
const { enabled } = useWatermark();

function toggleWatermark() {
  setWatermarkEnabled(!settingsStore.state.watermarkEnabled);
  enabled.value = settingsStore.state.watermarkEnabled;
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-2 mb-4">
      <Shield :size="20" class="text-primary" />
      <h2 class="text-lg font-semibold">
        {{ t('settings.security_title') }}
      </h2>
    </div>

    <Label class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Droplets :size="18" class="text-muted-foreground" />
        <div>
          <div class="text-sm">{{ t('settings.watermark') }}</div>
          <div class="text-xs text-muted-foreground">{{ t('settings.watermark_desc') }}</div>
        </div>
      </div>
      <Switch :model-value="watermarkEnabled" @update:model-value="() => toggleWatermark()" />
    </Label>

    <!-- 已屏蔽用户 -->
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <UserX :size="16" class="text-muted-foreground" />
        <div>
          <div class="text-sm font-medium">
            {{ t('settings.blocked_users') }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ t('settings.blocked_users_desc') }}
          </div>
        </div>
      </div>
      <BlockedUsers />
    </div>

    <DeviceList />
  </div>
</template>
