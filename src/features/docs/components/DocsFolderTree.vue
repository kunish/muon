<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next'

defineProps<{
  folders: string[]
  activeFolder: string
}>()

const emit = defineEmits<{ select: [folder: string] }>()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
    <button
      v-for="folder in folders"
      :key="folder"
      class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
      :class="{ 'workspace-row-active': activeFolder === folder }"
      @click="emit('select', folder)"
    >
      <FolderOpen :size="18" />
      <span class="truncate text-[13px]">{{ folder }}</span>
    </button>
  </div>
</template>
