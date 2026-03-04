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
      <span class="typing-dot" />
      <span class="typing-dot [animation-delay:160ms]" />
      <span class="typing-dot [animation-delay:320ms]" />
    </span>
    <span class="font-medium truncate">{{ typingText }}</span>
  </div>
</template>

<style scoped>
.typing-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-muted-foreground);
  animation: typing-bounce 1.4s infinite ease-in-out;
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
