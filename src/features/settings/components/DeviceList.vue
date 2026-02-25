<script setup lang="ts">
import { getClient } from '@matrix/client'
import { getDevices, isDeviceVerified } from '@matrix/verification'
import { Monitor, Smartphone } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

interface DeviceInfo {
  deviceId: string
  displayName: string
  verified: boolean
  current: boolean
}

const emit = defineEmits<{
  verify: [deviceId: string]
}>()

const devices = ref<DeviceInfo[]>([])

onMounted(() => {
  const client = getClient()
  const userId = client.getUserId()!
  const stored = getDevices(userId)
  const currentDeviceId = client.getDeviceId()

  devices.value = stored.map((d: any) => ({
    deviceId: d.deviceId,
    displayName: d.getDisplayName() || d.deviceId,
    verified: isDeviceVerified(userId, d.deviceId),
    current: d.deviceId === currentDeviceId,
  }))
})
</script>

<template>
  <div class="space-y-2">
    <h3 class="text-sm font-medium mb-3">
      已登录设备
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
            <span v-if="device.current" class="text-xs text-primary ml-1">当前</span>
          </p>
          <p class="text-xs text-muted-foreground">
            {{ device.deviceId }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span
          class="text-xs px-2 py-0.5 rounded-full"
          :class="device.verified ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'"
        >
          {{ device.verified ? '已验证' : '未验证' }}
        </span>
        <button
          v-if="!device.verified && !device.current"
          class="text-xs text-primary hover:underline"
          @click="emit('verify', device.deviceId)"
        >
          验证
        </button>
      </div>
    </div>
  </div>
</template>
