<script setup lang="ts">
import { useTyping } from '../composables/useTyping'
import ChatHeader from './ChatHeader.vue'
import MessageInput from './MessageInput.vue'
import MessageList from './MessageList.vue'
import TypingIndicator from './TypingIndicator.vue'

const { typingUsers } = useTyping()
</script>

<template>
  <div class="flex-1 flex flex-col h-full min-w-0">
    <ChatHeader />
    <MessageList />
    <TypingIndicator :users="typingUsers" />
    <MessageInput />
  </div>
</template>
