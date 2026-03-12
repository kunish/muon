<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk'
import { fetchMediaBlobUrl } from '@matrix/index'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMediaViewer } from '../../composables/useMediaViewer'

const props = defineProps<{
  event: MatrixEvent
}>()

const { openImage } = useMediaViewer()
const { t } = useI18n()

const content = computed(() => props.event.getContent())
const thumbSrc = ref('')
const fullSrc = ref('')
const error = ref('')

watch(() => content.value?.url, async (mxc) => {
  thumbSrc.value = ''
  fullSrc.value = ''
  error.value = ''

  if (!mxc)
    return

  try {
    if (mxc.startsWith('mxc://')) {
      thumbSrc.value = await fetchMediaBlobUrl(mxc, 300, 300)
      fullSrc.value = await fetchMediaBlobUrl(mxc)
      if (!thumbSrc.value || !fullSrc.value) {
        throw new Error('Media download failed')
      }
    }
    else {
      // 兼容历史外链图片/GIF
      thumbSrc.value = mxc
      fullSrc.value = mxc
    }
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e)
    console.error('[ImageMessage] load failed', mxc, e instanceof Error ? e.message : e)
  }
}, { immediate: true })
</script>

<template>
  <div
    class="cursor-pointer rounded-lg overflow-hidden max-w-[300px]"
    @click="openImage(fullSrc)"
  >
    <img
      v-if="thumbSrc"
      :src="thumbSrc"
      :alt="content?.body || t('chat.image_alt')"
      class="max-w-full max-h-[400px] object-contain"
    >
    <div v-else-if="error" class="w-[200px] p-3 text-xs text-destructive">
      {{ t('chat.image_load_failed') }}: {{ error }}
    </div>
    <div v-else class="w-[200px] h-[150px] bg-muted animate-pulse rounded-lg" />
  </div>
</template>
