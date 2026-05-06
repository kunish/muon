<script setup lang="ts">
import type { DocEntry } from '../types/doc'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@muon/ui/tooltip'
import { Eye, FileText, FolderInput, Pencil, Trash2 } from 'lucide-vue-next'

defineProps<{ doc: DocEntry, isSelected: boolean }>()
const emit = defineEmits<{
  select: [id: string]
  rename: [doc: DocEntry]
  move: [doc: DocEntry]
  delete: [doc: DocEntry]
}>()
const titleTooltipContentClass = 'relative max-w-[420px] overflow-visible break-words rounded-lg bg-[#1f2329] px-3 py-2 text-[13px] leading-[18px] text-white shadow-[0_8px_24px_rgba(31,35,41,0.18)] before:absolute before:left-[-4px] before:top-1/2 before:size-2 before:-translate-y-1/2 before:rotate-45 before:bg-[#1f2329]'
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <div
      class="grid w-full grid-cols-[minmax(0,1fr)_120px_110px_90px_156px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
      :class="{ 'bg-primary/8': isSelected }"
    >
      <button
        class="flex min-w-0 items-center gap-3 text-left"
        data-testid="docs-open-row"
        @click="emit('select', doc.id)"
      >
        <span class="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-primary">
          <FileText :size="16" />
        </span>
        <span class="min-w-0">
          <Tooltip>
            <TooltipTrigger as-child>
              <span
                class="block truncate text-[13px] font-semibold"
                data-testid="docs-document-title"
                :aria-label="doc.title"
              >
                {{ doc.title }}
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              :side-offset="12"
              :class="titleTooltipContentClass"
            >
              {{ doc.title }}
            </TooltipContent>
          </Tooltip>
          <span class="block truncate text-[12px] text-muted-foreground">{{ doc.owner }}</span>
        </span>
      </button>
      <span class="text-[12px] text-muted-foreground">{{ doc.updated }}</span>
      <span class="text-[12px] text-muted-foreground">{{ doc.type }}</span>
      <span class="justify-self-start rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground">
        {{ doc.status }}
      </span>
      <span class="flex items-center justify-end gap-1">
        <button
          data-testid="docs-open"
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="打开"
          aria-label="打开"
          @click="emit('select', doc.id)"
        >
          <Eye :size="16" />
        </button>
        <button
          data-testid="docs-rename"
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="重命名"
          aria-label="重命名"
          @click="emit('rename', doc)"
        >
          <Pencil :size="16" />
        </button>
        <button
          data-testid="docs-move"
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="移动到文件夹"
          aria-label="移动到文件夹"
          @click="emit('move', doc)"
        >
          <FolderInput :size="16" />
        </button>
        <button
          data-testid="docs-delete"
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="删除"
          aria-label="删除"
          @click="emit('delete', doc)"
        >
          <Trash2 :size="16" />
        </button>
      </span>
    </div>
  </TooltipProvider>
</template>
