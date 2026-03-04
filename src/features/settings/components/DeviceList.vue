<script setup lang="ts">
import { getCurrentDeviceId, getDevices } from '@matrix/verification'
import { Monitor, Smartphone } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface DeviceInfo {
  deviceId: string
  displayName: string
  current: boolean
}

const devices = ref<DeviceInfo[]>([])

onMounted(async () => {
  const stored = await getDevices()
  const currentId = getCurrentDeviceId()

  devices.value = stored.map((d: any) => ({
    deviceId: d.device_id,
    displayName: d.display_name || d.device_id,
    current: d.device_id === currentId,
  }))
})
</script>

<template>
  <div class="space-y-2">
    <h3 class="text-sm font-medium mb-3">
      {{ t('settings.devices') }}
    </h3>
    <div
      v-for="device in devices"
      :key="device.deviceId"
      class="flex items-center justify-between p-3 rounded-lg bg-muted/50"
    >
      <div class="flex items-center gap-3">
        <Monitor v-if="device.current" :size="18" class="text-primary" />
        <Smartphone v-else :size="18" class="text-muted-foreground" />
        <div>
          <p class="text-sm font-medium">
            {{ device.displayName }}
            <span v-if="device.current" class="text-xs text-primary ml-1">{{ t('settings.current_device') }}</span>
          </p>
          <p class="text-xs text-muted-foreground">
            {{ device.deviceId }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
