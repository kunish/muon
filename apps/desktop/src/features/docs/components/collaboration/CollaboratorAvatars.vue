<script setup lang="ts">
import type { CursorData } from '../../types/doc';

defineProps<{ cursors: CursorData[] }>();
</script>

<template>
  <div class="flex -space-x-2">
    <div
      v-for="cursor in cursors"
      :key="cursor.userId"
      class="flex size-7 items-center justify-center rounded-full border-2 border-background text-[11px] font-semibold text-white"
      :style="{ backgroundColor: cursor.color }"
      :title="cursor.name"
    >
      {{ cursor.name.charAt(0).toUpperCase() }}
    </div>
    <div
      v-if="cursors.length === 0"
      class="flex size-7 items-center justify-center rounded-full border-2 border-border bg-muted text-[10px] text-muted-foreground"
    >
      +0
    </div>
  </div>
</template>
