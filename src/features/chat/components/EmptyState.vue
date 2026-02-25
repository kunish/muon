<script setup lang="ts">
import { MessageCircle } from 'lucide-vue-next'
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
    <MessageCircle :size="48" :stroke-width="1.5" />
    <p class="text-lg">
      选择一个会话开始聊天
    </p>
  </div>
</template>
