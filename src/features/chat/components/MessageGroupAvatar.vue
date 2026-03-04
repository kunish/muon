<script setup lang="ts">
import { getClient } from '@matrix/client'
import { computed } from 'vue'
import Avatar from '@/shared/components/ui/avatar.vue'

const props = defineProps<{
  /** The sender user ID, e.g. @alice:matrix.org */
  senderId: string
  /** The room ID to resolve display name / avatar */
  roomId: string
}>()

const emit = defineEmits<{
  avatarClick: [userId: string, event: MouseEvent]
}>()

const senderName = computed(() => {
  const client = getClient()
  const room = client.getRoom(props.roomId)
  const member = room?.getMember(props.senderId)
  return member?.name || props.senderId
})

const senderMxcAvatar = computed(() => {
  const client = getClient()
  const room = client.getRoom(props.roomId)
  const member = room?.getMember(props.senderId)
  return member?.getMxcAvatarUrl() || undefined
})
</script>

<template>
  <Avatar
    :src="senderMxcAvatar"
    :alt="senderName"
    :color-id="senderId"
    size="md"
    clickable
    @click="emit('avatarClick', senderId, $event)"
  />
</template>
