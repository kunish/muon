<script setup lang="ts">
import { Avatar } from '@muon/ui/avatar';
import { useSelector } from '@tanstack/vue-store';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-vue-next';
import { acceptCall, callStore, declineCall, hangup, selectIsActive, toggleMute } from '../stores/callStore';

const { t } = useI18n();

const isActive = useSelector(callStore, selectIsActive);
const status = useSelector(callStore, (s) => s.status);
const mode = useSelector(callStore, (s) => s.mode);
const peerName = useSelector(callStore, (s) => s.peerName);
const peerId = useSelector(callStore, (s) => s.peerId);
const startedAt = useSelector(callStore, (s) => s.startedAt);
const isMuted = useSelector(callStore, (s) => s.isMuted);

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
    elapsed.value = startedAt.value ? Math.floor((Date.now() - startedAt.value) / 1000) : 0;
  }, 1000);
}

watch(status, (value) => {
  if (value === 'connected') {
    elapsed.value = 0;
    startTimer();
  } else {
    stopTimer();
    elapsed.value = 0;
  }
});

onUnmounted(stopTimer);

const duration = computed(() => {
  const m = Math.floor(elapsed.value / 60)
    .toString()
    .padStart(2, '0');
  const s = (elapsed.value % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
});

const statusLabel = computed(() => {
  switch (status.value) {
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

const incomingLabel = computed(() =>
  mode.value === 'video' ? t('calls.incoming_video_call') : t('calls.incoming_call'),
);
</script>

<template>
  <Teleport to="body">
    <!-- 来电横幅 -->
    <div
      v-if="status === 'incoming'"
      class="fixed right-4 top-4 z-[300] flex w-[300px] items-center gap-3 rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-xl"
      data-testid="call-incoming"
    >
      <Avatar :alt="peerName || ''" :color-id="peerId || ''" size="md" shape="circle" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-foreground">{{ peerName }}</div>
        <div class="text-xs text-muted-foreground">{{ incomingLabel }}</div>
      </div>
      <button
        class="flex size-9 items-center justify-center rounded-full bg-destructive text-white transition-opacity hover:opacity-90"
        :title="t('calls.decline')"
        data-testid="call-decline"
        @click="declineCall()"
      >
        <PhoneOff :size="16" />
      </button>
      <button
        class="flex size-9 items-center justify-center rounded-full bg-success text-white transition-opacity hover:opacity-90"
        :title="t('calls.accept')"
        data-testid="call-accept"
        @click="acceptCall()"
      >
        <Phone :size="16" />
      </button>
    </div>

    <!-- 在途通话条（仅音频；视频走 CallWindow） -->
    <div
      v-else-if="isActive && mode === 'audio'"
      class="fixed right-4 top-4 z-[300] flex w-[300px] items-center gap-3 rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-xl"
      data-testid="call-active"
    >
      <Avatar :alt="peerName || ''" :color-id="peerId || ''" size="md" shape="circle" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-foreground">{{ peerName }}</div>
        <div class="text-xs tabular-nums text-muted-foreground" data-testid="call-status">{{ statusLabel }}</div>
      </div>
      <button
        class="flex size-9 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
        :title="isMuted ? t('calls.unmute') : t('calls.mute')"
        data-testid="call-mute"
        @click="toggleMute()"
      >
        <component :is="isMuted ? MicOff : Mic" :size="16" />
      </button>
      <button
        class="flex size-9 items-center justify-center rounded-full bg-destructive text-white transition-opacity hover:opacity-90"
        :title="t('calls.end_call')"
        data-testid="call-hangup"
        @click="hangup()"
      >
        <PhoneOff :size="16" />
      </button>
    </div>
  </Teleport>
</template>
