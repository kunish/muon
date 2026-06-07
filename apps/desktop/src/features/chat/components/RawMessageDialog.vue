<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk';
import { DialogClose, DialogContent, DialogTitle } from '@muon/ui/dialog';
import { Copy } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { buildRawEventJson } from '../lib/rawEventJson';

const props = defineProps<{
  event: MatrixEvent;
}>();

defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const { copy } = useClipboard();

function getEventContent(): string {
  return buildRawEventJson(props.event);
}

async function copyRawJson() {
  const json = getEventContent();
  try {
    await copy(json);
    toast.success(t('chat.copy_raw_json'));
  } catch {
    toast.error(t('chat.copy_message_text_failed'));
  }
}
</script>

<template>
  <DialogContent class="sm:max-w-[700px] max-h-[80vh] flex flex-col">
    <DialogTitle>{{ t('chat.raw_message_title') }}</DialogTitle>
    <pre
      class="text-xs leading-relaxed bg-muted rounded-lg p-4 mt-2 overflow-auto whitespace-pre-wrap break-all font-mono text-muted-foreground border border-border/50"
    ><code>{{ getEventContent() }}</code></pre>
    <div class="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
      <span class="text-xs text-muted-foreground select-none">event_id: {{ props.event.getId() }}</span>
      <button
        class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        @click="copyRawJson"
      >
        <Copy :size="12" />
        {{ t('chat.copy_raw_json') }}
      </button>
    </div>
    <DialogClose class="absolute right-4 top-3 rounded-sm opacity-70 hover:opacity-100" />
  </DialogContent>
</template>
