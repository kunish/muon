<script setup lang="ts">
import { useSelector } from '@tanstack/vue-store';
import { useTyping } from '../composables/useTyping';
import { chatStore, closeSidePanel, exitMultiSelect } from '../stores/chatStore';
import ChatDocsList from './ChatDocsList.vue';
import ChatFileList from './ChatFileList.vue';
import ChatHeader from './ChatHeader.vue';
import ChatSettingsPanel from './ChatSettingsPanel.vue';
import EmojiEffectLayer from './EmojiEffectLayer.vue';
import ForwardDialog from './ForwardDialog.vue';
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

const { t } = useI18n();
const messageListRef = ref<InstanceType<typeof MessageList> | null>(null);
const richTextInputRef = ref<InstanceType<typeof RichTextInput> | null>(null);
const isDraggingFiles = ref(false);
const showMergedForward = ref(false);

const currentRoomId = useSelector(chatStore, (s) => s.currentRoomId);
const selectedMessages = useSelector(chatStore, (s) => s.selectedMessages);
const multiSelectMode = useSelector(chatStore, (s) => s.multiSelectMode);
const activeSidePanel = useSelector(chatStore, (s) => s.activeSidePanel);
const activeThreadId = useSelector(chatStore, (s) => s.activeThreadId);

/** 多选「合并转发」：用所选事件打开转发对话框 */
function onMergedForward() {
  if (selectedMessages.value.size > 0) showMergedForward.value = true;
}

function onMergedForwardClose() {
  showMergedForward.value = false;
  exitMultiSelect();
}

const { typingUsers } = useTyping();

/** 侧栏（置顶/收藏）点击某条消息时，滚动并高亮主时间线中的该消息 */
function onPanelJumpTo(eventId: string) {
  messageListRef.value?.focusEvent(eventId);
}

type ChatContentTab = 'chat' | 'docs' | 'files';

const activeTab = shallowRef<ChatContentTab>('chat');

// --- 拖拽文件发送（飞书风格：拖到聊天区出现遮罩，松手暂存到输入框） ---
function canAcceptFileDrop(): boolean {
  return activeTab.value === 'chat' && !multiSelectMode.value && !!currentRoomId.value;
}

function dragHasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function onChatDragOver(event: DragEvent) {
  if (!canAcceptFileDrop() || !dragHasFiles(event)) return;
  event.preventDefault();
  isDraggingFiles.value = true;
}

function onChatDragLeave(event: DragEvent) {
  const related = event.relatedTarget as Node | null;
  const area = event.currentTarget as HTMLElement;
  if (related && area.contains(related)) return;
  isDraggingFiles.value = false;
}

function onChatDrop(event: DragEvent) {
  isDraggingFiles.value = false;
  if (!canAcceptFileDrop()) return;
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (!files.length) return;
  event.preventDefault();
  richTextInputRef.value?.acceptDroppedFiles(files);
}

// --- 全屏 emoji 特效 ---
const effectLayerRef = shallowRef<InstanceType<typeof EmojiEffectLayer> | null>(null);

function triggerEmojiEffect(emoji: string, rect: DOMRect) {
  effectLayerRef.value?.trigger(emoji, rect);
}

provide('triggerEmojiEffect', triggerEmojiEffect);

watch(currentRoomId, () => {
  activeTab.value = 'chat';
});
</script>

<template>
  <div class="flex-1 flex h-full min-w-0 relative">
    <div
      class="relative flex-1 flex flex-col h-full min-w-0"
      data-chat-area
      @dragover="onChatDragOver"
      @dragenter="onChatDragOver"
      @dragleave="onChatDragLeave"
      @drop="onChatDrop"
    >
      <ChatHeader v-model:active-tab="activeTab" />

      <!-- Chat content -->
      <template v-if="activeTab === 'chat'">
        <MessageList ref="messageListRef" />
        <TypingIndicator :users="typingUsers" />
        <MultiSelectBar v-if="multiSelectMode" @forward="onMergedForward" />
        <RichTextInput v-else ref="richTextInputRef" />
      </template>

      <!-- 拖拽文件遮罩 -->
      <div
        v-if="isDraggingFiles"
        class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-primary/50 bg-primary/10 backdrop-blur-sm"
        data-testid="chat-drop-overlay"
      >
        <div class="rounded-lg bg-popover px-4 py-3 text-sm font-medium text-foreground shadow-lg">
          {{ t('chat.drop_to_send') }}
        </div>
      </div>
      <ChatDocsList v-else-if="activeTab === 'docs'" />
      <ChatFileList v-else-if="activeTab === 'files'" />

      <MediaViewer />
      <EmojiEffectLayer ref="effectLayerRef" />

      <!-- 多选合并转发对话框 -->
      <ForwardDialog
        v-if="showMergedForward"
        :room-id="currentRoomId || undefined"
        :event-ids="[...selectedMessages]"
        @close="onMergedForwardClose"
      />
    </div>

    <!-- Side panels -->
    <aside
      data-testid="chat-side-panel-shell"
      class="h-full shrink-0 overflow-hidden border-l bg-sidebar transition-[width,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      :class="activeSidePanel ? 'w-[320px] border-border' : 'w-0 border-transparent'"
      :aria-hidden="!activeSidePanel"
    >
      <Transition
        mode="out-in"
        enter-active-class="transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        leave-active-class="transition-[opacity,transform] duration-150 ease-in motion-reduce:transition-none"
        enter-from-class="translate-x-3 opacity-0"
        leave-to-class="translate-x-3 opacity-0"
      >
        <div
          v-if="activeSidePanel"
          :key="activeSidePanel"
          data-testid="chat-side-panel-frame"
          class="h-full w-[320px] overflow-hidden"
        >
          <GlobalSearch v-if="activeSidePanel === 'search'" @close="closeSidePanel()" />
          <ThreadInboxPanel v-else-if="activeSidePanel === 'threads' && currentRoomId" :room-id="currentRoomId" />
          <PinnedMessages
            v-else-if="activeSidePanel === 'pinned' && currentRoomId"
            :room-id="currentRoomId"
            @close="closeSidePanel()"
            @jump-to="onPanelJumpTo"
          />
          <StarredMessages
            v-else-if="activeSidePanel === 'starred' && currentRoomId"
            :room-id="currentRoomId"
            @close="closeSidePanel()"
            @jump-to="onPanelJumpTo"
          />
          <MemberListPanel v-else-if="activeSidePanel === 'members'" />
          <ChatSettingsPanel v-else-if="activeSidePanel === 'settings'" />
          <KnowledgeCapturePanel v-else-if="activeSidePanel === 'knowledge'" />
          <TaskPanel v-else-if="activeSidePanel === 'tasks'" />
        </div>
      </Transition>
    </aside>

    <!-- Thread panel -->
    <aside
      data-testid="thread-panel-shell"
      class="h-full shrink-0 overflow-hidden border-l bg-sidebar transition-[width,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      :class="activeThreadId && currentRoomId ? 'w-[360px] border-border' : 'w-0 border-transparent'"
      :aria-hidden="!(activeThreadId && currentRoomId)"
    >
      <Transition
        mode="out-in"
        enter-active-class="transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        leave-active-class="transition-[opacity,transform] duration-150 ease-in motion-reduce:transition-none"
        enter-from-class="translate-x-3 opacity-0"
        leave-to-class="translate-x-3 opacity-0"
      >
        <div
          v-if="activeThreadId && currentRoomId"
          :key="activeThreadId"
          data-testid="thread-panel-frame"
          class="h-full w-[360px] overflow-hidden"
        >
          <ThreadPanel :room-id="currentRoomId" :thread-root-id="activeThreadId" />
        </div>
      </Transition>
    </aside>
  </div>
</template>
