<script setup lang="ts">
import WorkspaceAppRail from './WorkspaceAppRail.vue'

withDefaults(defineProps<{
  messageUnreadCount?: number
}>(), {
  messageUnreadCount: 0,
})
</script>

<template>
  <div class="flex h-full overflow-hidden bg-background text-foreground">
    <WorkspaceAppRail :message-unread-count="messageUnreadCount" />
    <slot name="message-sidebar" />
    <main class="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
      <slot />
    </main>
    <slot name="overlays" />
  </div>
</template>
