<script setup lang="ts">
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-vue-next';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { localVideoTrack, remoteVideos } from '../lib/callMedia';
import { useCallStore } from '../stores/callStore';

const call = useCallStore();
const { t } = useI18n();

const isVideoActive = computed(() => call.isActive && call.mode === 'video');
const remoteFeed = computed(() => remoteVideos.value[0] ?? null);

const remoteVideoEl = ref<HTMLVideoElement | null>(null);
const localVideoEl = ref<HTMLVideoElement | null>(null);

const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(
  () => call.status,
  (status) => {
    if (status === 'connected') {
      elapsed.value = 0;
      stopTimer();
      timer = setInterval(() => {
        elapsed.value = call.startedAt ? Math.floor((Date.now() - call.startedAt) / 1000) : 0;
      }, 1000);
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

/** 把 LiveKit 轨道挂载到对应的 video 元素上（DOM 就绪后） */
async function syncVideos() {
  await nextTick();

  const localEl = localVideoEl.value;
  if (localEl) {
    if (localVideoTrack.value) localVideoTrack.value.attach(localEl);
    else localEl.srcObject = null;
  }

  const remoteEl = remoteVideoEl.value;
  if (remoteEl) {
    if (remoteFeed.value) remoteFeed.value.track.attach(remoteEl);
    else remoteEl.srcObject = null;
  }
}

watch([isVideoActive, () => localVideoTrack.value, remoteFeed], syncVideos, { immediate: true });
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVideoActive"
      class="fixed inset-0 z-[290] flex flex-col bg-neutral-950 text-white"
      data-testid="call-window"
    >
      <!-- 远端主画面 -->
      <div class="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          v-show="remoteFeed"
          ref="remoteVideoEl"
          class="h-full w-full object-contain"
          autoplay
          playsinline
          data-testid="call-window-remote"
        />
        <div v-if="!remoteFeed" class="flex flex-col items-center gap-2 text-neutral-400">
          <span class="text-lg font-medium text-white">{{ call.peerName }}</span>
          <span class="text-sm">{{ t('calls.waiting_peer') }}</span>
        </div>

        <!-- 顶部信息 -->
        <div
          class="absolute left-0 right-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent p-4"
        >
          <span class="text-sm font-medium">{{ call.peerName }}</span>
          <span class="text-xs tabular-nums text-neutral-300" data-testid="call-window-status">{{ statusLabel }}</span>
        </div>

        <!-- 本地预览 -->
        <div
          class="absolute bottom-4 right-4 flex h-32 w-24 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-neutral-900 shadow-xl"
        >
          <video
            v-show="!call.isCameraOff"
            ref="localVideoEl"
            class="h-full w-full object-cover"
            autoplay
            muted
            playsinline
            data-testid="call-window-local"
          />
          <span v-if="call.isCameraOff" class="px-1 text-center text-[10px] text-neutral-400">
            {{ t('calls.camera_disabled') }}
          </span>
        </div>
      </div>

      <!-- 控制条 -->
      <div class="flex items-center justify-center gap-4 bg-black/40 py-4">
        <button
          class="flex size-12 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          :title="call.isMuted ? t('calls.unmute') : t('calls.mute')"
          data-testid="call-window-mute"
          @click="call.toggleMute()"
        >
          <component :is="call.isMuted ? MicOff : Mic" :size="20" />
        </button>
        <button
          class="flex size-12 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          :title="call.isCameraOff ? t('calls.turn_on_camera') : t('calls.turn_off_camera')"
          data-testid="call-window-camera"
          @click="call.toggleCamera()"
        >
          <component :is="call.isCameraOff ? VideoOff : Video" :size="20" />
        </button>
        <button
          class="flex size-12 items-center justify-center rounded-full bg-destructive transition-opacity hover:opacity-90"
          :title="t('calls.end_call')"
          data-testid="call-window-hangup"
          @click="call.hangup()"
        >
          <PhoneOff :size="20" />
        </button>
      </div>
    </div>
  </Teleport>
</template>
