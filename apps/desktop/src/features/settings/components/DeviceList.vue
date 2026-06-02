<script setup lang="ts">
import { deleteDevice, getCurrentDeviceId, getDevices } from '@matrix/verification';
import { LogOut, Monitor, Smartphone } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';

const { t } = useI18n();

interface DeviceInfo {
  deviceId: string;
  displayName: string;
  current: boolean;
}

const devices = ref<DeviceInfo[]>([]);
const loading = ref(true);
const removingId = ref<string | null>(null);
// 当 homeserver 要求 UIA 时，针对该设备显示密码输入
const passwordPromptId = ref<string | null>(null);
const password = ref('');

async function loadDevices(): Promise<void> {
  loading.value = true;
  try {
    const stored = await getDevices();
    const currentId = getCurrentDeviceId();
    devices.value = stored.map((d) => ({
      deviceId: d.device_id,
      displayName: d.display_name || d.device_id,
      current: d.device_id === currentId,
    }));
  } catch {
    devices.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(loadDevices);

async function signOutDevice(deviceId: string): Promise<void> {
  if (removingId.value) return;
  removingId.value = deviceId;
  try {
    const { needsPassword } = await deleteDevice(
      deviceId,
      passwordPromptId.value === deviceId ? password.value : undefined,
    );
    if (needsPassword) {
      passwordPromptId.value = deviceId;
      return;
    }
    passwordPromptId.value = null;
    password.value = '';
    toast.success(t('settings.device_signed_out'));
    await loadDevices();
  } catch {
    toast.error(t('settings.device_sign_out_failed'));
  } finally {
    removingId.value = null;
  }
}

function cancelPasswordPrompt(): void {
  passwordPromptId.value = null;
  password.value = '';
}
</script>

<template>
  <div class="space-y-2">
    <h3 class="text-sm font-medium mb-3">
      {{ t('settings.devices') }}
    </h3>
    <p v-if="loading" class="px-1 py-4 text-xs text-muted-foreground" data-testid="device-list-loading">
      {{ t('common.loading') }}
    </p>
    <p v-else-if="devices.length === 0" class="px-1 py-4 text-xs text-muted-foreground" data-testid="device-list-empty">
      {{ t('settings.no_devices') }}
    </p>
    <div v-for="device in devices" v-else :key="device.deviceId" class="rounded-lg bg-muted/50">
      <div class="flex items-center justify-between p-3">
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
        <button
          v-if="!device.current"
          type="button"
          :data-testid="`device-sign-out-${device.deviceId}`"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          :disabled="removingId === device.deviceId"
          @click="signOutDevice(device.deviceId)"
        >
          <LogOut :size="13" />
          <span>{{ t('settings.sign_out_device') }}</span>
        </button>
      </div>
      <div
        v-if="passwordPromptId === device.deviceId"
        class="flex items-center gap-2 border-t border-border px-3 py-2"
        :data-testid="`device-password-prompt-${device.deviceId}`"
      >
        <input
          v-model="password"
          type="password"
          :placeholder="t('settings.confirm_password')"
          class="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
          @keydown.enter="signOutDevice(device.deviceId)"
        />
        <button
          type="button"
          class="h-8 rounded-md bg-destructive px-2.5 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          :disabled="!password || removingId === device.deviceId"
          @click="signOutDevice(device.deviceId)"
        >
          {{ t('settings.sign_out_device') }}
        </button>
        <button
          type="button"
          class="h-8 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent"
          @click="cancelPasswordPrompt"
        >
          {{ t('common.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>
