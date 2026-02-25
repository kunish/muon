<script setup lang="ts">
defineProps<{
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
}>()
</script>

<template>
  <span class="text-[10px] leading-none">
    <span v-if="status === 'sending'" class="text-muted-foreground">发送中</span>
    <span v-else-if="status === 'sent'" class="text-muted-foreground">✓</span>
    <span v-else-if="status === 'delivered'" class="text-muted-foreground">✓✓</span>
    <span v-else-if="status === 'read'" class="text-primary">✓✓</span>
    <span v-else-if="status === 'failed'" class="text-destructive">发送失败</span>
  </span>
</template>
