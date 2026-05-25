<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk';
import { fetchMediaBlobUrl, getInstantMediaBlobUrl } from '@matrix/index';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMediaFrameStyle } from '@/features/chat/lib/mediaFrame';
import { blurhashToDataUrl, readBlurhash } from '@/shared/lib/blurhash';
import { useMediaViewer } from '../../composables/useMediaViewer';

const props = defineProps<{
  event: MatrixEvent;
}>();

const { openImage } = useMediaViewer();
const { t } = useI18n();

const content = computed(() => props.event.getContent());
const thumbSrc = ref('');
const fullSrc = ref('');
const error = ref('');

function shouldFetchAsBlobUrl(url: string): boolean {
  return url.startsWith('mxc://') || url.startsWith('http://') || url.startsWith('https://');
}

const frameStyle = computed(() => {
  const info = content.value?.info as { w?: unknown; h?: unknown } | undefined;
  return getMediaFrameStyle(info, {
    maxWidth: 300,
    maxHeight: 400,
    fallbackWidth: 200,
    fallbackHeight: 150,
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
  () => content.value?.url,
  async (mxc) => {
    thumbSrc.value = '';
    fullSrc.value = '';
    error.value = '';

    if (!mxc) return;

    try {
      if (shouldFetchAsBlobUrl(mxc)) {
        const instantSrc = getInstantMediaBlobUrl(mxc, 300, 300);
        if (instantSrc) {
          thumbSrc.value = instantSrc;
          fullSrc.value = instantSrc;
        }

        thumbSrc.value = await fetchMediaBlobUrl(mxc, 300, 300);
        fullSrc.value = await fetchMediaBlobUrl(mxc);
        if (!thumbSrc.value || !fullSrc.value) {
          throw new Error('Media download failed');
        }
      } else {
        // 兼容历史外链图片/GIF
        thumbSrc.value = mxc;
        fullSrc.value = mxc;
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
      console.error('[ImageMessage] load failed', mxc, e instanceof Error ? e.message : e);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="cursor-pointer rounded-lg overflow-hidden max-w-[300px]" :style="frameStyle" @click="openImage(fullSrc)">
    <img
      v-if="thumbSrc"
      :src="thumbSrc"
      :alt="content?.body || t('chat.image_alt')"
      class="h-full w-full object-contain"
    />
    <div v-else-if="error" class="flex h-full w-full items-center p-3 text-xs text-destructive">
      {{ t('chat.image_load_failed') }}: {{ error }}
    </div>
    <div v-else class="h-full w-full bg-muted animate-pulse rounded-lg" :style="placeholderStyle" />
  </div>
</template>
