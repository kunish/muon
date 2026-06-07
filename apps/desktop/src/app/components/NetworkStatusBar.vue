<script setup lang="ts">
import type { ConnectionStatus } from '@shared/composables/useNetworkStatus';
import { useNetworkStatus } from '@shared/composables/useNetworkStatus';
import { ServerOff, Wifi, WifiOff } from 'lucide-vue-next';

const { t } = useI18n();
const { status } = useNetworkStatus();

const showRecovered = ref(false);
const visible = ref(status.value !== 'online');
let hideTimer: ReturnType<typeof setTimeout> | undefined;

watch(status, (current: ConnectionStatus, previous: ConnectionStatus) => {
  if (current === 'online' && previous !== 'online') {
    // 恢复在线
    showRecovered.value = true;
    visible.value = true;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      visible.value = false;
      showRecovered.value = false;
    }, 2000);
  } else if (current !== 'online') {
    // 断网或服务器不可达
    clearTimeout(hideTimer);
    showRecovered.value = false;
    visible.value = true;
  }
});

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="-translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="visible"
      class="fixed left-1/2 top-3 z-[9999] flex max-w-[min(560px,calc(100vw-32px))] -translate-x-1/2 items-center justify-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium shadow-[0_14px_40px_color-mix(in_srgb,var(--color-foreground)_18%,transparent)] backdrop-blur-xl"
      :class="
        showRecovered
          ? 'bg-success/95 text-white'
          : status === 'offline'
            ? 'bg-destructive/95 text-destructive-foreground'
            : 'bg-warning/95 text-white'
      "
      role="alert"
    >
      <component :is="showRecovered ? Wifi : status === 'offline' ? WifiOff : ServerOff" class="size-4" />
      <span>{{
        showRecovered
          ? t('network.recovered')
          : status === 'offline'
            ? t('network.disconnected')
            : t('network.server_unreachable')
      }}</span>
    </div>
  </Transition>
</template>
