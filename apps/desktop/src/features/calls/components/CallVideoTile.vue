<script setup lang="ts">
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';

const props = defineProps<{
  /** LiveKit 视频轨；为空时显示占位 */
  track?: LocalVideoTrack | RemoteVideoTrack | null;
  label?: string;
  /** 本地预览需静音以避免回声 */
  muted?: boolean;
  /** 无视频轨时的占位文案 */
  placeholder?: string;
}>();

const videoEl = ref<HTMLVideoElement | null>(null);

function sync() {
  const el = videoEl.value;
  if (!el) return;
  if (props.track) props.track.attach(el);
  else el.srcObject = null;
}

watch(() => props.track, sync);
onMounted(sync);
onBeforeUnmount(() => {
  if (props.track && videoEl.value) props.track.detach(videoEl.value);
});
</script>

<template>
  <div class="relative flex items-center justify-center overflow-hidden rounded-lg bg-neutral-900">
    <video
      v-show="track"
      ref="videoEl"
      class="h-full w-full object-cover"
      :class="muted ? 'object-cover' : 'object-contain'"
      autoplay
      playsinline
      :muted="muted"
      data-testid="call-video-tile-video"
    />
    <span v-if="!track" class="px-2 text-center text-xs text-neutral-400" data-testid="call-video-tile-placeholder">
      {{ placeholder || label }}
    </span>
    <span
      v-if="label"
      class="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-white"
      data-testid="call-video-tile-label"
    >
      {{ label }}
    </span>
  </div>
</template>
