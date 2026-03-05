<script setup lang="ts">
import { provide, ref } from 'vue'
import { useTyping } from '../composables/useTyping'
import { useChatStore } from '../stores/chatStore'
import ChatHeader from './ChatHeader.vue'
import ChatSettingsPanel from './ChatSettingsPanel.vue'
import EmojiEffectLayer from './EmojiEffectLayer.vue'
import MediaViewer from './MediaViewer.vue'
import MemberListPanel from './MemberListPanel.vue'
import MessageList from './MessageList.vue'
import MultiSelectBar from './MultiSelectBar.vue'
import PinnedMessages from './PinnedMessages.vue'
import RichTextInput from './RichTextInput.vue'
import SearchMessages from './SearchMessages.vue'
import StarredMessages from './StarredMessages.vue'
import TaskPanel from './TaskPanel.vue'
import ThreadInboxPanel from './ThreadInboxPanel.vue'
import ThreadPanel from './ThreadPanel.vue'
import TypingIndicator from './TypingIndicator.vue'

const store = useChatStore()

const { typingUsers } = useTyping()

// --- 全屏 emoji 特效 ---
const effectLayerRef = ref<InstanceType<typeof EmojiEffectLayer> | null>(null)

function triggerEmojiEffect(emoji: string, rect: DOMRect) {
  effectLayerRef.value?.trigger(emoji, rect)
}

provide('triggerEmojiEffect', triggerEmojiEffect)
</script>

<template>
  <div class="flex-1 flex h-full min-w-0 relative">
    <div class="flex-1 flex flex-col h-full min-w-0" data-chat-area>
      <ChatHeader />

      <!-- Chat content (Discord layout: no tabs, always show chat) -->
      <MessageList />
      <TypingIndicator :users="typingUsers" />
      <MultiSelectBar v-if="store.multiSelectMode" />
      <RichTextInput v-else />

      <MediaViewer />
      <EmojiEffectLayer ref="effectLayerRef" />
    </div>

    <!-- Side panels -->
    <Transition name="panel-slide">
      <div
        v-if="store.activeSidePanel"
        class="w-[320px] h-full border-l border-border bg-background shrink-0 overflow-hidden"
      >
        <SearchMessages
          v-if="store.activeSidePanel === 'search' && store.currentRoomId"
          :room-id="store.currentRoomId"
          @close="store.closeSidePanel()"
        />
        <ThreadInboxPanel
          v-else-if="store.activeSidePanel === 'threads' && store.currentRoomId"
          :room-id="store.currentRoomId"
        />
        <PinnedMessages
          v-else-if="store.activeSidePanel === 'pinned' && store.currentRoomId"
          :room-id="store.currentRoomId"
          @close="store.closeSidePanel()"
        />
        <StarredMessages
          v-else-if="store.activeSidePanel === 'starred' && store.currentRoomId"
          :room-id="store.currentRoomId"
          @close="store.closeSidePanel()"
        />
        <MemberListPanel
          v-else-if="store.activeSidePanel === 'members'"
        />
        <ChatSettingsPanel
          v-else-if="store.activeSidePanel === 'settings'"
        />
        <TaskPanel v-else-if="store.activeSidePanel === 'tasks'" />
      </div>
    </Transition>

    <!-- Thread panel -->
    <Transition name="thread-slide">
      <ThreadPanel
        v-if="store.activeThreadId && store.currentRoomId"
        :room-id="store.currentRoomId"
        :thread-root-id="store.activeThreadId"
      />
    </Transition>
  </div>
</template>

<style scoped>
.thread-slide-enter-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.thread-slide-leave-active {
  transition: all 0.2s ease-in;
}
.thread-slide-enter-from,
.thread-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.panel-slide-enter-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.panel-slide-leave-active {
  transition: all 0.2s ease-in;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
