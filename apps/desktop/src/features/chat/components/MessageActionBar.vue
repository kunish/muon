<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk';
import type { TaskStatus } from '../types/task';
/**
 * 消息悬浮操作栏
 * 显示在消息右上角，包含飞书风格的高频动作：
 * 快捷表情回复、回复、转发，以及"更多"下拉菜单（编辑/Pin/收藏/翻译/转任务/多选/隐藏/撤回等）。
 * 所有与 matrix/store 交互的动作复用 useMessageActions（单一来源）。
 */
import { getClient } from '@matrix/client';
import {
  CheckSquare,
  Copy,
  Edit,
  EyeOff,
  Forward,
  Languages,
  Link,
  MessageSquareText,
  MoreHorizontal,
  Pin,
  PinOff,
  Reply,
  Star,
  StarOff,
  Trash2,
} from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { getFloatingPosition } from '../composables/useFloatingPosition';
import { useMessageActions } from '../composables/useMessageActions';
import { useDeferStore } from '../stores/deferStore';
import { useTaskStore } from '../stores/taskStore';
import ForwardDialog from './ForwardDialog.vue';
import ReactionPickerPopover from './ReactionPickerPopover.vue';
import TaskComposerDialog from './TaskComposerDialog.vue';

const props = defineProps<{
  event: MatrixEvent;
  roomId: string;
  /** 是否可翻译（仅文本消息），由父组件判断 */
  canTranslate?: boolean;
  /** 当前是否已显示翻译结果，用于切换菜单文案 */
  isTranslated?: boolean;
}>();

const emit = defineEmits<{
  translate: [];
  menuOpenChange: [open: boolean];
}>();

const deferStore = useDeferStore();
const taskStore = useTaskStore();
const { t } = useI18n();
const actions = useMessageActions(
  () => props.event,
  () => props.roomId,
);
const { isPinned, isStarred } = actions;
const showMore = ref(false);
const showDeferMenu = ref(false);
const showReactPicker = ref(false);
const showForward = ref(false);
const customDeferValue = ref('');
const showTaskComposer = ref(false);
const creatingTask = ref(false);
const barRootRef = ref<HTMLElement>();
const moreTriggerRef = ref<HTMLElement>();
const moreMenuRef = ref<HTMLElement>();
const moreMenuStyle = ref({ left: '0px', top: '0px' });
const moreMenuPositioned = ref(false);

const myUserId = computed(() => getClient().getUserId());
const isMine = computed(() => props.event.getSender() === myUserId.value);
const eventId = computed(() => props.event.getId() || '');
const body = computed(() => props.event.getContent()?.body || '');

function updateMoreMenuPosition() {
  const trigger = moreTriggerRef.value;
  const menu = moreMenuRef.value;
  if (!trigger || !menu) return;
  moreMenuStyle.value = getFloatingPosition(trigger, menu, { margin: 12, offset: 6 });
}

function closeMoreMenu() {
  showMore.value = false;
  showDeferMenu.value = false;
}

function onMoreMenuAfterLeave() {
  if (!showMore.value) moreMenuPositioned.value = false;
}

function toggleMore() {
  if (showMore.value) {
    closeMoreMenu();
    return;
  }
  showReactPicker.value = false;
  moreMenuPositioned.value = false;
  showMore.value = true;
}

function toggleReactPicker() {
  if (!showReactPicker.value) closeMoreMenu();
  showReactPicker.value = !showReactPicker.value;
}

function onReact(emoji: string) {
  showReactPicker.value = false;
  void actions.react(emoji);
}

function onReply() {
  actions.reply();
}

function onForward() {
  closeMoreMenu();
  showForward.value = true;
}

function onEdit() {
  actions.edit();
  showMore.value = false;
}

function onRecall() {
  showMore.value = false;
  void actions.recall();
}

function onTogglePin() {
  showMore.value = false;
  void actions.togglePin();
}

function onToggleStar() {
  showMore.value = false;
  void actions.toggleStar();
}

function onMultiSelect() {
  closeMoreMenu();
  actions.multiSelect();
}

function onHideForMe() {
  closeMoreMenu();
  actions.hideForMe();
}

function onTranslate() {
  closeMoreMenu();
  emit('translate');
}

function onCopyText() {
  showMore.value = false;
  actions.copyText();
}

function onCopyLink() {
  showMore.value = false;
  void actions.copyLink();
}

function onOpenThread() {
  actions.openThread();
  showMore.value = false;
}

function onToggleDeferMenu() {
  showDeferMenu.value = !showDeferMenu.value;
}

function createDeferredFromMessage(preset: 'in-1-hour' | 'tonight' | 'tomorrow-morning' | 'tomorrow', suffix: string) {
  if (!eventId.value || !props.roomId) return;
  deferStore.createDeferredItem({
    id: `message:${props.roomId}:${eventId.value}:${suffix}`,
    roomId: props.roomId,
    eventId: eventId.value,
    reminder: { preset },
  });
  showDeferMenu.value = false;
  showMore.value = false;
}

function submitCustomDeferredFromMessage() {
  if (!eventId.value || !props.roomId) return;

  const dueAt = Date.parse(customDeferValue.value);
  if (!Number.isFinite(dueAt)) return;

  deferStore.createDeferredItem({
    id: `message:${props.roomId}:${eventId.value}:custom`,
    roomId: props.roomId,
    eventId: eventId.value,
    reminder: {
      preset: 'custom',
      dueAt,
    },
  });
  showDeferMenu.value = false;
  showMore.value = false;
  customDeferValue.value = '';
}

function onOpenTaskComposer() {
  showTaskComposer.value = true;
  showMore.value = false;
  showDeferMenu.value = false;
}

function onCloseTaskComposer() {
  if (creatingTask.value) return;
  showTaskComposer.value = false;
}

async function onSubmitTask(payload: { title: string; assignee: string; dueAt: string; status: TaskStatus }) {
  if (creatingTask.value || !props.roomId || !eventId.value) return;

  creatingTask.value = true;
  try {
    await Promise.resolve(
      taskStore.createTask({
        title: payload.title,
        assignee: payload.assignee,
        dueAt: payload.dueAt,
        status: payload.status,
        sourceRef: {
          roomId: props.roomId,
          eventId: eventId.value,
        },
      }),
    );
    showTaskComposer.value = false;
  } catch {
    toast.error(t('chat.task_create_failed'));
  } finally {
    creatingTask.value = false;
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!target) return;
  if (showMore.value && !(moreTriggerRef.value?.contains(target) || moreMenuRef.value?.contains(target))) {
    closeMoreMenu();
  }
  if (showReactPicker.value && !barRootRef.value?.contains(target)) {
    showReactPicker.value = false;
  }
}

function onViewportChange() {
  if (showMore.value) updateMoreMenuPosition();
}

watch(showMore, async (open) => {
  if (!open) return;
  await nextTick();
  updateMoreMenuPosition();
  moreMenuPositioned.value = true;
});

watch([showMore, showReactPicker, showForward], () => {
  emit('menuOpenChange', showMore.value || showReactPicker.value || showForward.value);
});

watch(showDeferMenu, async () => {
  if (!showMore.value) return;
  await nextTick();
  updateMoreMenuPosition();
});

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('resize', onViewportChange);
  document.addEventListener('scroll', onViewportChange, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  window.removeEventListener('resize', onViewportChange);
  document.removeEventListener('scroll', onViewportChange, true);
  emit('menuOpenChange', false);
});
</script>

<template>
  <div
    ref="barRootRef"
    class="action-bar flex items-center overflow-visible rounded-[10px] border border-[rgba(31,35,41,0.08)] bg-popover shadow-[var(--shadow-s1-down)]"
  >
    <!-- Add Reaction (快捷表情回复) -->
    <ReactionPickerPopover :show-emoji-picker="showReactPicker" @toggle="toggleReactPicker" @react="onReact" />

    <!-- Reply -->
    <button
      class="flex size-7 cursor-pointer items-center justify-center text-muted-foreground transition-all duration-100 hover:bg-muted hover:text-foreground"
      :title="t('common.reply')"
      @click.stop="onReply"
    >
      <Reply :size="16" />
    </button>

    <!-- Forward (转发) -->
    <button
      class="flex size-7 cursor-pointer items-center justify-center text-muted-foreground transition-all duration-100 hover:bg-muted hover:text-foreground"
      :title="t('chat.action_forward')"
      data-testid="message-forward-trigger"
      @click.stop="onForward"
    >
      <Forward :size="16" />
    </button>

    <!-- More -->
    <div>
      <button
        ref="moreTriggerRef"
        class="flex size-7 cursor-pointer items-center justify-center text-muted-foreground transition-all duration-100 hover:bg-muted hover:text-foreground"
        :title="t('chat.more_actions')"
        data-testid="message-more-trigger"
        @click.stop="toggleMore"
      >
        <MoreHorizontal :size="16" />
      </button>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-[opacity,transform] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        leave-active-class="transition-opacity duration-75 ease-in"
        enter-from-class="opacity-0 -translate-y-1 scale-[0.96]"
        leave-to-class="opacity-0"
        @after-leave="onMoreMenuAfterLeave"
      >
        <div
          v-if="showMore"
          ref="moreMenuRef"
          class="fixed z-[200] max-h-[min(420px,calc(100vh-24px))] min-w-[160px] overflow-y-auto rounded-md border border-[var(--color-muted)]/30 bg-card py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          :class="moreMenuPositioned ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'"
          :style="{ left: moreMenuStyle.left, top: moreMenuStyle.top }"
          data-testid="message-more-menu"
          @click.stop
        >
          <!-- Edit (own msg) -->
          <button
            v-if="isMine"
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            @click.stop="onEdit"
          >
            <Edit :size="14" />
            <span>{{ t('chat.edit_message') }}</span>
          </button>

          <!-- Pin / Unpin -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            @click.stop="onTogglePin"
          >
            <component :is="isPinned ? PinOff : Pin" :size="14" />
            <span>{{ isPinned ? t('chat.unpin_message') : t('chat.pin_message') }}</span>
          </button>

          <!-- Star / Unstar (收藏) -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            data-testid="message-star-trigger"
            @click.stop="onToggleStar"
          >
            <component :is="isStarred ? StarOff : Star" :size="14" />
            <span>{{ isStarred ? t('chat.unstar_message') : t('chat.star_message') }}</span>
          </button>

          <!-- Translate (翻译) — 仅文本消息 -->
          <button
            v-if="canTranslate"
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            data-testid="message-translate-trigger"
            @click.stop="onTranslate"
          >
            <Languages :size="14" />
            <span>{{ isTranslated ? t('chat.hide_translation') : t('chat.translate') }}</span>
          </button>

          <!-- Open Thread -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            @click.stop="onOpenThread"
          >
            <MessageSquareText :size="14" />
            <span>{{ t('chat.thread') }}</span>
          </button>

          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            :aria-expanded="showDeferMenu"
            aria-haspopup="menu"
            data-testid="message-defer-trigger"
            @click.stop="onToggleDeferMenu"
          >
            <span>{{ t('chat.defer') }}</span>
          </button>

          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            data-testid="message-convert-task-trigger"
            @click.stop="onOpenTaskComposer"
          >
            <span>{{ t('chat.convert_to_task') }}</span>
          </button>

          <Transition
            enter-active-class="transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
            leave-active-class="transition-[opacity,transform] duration-100 ease-in"
            enter-from-class="opacity-0 translate-x-1.5 -translate-y-1 scale-[0.98]"
            leave-to-class="opacity-0 translate-x-1 -translate-y-0.5 scale-[0.98]"
          >
            <div
              v-if="showDeferMenu"
              class="mx-2 my-1 origin-top-right transform-gpu will-change-transform rounded-md border border-[var(--color-muted)]/20 p-2"
              role="menu"
              data-testid="message-defer-submenu"
            >
              <div class="space-y-1">
                <button
                  class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
                  data-testid="message-defer-preset-1h"
                  @click.stop="createDeferredFromMessage('in-1-hour', '1h')"
                >
                  <span>{{ t('chat.defer_preset_1h') }}</span>
                </button>
                <button
                  class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
                  data-testid="message-defer-preset-tonight"
                  @click.stop="createDeferredFromMessage('tonight', 'tonight')"
                >
                  <span>{{ t('chat.defer_preset_tonight') }}</span>
                </button>
                <button
                  class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
                  data-testid="message-defer-preset-tomorrow-morning"
                  @click.stop="createDeferredFromMessage('tomorrow-morning', 'tomorrow-morning')"
                >
                  <span>{{ t('chat.defer_preset_tomorrow_morning') }}</span>
                </button>
                <button
                  class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
                  data-testid="message-defer-preset-tomorrow"
                  @click.stop="createDeferredFromMessage('tomorrow', 'tomorrow')"
                >
                  <span>{{ t('chat.defer_preset_tomorrow') }}</span>
                </button>
              </div>

              <button
                class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
                data-testid="message-defer-custom-toggle"
                @click.stop
              >
                <span>{{ t('chat.defer_custom') }}</span>
              </button>
              <input
                v-model="customDeferValue"
                type="datetime-local"
                class="mt-1 w-full rounded border border-[var(--color-muted)]/40 bg-background px-2 py-1 text-xs"
                data-testid="message-defer-custom-input"
              />
              <button
                class="mt-1 w-full rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                :disabled="!customDeferValue"
                data-testid="message-defer-custom-submit"
                @click.stop="submitCustomDeferredFromMessage"
              >
                {{ t('common.confirm') }}
              </button>
            </div>
          </Transition>

          <!-- Copy Text -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            @click.stop="onCopyText"
          >
            <Copy :size="14" />
            <span>{{ t('chat.copy_text') }}</span>
          </button>

          <!-- Copy Link -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            @click.stop="onCopyLink"
          >
            <Link :size="14" />
            <span>{{ t('chat.copy_message_link') }}</span>
          </button>

          <!-- Multi-select (多选 / 合并转发) -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            data-testid="message-multiselect-trigger"
            @click.stop="onMultiSelect"
          >
            <CheckSquare :size="14" />
            <span>{{ t('chat.multi_select') }}</span>
          </button>

          <!-- Hide for me (仅对自己隐藏) -->
          <button
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-100 hover:bg-primary hover:text-white"
            data-testid="message-hide-trigger"
            @click.stop="onHideForMe"
          >
            <EyeOff :size="14" />
            <span>{{ t('chat.hide_for_me') }}</span>
          </button>

          <!-- Separator -->
          <div v-if="isMine" class="my-1 h-px bg-[var(--color-muted)]/20" />

          <!-- Recall (own message) -->
          <button
            v-if="isMine"
            class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] text-destructive transition-colors duration-100 hover:bg-destructive hover:text-white"
            data-testid="message-recall-trigger"
            @click.stop="onRecall"
          >
            <Trash2 :size="14" />
            <span>{{ t('chat.recall') }}</span>
          </button>
        </div>
      </Transition>
    </Teleport>

    <TaskComposerDialog
      :open="showTaskComposer"
      :initial-title="body"
      :submitting="creatingTask"
      @close="onCloseTaskComposer"
      @submit="onSubmitTask"
    />

    <!-- 转发对话框 -->
    <ForwardDialog v-if="showForward" :event="event" @close="showForward = false" />
  </div>
</template>
