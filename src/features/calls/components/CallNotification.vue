<script setup lang="ts">
import { Phone } from 'lucide-vue-next'
import { computed } from 'vue'
import { useCallStore } from '../stores/callStore'

const store = useCallStore()

const statusText = computed(() => {
  switch (store.state) {
    case 'connecting': return '正在连接...'
    case 'connected': return '通话中'
    case 'ended': return '通话已结束'
    default: return ''
  }
})
</script>

<template>
  <div
    v-if="store.state !== 'idle' && store.state !== 'ringing'"
    class="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-sm"
  >
    <Phone :size="14" />
    <span>{{ statusText }}</span>
  </div>
</template>
