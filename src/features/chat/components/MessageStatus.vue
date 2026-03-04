<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
}>()

const { t } = useI18n()
</script>

<template>
  <span class="text-[10px] leading-none">
    <span v-if="status === 'sending'" class="text-muted-foreground">{{ t('chat.sending') }}</span>
    <span v-else-if="status === 'sent'" class="text-muted-foreground">✓</span>
    <span v-else-if="status === 'delivered'" class="text-muted-foreground">✓✓</span>
    <span v-else-if="status === 'read'" class="text-primary">✓✓</span>
    <span v-else-if="status === 'failed'" class="text-destructive">{{ t('chat.send_failed') }}</span>
  </span>
</template>
