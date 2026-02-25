<script setup lang="ts">
import { useTyping } from '../composables/useTyping'
import ChatHeader from './ChatHeader.vue'
import MessageList from './MessageList.vue'
import RichTextInput from './RichTextInput.vue'
import TypingIndicator from './TypingIndicator.vue'

const { typingUsers } = useTyping()
</script>

<template>
  <div class="flex-1 flex flex-col h-full min-w-0">
    <ChatHeader />
    <MessageList />
    <TypingIndicator :users="typingUsers" />
    <RichTextInput />
  </div>
</template>
