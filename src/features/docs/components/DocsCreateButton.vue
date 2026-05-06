<script setup lang="ts">
import { FilePlus2 } from 'lucide-vue-next'

const emit = defineEmits<{ create: [] }>()
</script>

<template>
  <button
    class="mx-2 mb-4 flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    @click="emit('create')"
  >
    <FilePlus2 :size="16" />
    <span>新建文档</span>
  </button>
</template>
