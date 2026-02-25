<script setup lang="ts">
defineProps<{
  users: string[]
}>()
</script>

<template>
  <div v-if="users.length" class="px-4 py-1 text-xs text-muted-foreground flex items-center gap-1">
    <span>{{ users.join(', ') }} 正在输入</span>
    <span class="inline-flex gap-0.5">
      <span class="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
      <span class="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
      <span class="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
    </span>
  </div>
</template>
