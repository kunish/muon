<script setup lang="ts">
import { Phone } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCallStore } from '../stores/callStore'

const { t } = useI18n()
const store = useCallStore()

const statusText = computed(() => {
  switch (store.state) {
    case 'connecting': return t('calls.connecting')
    case 'connected': return t('calls.in_call')
    case 'ended': return t('calls.ended')
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
