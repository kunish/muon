<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import type { DocEntry } from '../types/doc'

defineProps<{ doc: DocEntry, isSelected: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <button
    class="grid w-full grid-cols-[minmax(0,1fr)_120px_110px_90px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
    :class="{ 'bg-primary/8': isSelected }"
    @click="emit('select', doc.id)"
  >
    <span class="flex min-w-0 items-center gap-3">
      <span class="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-primary">
        <FileText :size="16" />
      </span>
      <span class="min-w-0">
        <span class="block truncate text-[13px] font-semibold">{{ doc.title }}</span>
        <span class="block truncate text-[12px] text-muted-foreground">{{ doc.owner }}</span>
      </span>
    </span>
    <span class="text-[12px] text-muted-foreground">{{ doc.updated }}</span>
    <span class="text-[12px] text-muted-foreground">{{ doc.type }}</span>
    <span class="justify-self-start rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground">
      {{ doc.status }}
    </span>
  </button>
</template>
