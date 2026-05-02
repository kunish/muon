<script setup lang="ts">
import type { Contact } from '../stores/contactStore'
import { getUserPresenceInfo } from '@matrix/index'
import { Avatar } from '@muon/ui/avatar'
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
    class="workspace-row relative flex cursor-pointer items-center gap-3 px-3 py-2 text-muted-foreground"
    :class="selected ? 'workspace-row-active' : ''"
    @click="$emit('click')"
    @dblclick="$emit('dblclick')"
  >
    <div class="relative">
      <Avatar
        :src="contact.avatarUrl"
        :alt="contact.displayName"
        :fallback="contact.displayName.slice(0, 1)"
        :color-id="contact.userId"
        size="sm"
      />
      <div
        class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar"
        :class="contact.presence === 'online' ? 'bg-success' : 'bg-muted-foreground/30'"
      />
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-[13px] font-semibold text-foreground">
        {{ contact.displayName }}
      </div>
      <div v-if="statusMsg" class="truncate text-[12px] text-muted-foreground">
        {{ statusMsg }}
      </div>
      <div v-else class="truncate text-[12px] text-muted-foreground">
        {{ contact.userId }}
      </div>
    </div>
  </div>
</template>
