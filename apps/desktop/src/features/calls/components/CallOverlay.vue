<script setup lang="ts">
import { Avatar } from '@muon/ui/avatar';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-vue-next';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCallStore } from '../stores/callStore';

const call = useCallStore();
const { t } = useI18n();

const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startTimer() {
  stopTimer();
  timer = setInterval(() => {
    elapsed.value = call.startedAt ? Math.floor((Date.now() - call.startedAt) / 1000) : 0;
  }, 1000);
}

watch(
  () => call.status,
  (status) => {
    if (status === 'connected') {
      elapsed.value = 0;
      startTimer();
    } else {
      stopTimer();
      elapsed.value = 0;
    }
  },
);

onUnmounted(stopTimer);

const duration = computed(() => {
  const m = Math.floor(elapsed.value / 60)
    .toString()
    .padStart(2, '0');
  const s = (elapsed.value % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
});

const statusLabel = computed(() => {
  switch (call.status) {
    case 'outgoing':
      return t('calls.outgoing_call');
    case 'connecting':
      return t('calls.connecting_label');
    case 'connected':
      return duration.value;
    default:
      return '';
  }
});
</script>

<template>
  <Teleport to="body">
    <!-- 来电横幅 -->
    <div
      v-if="call.status === 'incoming'"
      class="fixed right-4 top-4 z-[300] flex w-[300px] items-center gap-3 rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-xl"
      data-testid="call-incoming"
    >
      <Avatar :alt="call.peerName || ''" :color-id="call.peerId || ''" size="md" shape="circle" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-foreground">{{ call.peerName }}</div>
        <div class="text-xs text-muted-foreground">{{ t('calls.incoming_call') }}</div>
      </div>
      <button
        class="flex size-9 items-center justify-center rounded-full bg-destructive text-white transition-opacity hover:opacity-90"
        :title="t('calls.decline')"
        data-testid="call-decline"
        @click="call.declineCall()"
      >
        <PhoneOff :size="16" />
      </button>
      <button
        class="flex size-9 items-center justify-center rounded-full bg-success text-white transition-opacity hover:opacity-90"
        :title="t('calls.accept')"
        data-testid="call-accept"
        @click="call.acceptCall()"
      >
        <Phone :size="16" />
      </button>
    </div>

    <!-- 在途通话条 -->
    <div
      v-else-if="call.isActive"
      class="fixed right-4 top-4 z-[300] flex w-[300px] items-center gap-3 rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-xl"
      data-testid="call-active"
    >
      <Avatar :alt="call.peerName || ''" :color-id="call.peerId || ''" size="md" shape="circle" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-foreground">{{ call.peerName }}</div>
        <div class="text-xs tabular-nums text-muted-foreground" data-testid="call-status">{{ statusLabel }}</div>
      </div>
      <button
        class="flex size-9 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
        :title="call.isMuted ? t('calls.unmute') : t('calls.mute')"
        data-testid="call-mute"
        @click="call.toggleMute()"
      >
        <component :is="call.isMuted ? MicOff : Mic" :size="16" />
      </button>
      <button
        class="flex size-9 items-center justify-center rounded-full bg-destructive text-white transition-opacity hover:opacity-90"
        :title="t('calls.end_call')"
        data-testid="call-hangup"
        @click="call.hangup()"
      >
        <PhoneOff :size="16" />
      </button>
    </div>
  </Teleport>
</template>
