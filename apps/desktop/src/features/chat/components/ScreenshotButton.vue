<script setup lang="ts">
import { ChevronDown, Loader2, Scissors } from 'lucide-vue-next';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { captureScreen } from '@/desktop/screenshot';

const emit = defineEmits<{
  capture: [file: File];
}>();

const { t } = useI18n();
const loading = ref(false);

async function takeScreenshot() {
  if (loading.value) return;
  loading.value = true;
  try {
    const blob = await captureScreen();
    if (blob) {
      const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
      emit('capture', file);
      return;
    }
    toast.error(t('chat.screenshot_failed'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <button
    class="inline-flex h-8 items-center justify-center gap-0.5 rounded-md px-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50"
    :disabled="loading"
    :title="$t('chat.screenshot')"
    @click="takeScreenshot"
  >
    <Loader2 v-if="loading" :size="18" class="animate-spin" />
    <template v-else>
      <Scissors :size="18" />
      <ChevronDown :size="12" />
    </template>
  </button>
</template>
