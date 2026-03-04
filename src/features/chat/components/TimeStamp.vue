<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTimestampDivider } from '../lib/format'

const props = defineProps<{
  timestamp: number
}>()

const { locale } = useI18n()

const label = computed(() => formatTimestampDivider(props.timestamp, locale.value))
</script>

<template>
  <div class="flex items-center gap-3 py-3">
    <div class="flex-1 h-px bg-border/50" />
    <span class="text-[11px] text-muted-foreground/60 font-medium select-none">{{ label }}</span>
    <div class="flex-1 h-px bg-border/50" />
  </div>
</template>
