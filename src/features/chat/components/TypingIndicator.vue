<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  users: string[]
}>()

const typingText = computed(() => {
  const u = props.users
  if (u.length === 0)
    return ''
  if (u.length === 1)
    return `${u[0]} is typing`
  if (u.length === 2)
    return `${u[0]}, ${u[1]} are typing`
  return `${u[0]}, ${u[1]}, and ${u.length - 2} more are typing`
})
</script>

<template>
  <div
    v-if="users.length"
    class="flex items-center gap-1.5 px-4 h-6 text-xs text-muted-foreground select-none"
  >
    <!-- Animated bouncing dots -->
    <span class="inline-flex items-center gap-[3px]">
      <span class="h-1 w-1 rounded-full bg-muted-foreground animate-typing-bounce" />
      <span class="h-1 w-1 rounded-full bg-muted-foreground animate-typing-bounce [animation-delay:160ms]" />
      <span class="h-1 w-1 rounded-full bg-muted-foreground animate-typing-bounce [animation-delay:320ms]" />
    </span>
    <span class="font-medium truncate">{{ typingText }}</span>
  </div>
</template>
