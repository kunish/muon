<script setup lang="ts">
import { provide, ref, shallowRef, watch } from 'vue';
import { useTyping } from '../composables/useTyping';
import { useChatStore } from '../stores/chatStore';
import ChatDocsList from './ChatDocsList.vue';
import ChatFileList from './ChatFileList.vue';
import ChatHeader from './ChatHeader.vue';
import ChatSettingsPanel from './ChatSettingsPanel.vue';
import EmojiEffectLayer from './EmojiEffectLayer.vue';
import GlobalSearch from './GlobalSearch.vue';
import KnowledgeCapturePanel from './KnowledgeCapturePanel.vue';
import MediaViewer from './MediaViewer.vue';
import MemberListPanel from './MemberListPanel.vue';
import MessageList from './MessageList.vue';
import MultiSelectBar from './MultiSelectBar.vue';
import PinnedMessages from './PinnedMessages.vue';
import RichTextInput from './RichTextInput.vue';
import StarredMessages from './StarredMessages.vue';
import TaskPanel from './TaskPanel.vue';
import ThreadInboxPanel from './ThreadInboxPanel.vue';
import ThreadPanel from './ThreadPanel.vue';
import TypingIndicator from './TypingIndicator.vue';

const store = useChatStore();
const messageListRef = ref<InstanceType<typeof MessageList> | null>(null);

const { typingUsers } = useTyping();

/** 侧栏（置顶/收藏）点击某条消息时，滚动并高亮主时间线中的该消息 */
function onPanelJumpTo(eventId: string) {
  messageListRef.value?.focusEvent(eventId);
}
type ChatContentTab = 'chat' | 'docs' | 'files';

const activeTab = shallowRef<ChatContentTab>('chat');

// --- 全屏 emoji 特效 ---
const effectLayerRef = shallowRef<InstanceType<typeof EmojiEffectLayer> | null>(null);

function triggerEmojiEffect(emoji: string, rect: DOMRect) {
  effectLayerRef.value?.trigger(emoji, rect);
}

provide('triggerEmojiEffect', triggerEmojiEffect);

watch(
  () => store.currentRoomId,
  () => {
    activeTab.value = 'chat';
  },
);
</script>

<template>
  <div class="flex-1 flex h-full min-w-0 relative">
    <div class="flex-1 flex flex-col h-full min-w-0" data-chat-area>
      <ChatHeader v-model:active-tab="activeTab" />

      <!-- Chat content -->
      <template v-if="activeTab === 'chat'">
        <MessageList ref="messageListRef" />
        <TypingIndicator :users="typingUsers" />
        <MultiSelectBar v-if="store.multiSelectMode" />
        <RichTextInput v-else />
      </template>
      <ChatDocsList v-else-if="activeTab === 'docs'" />
      <ChatFileList v-else-if="activeTab === 'files'" />

      <MediaViewer />
      <EmojiEffectLayer ref="effectLayerRef" />
    </div>

    <!-- Side panels -->
    <aside
      data-testid="chat-side-panel-shell"
      class="h-full shrink-0 overflow-hidden border-l bg-sidebar transition-[width,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      :class="store.activeSidePanel ? 'w-[320px] border-border' : 'w-0 border-transparent'"
      :aria-hidden="!store.activeSidePanel"
    >
      <Transition
        mode="out-in"
        enter-active-class="transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        leave-active-class="transition-[opacity,transform] duration-150 ease-in motion-reduce:transition-none"
        enter-from-class="translate-x-3 opacity-0"
        leave-to-class="translate-x-3 opacity-0"
      >
        <div
          v-if="store.activeSidePanel"
          :key="store.activeSidePanel"
          data-testid="chat-side-panel-frame"
          class="h-full w-[320px] overflow-hidden"
        >
          <GlobalSearch v-if="store.activeSidePanel === 'search'" @close="store.closeSidePanel()" />
          <ThreadInboxPanel
            v-else-if="store.activeSidePanel === 'threads' && store.currentRoomId"
            :room-id="store.currentRoomId"
          />
          <PinnedMessages
            v-else-if="store.activeSidePanel === 'pinned' && store.currentRoomId"
            :room-id="store.currentRoomId"
            @close="store.closeSidePanel()"
            @jump-to="onPanelJumpTo"
          />
          <StarredMessages
            v-else-if="store.activeSidePanel === 'starred' && store.currentRoomId"
            :room-id="store.currentRoomId"
            @close="store.closeSidePanel()"
            @jump-to="onPanelJumpTo"
          />
          <MemberListPanel v-else-if="store.activeSidePanel === 'members'" />
          <ChatSettingsPanel v-else-if="store.activeSidePanel === 'settings'" />
          <KnowledgeCapturePanel v-else-if="store.activeSidePanel === 'knowledge'" />
          <TaskPanel v-else-if="store.activeSidePanel === 'tasks'" />
        </div>
      </Transition>
    </aside>

    <!-- Thread panel -->
    <aside
      data-testid="thread-panel-shell"
      class="h-full shrink-0 overflow-hidden border-l bg-sidebar transition-[width,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      :class="store.activeThreadId && store.currentRoomId ? 'w-[360px] border-border' : 'w-0 border-transparent'"
      :aria-hidden="!(store.activeThreadId && store.currentRoomId)"
    >
      <Transition
        mode="out-in"
        enter-active-class="transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        leave-active-class="transition-[opacity,transform] duration-150 ease-in motion-reduce:transition-none"
        enter-from-class="translate-x-3 opacity-0"
        leave-to-class="translate-x-3 opacity-0"
      >
        <div
          v-if="store.activeThreadId && store.currentRoomId"
          :key="store.activeThreadId"
          data-testid="thread-panel-frame"
          class="h-full w-[360px] overflow-hidden"
        >
          <ThreadPanel :room-id="store.currentRoomId" :thread-root-id="store.activeThreadId" />
        </div>
      </Transition>
    </aside>
  </div>
</template>
