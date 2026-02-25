<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

const props = defineProps<{
  timestamp: number
}>()

const label = computed(() =>
  formatDistanceToNow(props.timestamp, { addSuffix: true, locale: zhCN }),
)
</script>

<template>
  <div class="flex items-center gap-3 py-3">
    <div class="flex-1 h-px bg-border" />
    <span class="text-xs text-muted-foreground">{{ label }}</span>
    <div class="flex-1 h-px bg-border" />
  </div>
</template>
