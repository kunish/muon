<script setup lang="ts">
import type { Contact } from '../types';
import { getUserPresenceInfo } from '@matrix/index';
import { Avatar } from '@muon/ui/avatar';
import { computed } from 'vue';

const props = defineProps<{
  contact: Contact;
  selected?: boolean;
}>();

defineEmits<{
  click: [];
  dblclick: [];
}>();

const statusMsg = computed(() => {
  return getUserPresenceInfo(props.contact.userId).statusMsg || '';
});
</script>

<template>
  <div
    class="workspace-row relative flex cursor-pointer items-center gap-3 px-3 py-2 text-muted-foreground"
    :class="selected ? 'workspace-row-active' : ''"
    @click="$emit('click')"
    @dblclick="$emit('dblclick')"
  >
    <Avatar
      :src="contact.avatarUrl"
      :alt="contact.displayName"
      :fallback="contact.displayName.slice(0, 1)"
      :color-id="contact.userId"
      :presence="contact.presence === 'online' ? 'online' : 'offline'"
      size="sm"
    />
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-semibold text-foreground">
        {{ contact.displayName }}
      </div>
      <div class="truncate text-xs text-muted-foreground">
        {{ statusMsg || contact.userId }}
      </div>
    </div>
  </div>
</template>
