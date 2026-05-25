<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk';
import { fetchMediaBlobUrl } from '@matrix/index';
import { Play } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMediaFrameStyle } from '@/features/chat/lib/mediaFrame';
import { blurhashToDataUrl, readBlurhash } from '@/shared/lib/blurhash';
import { useMediaViewer } from '../../composables/useMediaViewer';

const props = defineProps<{
  event: MatrixEvent;
}>();

const { openVideo } = useMediaViewer();
const { t } = useI18n();

const content = computed(() => props.event.getContent());
const thumbBlobUrl = ref('');
const videoBlobUrl = ref('');
const loading = ref(false);
const frameStyle = computed(() => {
  const info = content.value?.info as { w?: unknown; h?: unknown } | undefined;
  return getMediaFrameStyle(info, {
    maxWidth: 300,
    maxHeight: 300,
    fallbackWidth: 250,
    fallbackHeight: 180,
  });
});
const placeholderStyle = computed(() => {
  const blurhash = readBlurhash(content.value?.info);
  if (!blurhash) return undefined;

  const dataUrl = blurhashToDataUrl(blurhash);
  if (!dataUrl) return undefined;

  return {
    backgroundImage: `url("${dataUrl}")`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  };
});

watch(
  content,
  async (c) => {
    const thumbMxc = c?.info?.thumbnail_url;
    if (thumbMxc) thumbBlobUrl.value = await fetchMediaBlobUrl(thumbMxc, 300, 200);

    const videoMxc = c?.url;
    if (videoMxc) {
      loading.value = true;
      videoBlobUrl.value = await fetchMediaBlobUrl(videoMxc);
      loading.value = false;
    }
  },
  { immediate: true },
);

function handleClick() {
  if (videoBlobUrl.value) openVideo(videoBlobUrl.value);
}
const duration = computed(() => {
  const ms = content.value?.info?.duration || 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
});
</script>

<template>
  <div
    data-testid="video-message-frame"
    class="rounded-lg overflow-hidden max-w-[300px] relative"
    :style="frameStyle"
    :class="videoBlobUrl ? 'cursor-pointer' : 'cursor-wait'"
    @click="handleClick"
  >
    <img
      v-if="thumbBlobUrl"
      :src="thumbBlobUrl"
      :alt="content?.body || t('chat.video_alt')"
      class="h-full w-full object-cover"
    />
    <video
      v-else-if="videoBlobUrl"
      :src="`${videoBlobUrl}#t=0.1`"
      preload="auto"
      muted
      class="h-full w-full object-cover pointer-events-none"
    />
    <div v-else class="h-full w-full bg-muted animate-pulse rounded-lg" :style="placeholderStyle" />
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
        <Play :size="20" class="text-white ml-0.5" />
      </div>
    </div>
    <div
      v-if="duration !== '0:00'"
      class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded"
    >
      {{ duration }}
    </div>
  </div>
</template>
