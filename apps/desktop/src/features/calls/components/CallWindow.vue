<script setup lang="ts">
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';
import { Circle, Disc, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff, Video, VideoOff } from 'lucide-vue-next';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { localVideoTrack, remoteVideos } from '../lib/callMedia';
import { useCallStore } from '../stores/callStore';
import CallVideoTile from './CallVideoTile.vue';

const call = useCallStore();
const { t } = useI18n();

const isVideoActive = computed(() => call.isActive && call.mode === 'video');
const hasRemote = computed(() => remoteVideos.value.length > 0);

interface CallTile {
  key: string;
  track: LocalVideoTrack | RemoteVideoTrack | null;
  label: string;
  muted: boolean;
  placeholder?: string;
}

function identityLabel(identity: string): string {
  return identity.split(':')[0]?.replace(/^@/, '') || identity;
}

/** 远端参与者 + 本地预览，全部以网格平铺（支持多人会议） */
const tiles = computed<CallTile[]>(() => {
  const remote: CallTile[] = remoteVideos.value.map((feed) => ({
    key: feed.id,
    track: feed.track,
    label:
      remoteVideos.value.length === 1 ? call.peerName || identityLabel(feed.identity) : identityLabel(feed.identity),
    muted: false,
  }));
  remote.push({
    key: 'local',
    track: call.isCameraOff ? null : localVideoTrack.value,
    label: t('calls.you_label'),
    muted: true,
    placeholder: t('calls.camera_disabled'),
  });
  return remote;
});

const gridClass = computed(() => {
  const count = tiles.value.length;
  if (count <= 1) return 'grid-cols-1';
  if (count <= 4) return 'grid-cols-2';
  if (count <= 9) return 'grid-cols-3';
  return 'grid-cols-4';
});

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
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVideoActive"
      class="fixed inset-0 z-[290] flex flex-col bg-neutral-950 text-white"
      data-testid="call-window"
    >
      <div class="relative flex flex-1 flex-col overflow-hidden">
        <!-- 顶部信息 -->
        <div
          class="absolute left-0 right-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent p-4"
        >
          <span class="text-sm font-medium">{{ call.peerName }}</span>
          <span class="text-xs tabular-nums text-neutral-300" data-testid="call-window-status">{{ statusLabel }}</span>
        </div>

        <!-- 参与者网格 -->
        <div class="grid flex-1 gap-2 p-3" :class="gridClass" data-testid="call-window-grid">
          <CallVideoTile
            v-for="tile in tiles"
            :key="tile.key"
            :track="tile.track"
            :label="tile.label"
            :muted="tile.muted"
            :placeholder="tile.placeholder"
          />
        </div>

        <!-- 等待对方加入 -->
        <div
          v-if="!hasRemote"
          class="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-neutral-300"
        >
          {{ t('calls.waiting_peer') }}
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
          class="flex size-12 items-center justify-center rounded-full transition-colors"
          :class="call.isScreenSharing ? 'bg-primary hover:bg-primary/90' : 'bg-white/10 hover:bg-white/20'"
          :title="call.isScreenSharing ? t('calls.stop_share') : t('calls.share_screen')"
          data-testid="call-window-screen"
          @click="call.toggleScreenShare()"
        >
          <component :is="call.isScreenSharing ? MonitorOff : MonitorUp" :size="20" />
        </button>
        <button
          class="flex size-12 items-center justify-center rounded-full transition-colors"
          :class="call.isRecording ? 'bg-destructive hover:opacity-90' : 'bg-white/10 hover:bg-white/20'"
          :title="call.isRecording ? t('calls.stop_recording') : t('calls.start_recording')"
          data-testid="call-window-record"
          @click="call.toggleRecording()"
        >
          <component :is="call.isRecording ? Disc : Circle" :size="20" />
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
