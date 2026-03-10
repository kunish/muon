<script setup lang="ts">
import type { Contact } from '../stores/contactStore'
import { getUserPresenceInfo } from '@matrix/index'
import { computed } from 'vue'

const props = defineProps<{
  contact: Contact
  selected?: boolean
}>()

defineEmits<{
  click: []
  dblclick: []
}>()

const statusMsg = computed(() => {
  return getUserPresenceInfo(props.contact.userId).statusMsg || ''
})
</script>

<template>
  <div
    class="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
    :class="selected ? 'bg-accent' : 'hover:bg-accent/50'"
    @click="$emit('click')"
    @dblclick="$emit('dblclick')"
  >
    <div class="relative">
      <div class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
        {{ contact.displayName.slice(0, 1) }}
      </div>
      <div
        class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
        :class="contact.presence === 'online' ? 'bg-success' : 'bg-muted-foreground/30'"
      />
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-sm truncate">
        {{ contact.displayName }}
      </div>
      <div v-if="statusMsg" class="text-xs text-muted-foreground/70 truncate">
        {{ statusMsg }}
      </div>
      <div v-else class="text-xs text-muted-foreground truncate">
        {{ contact.userId }}
      </div>
    </div>
  </div>
</template>
