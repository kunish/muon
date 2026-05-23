<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk'
import { DialogClose, DialogContent, DialogTitle } from '@muon/ui/dialog'
import { useClipboard } from '@vueuse/core'
import { Copy } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { safeJsonStringify } from '@/shared/lib/utils'

const props = defineProps<{
  event: MatrixEvent
}>()

defineEmits<{
  close: []
}>()

const { t } = useI18n()
const { copy } = useClipboard()

function getEventContent(): string {
  const parts: string[] = []

  const addField = (key: string, getter: () => unknown) => {
    try {
      const val = getter()
      parts.push(`  "${key}": ${safeJsonStringify(val)}`)
    }
    catch (e) {
      parts.push(`  "${key}": "[Error: ${e instanceof Error ? e.message : 'unknown'}]"`)
    }
  }

  addField('event_id', () => props.event.getId())
  addField('type', () => props.event.getType())
  addField('sender', () => props.event.getSender())
  addField('room_id', () => props.event.getRoomId())
  addField('state_key', () => props.event.getStateKey())
  addField('origin_server_ts', () => props.event.getTs())
  addField('content', () => props.event.getContent())
  addField('unsigned', () => props.event.getUnsigned())
  addField('redacted_because', () => props.event.getUnsigned()?.redacted_because ?? null)

  return `{\n${parts.join(',\n')}\n}`
}

async function copyRawJson() {
  const json = getEventContent()
  try {
    await copy(json)
    toast.success(t('chat.copy_raw_json'))
  }
  catch {
    toast.success(t('chat.copy_raw_json'))
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
