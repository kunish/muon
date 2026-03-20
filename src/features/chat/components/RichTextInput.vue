<script setup lang="ts">
import type { MentionPopupState } from '../composables/useEditor'
import type { ImageSticker } from '@/shared/data/stickerPacks'
import type { GifResult } from '@/shared/lib/gifSearch'
import {
  editMessage,
  getClient,
  replyToMessage,
  sendContactCard,
  sendGifMessage,
  sendImageStickerMessage,
  sendLocationMessage,
  sendStickerMessage,
  sendTextMessage,
} from '@matrix/index'
import { EditorContent } from '@tiptap/vue-3'
import {
  ALargeSmall,
  AtSign,
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Quote,
  Smile,
  Strikethrough,
  X,
} from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useCurrentRoom } from '../composables/useCurrentRoom'
import { useEditor } from '../composables/useEditor'
import { getFloatingPosition } from '../composables/useFloatingPosition'
import { useMediaUpload } from '../composables/useMediaUpload'
import { useMention } from '../composables/useMention'
import { useTyping } from '../composables/useTyping'
import { useChatStore } from '../stores/chatStore'
import AttachmentMenu from './AttachmentMenu.vue'
import ContactCardPicker from './ContactCardPicker.vue'
import ExpressionPicker from './ExpressionPicker.vue'
import LocationPicker from './LocationPicker.vue'
import MentionList from './MentionList.vue'
import StickerPackManager from './StickerPackManager.vue'
import UploadProgress from './UploadProgress.vue'
// Voice components (VoiceRecorder, VoiceToTextButton) are available but disabled
// until voice UI is implemented. Their imports are kept commented for reference:
// import VoiceRecorder from './VoiceRecorder.vue'
// import VoiceToTextButton from './VoiceToTextButton.vue'

const store = useChatStore()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { startTyping, stopTyping } = useTyping()
const { room } = useCurrentRoom()
const {
  uploading,
  progress,
  uploadImage,
  uploadVideo,
  uploadFile,
} = useMediaUpload(() => store.currentRoomId)
const { filterMembers } = useMention()

// mention 弹窗状态
const mentionState = ref<MentionPopupState>({
  visible: false,
  items: [],
  selectedIndex: 0,
  clientRect: null,
  command: null,
})
const mentionListRef = ref<InstanceType<typeof MentionList>>()

// 计算 mention 弹窗位置
const mentionPopupStyle = computed(() => {
  const rect = mentionState.value.clientRect?.()
  if (!rect)
    return { display: 'none' }
  return {
    position: 'fixed' as const,
    left: `${rect.left}px`,
    top: `${rect.top - 8}px`,
    transform: 'translateY(-100%)',
    zIndex: '50',
  }
})

function onMentionSelect(item: { id: string, label: string }) {
  mentionState.value.command?.(item)
}

const placeholderText = computed(() => {
  const name = room.value?.name
  return name ? t('chat.input_placeholder_channel', { name }) : t('chat.input_placeholder')
})

const { editor, clear, insertEmoji } = useEditor({
  placeholder: placeholderText,
  onSubmit: handleSend,
  mentionSearch: (query: string) => filterMembers(query),
  onMentionState: (state: MentionPopupState) => {
    mentionState.value = state
  },
})

// 草稿缓存：roomId → HTML content
const drafts = new Map<string, string>()

type ExpressionTab = 'emoji' | 'gif' | 'sticker'

const showExpressionPicker = ref(false)
const expressionTab = ref<ExpressionTab>('emoji')
const expressionTriggerRef = ref<HTMLElement>()
const expressionPickerRef = ref<HTMLElement | null>(null)
const expressionPickerStyle = ref({ left: '0px', top: '0px' })
const activeExpressionAnchor = ref<HTMLElement | null>(null)
const prewarmExpressionPicker = ref(false)
let prewarmExpressionTimer = 0

function positionExpressionPicker() {
  const trigger = activeExpressionAnchor.value || expressionTriggerRef.value
  if (!trigger || !expressionPickerRef.value)
    return
  expressionPickerStyle.value = getFloatingPosition(trigger, expressionPickerRef.value)
}

async function openExpressionPicker(tab: ExpressionTab, anchor?: HTMLElement | null) {
  prewarmExpressionPicker.value = true

  if (showExpressionPicker.value && expressionTab.value === tab) {
    showExpressionPicker.value = false
    return
  }

  expressionTab.value = tab
  activeExpressionAnchor.value = anchor ?? expressionTriggerRef.value ?? null
  showExpressionPicker.value = true
  await nextTick()
  positionExpressionPicker()
}

function onExpressionButtonClick(e: MouseEvent) {
  void openExpressionPicker(expressionTab.value, e.currentTarget as HTMLElement)
}

function toggleGifPicker() {
  void openExpressionPicker('gif')
}

async function handleGifSelect(gif: GifResult) {
  showExpressionPicker.value = false
  const roomId = store.currentRoomId
  if (!roomId)
    return
  try {
    await sendGifMessage(roomId, gif.url, gif.width, gif.height)
  }
  catch {
    toast.error(t('auth.error'))
  }
}

function handleEmojiSelect(emoji: string) {
  showExpressionPicker.value = false
  insertEmoji(emoji)
}

const composeLabel = computed(() => {
  if (store.editingEvent)
    return t('chat.edit_label')
  return ''
})

const replyingToSenderName = computed(() => {
  const replyEvent = store.replyingTo
  if (!replyEvent)
    return ''
  const senderId = replyEvent.getSender() || ''
  const roomId = store.currentRoomId
  if (!roomId)
    return senderId
  const room = getClient().getRoom(roomId)
  const member = room?.getMember(senderId)
  return member?.name || senderId
})

const replyingToPreview = computed(() => {
  const replyEvent = store.replyingTo
  if (!replyEvent)
    return ''
  const content = replyEvent.getContent() || {}
  const eventType = replyEvent.getType()
  const messageType = content.msgtype as string | undefined

  if (eventType === 'm.sticker')
    return t('chat.sticker_btn')
  if (messageType === 'm.image')
    return t('chat.image')
  if (messageType === 'm.video')
    return t('chat.video')
  if (messageType === 'm.audio')
    return t('chat.voice_message')
  if (messageType === 'm.file')
    return t('chat.file')

  return content.body || t('chat.reply_label', { sender: replyingToSenderName.value })
})

async function jumpToReplyTarget() {
  const eventId = store.replyingTo?.getId()
  if (!eventId)
    return
  await router.replace({
    query: {
      ...route.query,
      focusEventId: eventId,
    },
  })
}

const editorExpanded = ref(false)

async function handleSend(html: string, text: string) {
  const roomId = store.currentRoomId
  if (!roomId || !text.trim())
    return
  clear()
  drafts.delete(roomId)
  stopTyping()

  try {
    if (store.editingEvent) {
      const eventId = store.editingEvent.getId()
      store.clearCompose()
      if (eventId)
        await editMessage(roomId, eventId, text)
    }
    else if (store.replyingTo) {
      const eventId = store.replyingTo.getId()
      store.clearCompose()
      if (eventId)
        await replyToMessage(roomId, eventId, text)
    }
    else {
      await sendTextMessage(roomId, text, html)
    }
  }
  catch {
    toast.error(t('auth.error'))
  }
}

function toggleStickerPicker() {
  void openExpressionPicker('sticker')
}

async function handleStickerSelect(emoji: string, name: string) {
  showExpressionPicker.value = false
  const roomId = store.currentRoomId
  if (!roomId)
    return
  try {
    await sendStickerMessage(roomId, emoji, name)
  }
  catch {
    toast.error(t('auth.error'))
  }
}

async function handleImageStickerSelect(sticker: ImageSticker) {
  showExpressionPicker.value = false
  const roomId = store.currentRoomId
  if (!roomId)
    return
  try {
    await sendImageStickerMessage(roomId, sticker.name, sticker.mxcUrl, {
      w: sticker.width,
      h: sticker.height,
      mimetype: sticker.mimetype,
      size: sticker.size,
    })
  }
  catch {
    toast.error(t('auth.error'))
  }
}

const showStickerManager = ref(false)

function openStickerManager() {
  showExpressionPicker.value = false
  showStickerManager.value = true
}

const showLocationPicker = ref(false)
const showContactCardPicker = ref(false)

function toggleLocationPicker() {
  showLocationPicker.value = !showLocationPicker.value
}

function toggleContactCardPicker() {
  showContactCardPicker.value = !showContactCardPicker.value
}

async function handleContactCardSelect(contact: {
  userId: string
  displayName: string
  avatarUrl?: string
}) {
  showContactCardPicker.value = false
  const roomId = store.currentRoomId
  if (!roomId)
    return
  try {
    await sendContactCard(
      roomId,
      contact.userId,
      contact.displayName,
      contact.avatarUrl,
    )
  }
  catch {
    toast.error(t('auth.error'))
  }
}

async function handleLocationSelect(payload: {
  latitude: number
  longitude: number
  description: string
}) {
  showLocationPicker.value = false
  const roomId = store.currentRoomId
  if (!roomId)
    return
  try {
    await sendLocationMessage(
      roomId,
      payload.latitude,
      payload.longitude,
      payload.description || undefined,
    )
  }
  catch {
    toast.error(t('auth.error'))
  }
}

function onInput() {
  startTyping()
}

const showFormatBar = ref(false)

function toggleFormatBar() {
  showFormatBar.value = !showFormatBar.value
}

function insertMention() {
  editor.value?.chain().focus().insertContent('@').run()
}

watch(
  () => store.currentRoomId,
  (newId, oldId) => {
    // 保存当前房间草稿
    if (oldId && editor.value) {
      const text = editor.value.getText().trim()
      if (text) {
        drafts.set(oldId, editor.value.getHTML())
      }
      else {
        drafts.delete(oldId)
      }
    }

    // 恢复目标房间草稿或清空
    const saved = newId ? drafts.get(newId) : undefined
    if (saved) {
      editor.value?.commands.setContent(saved)
    }
    else {
      clear()
    }

    store.clearCompose()
    showExpressionPicker.value = false
    showLocationPicker.value = false
    showContactCardPicker.value = false
  },
)

watch(
  () => store.editingEvent,
  (ev) => {
    if (ev) {
      const body = ev.getContent()?.body || ''
      editor.value?.commands.setContent(body)
      editor.value?.commands.focus('end')
    }
  },
)

function onWindowResize() {
  if (showExpressionPicker.value) {
    positionExpressionPicker()
  }
}

onMounted(() => {
  prewarmExpressionTimer = window.setTimeout(() => {
    prewarmExpressionPicker.value = true
  }, 220)
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  clearTimeout(prewarmExpressionTimer)
  window.removeEventListener('resize', onWindowResize)
})
</script>

<template>
  <div class="px-4 pb-4">
    <UploadProgress :progress="progress" :visible="uploading" />
    <!-- 回复/编辑 指示栏 -->
    <div v-if="store.replyingTo || composeLabel" class="pt-2">
      <div
        v-if="store.replyingTo"
        class="flex items-start justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2"
      >
        <button class="min-w-0 text-left" @click="jumpToReplyTarget">
          <div class="text-xs font-medium text-primary">
            {{ t('chat.reply_label', { sender: replyingToSenderName }) }}
          </div>
          <div class="truncate text-xs text-muted-foreground">
            {{ replyingToPreview }}
          </div>
        </button>
        <button
          class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent"
          @click="
            store.clearCompose();
            clear();
          "
        >
          <X :size="14" />
        </button>
      </div>
      <div
        v-else-if="composeLabel"
        class="flex items-center justify-between text-xs text-muted-foreground"
      >
        <span>{{ composeLabel }}</span>
        <button
          class="p-0.5 rounded hover:bg-accent"
          @click="
            store.clearCompose();
            clear();
          "
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- 主输入容器 -->
    <div class="flex items-end gap-0 rounded-lg bg-input" @input="onInput">
      <!-- 左侧: + 附件按钮 -->
      <div class="flex items-center shrink-0 pl-1 pb-1.5">
        <AttachmentMenu
          @image="uploadImage"
          @video="uploadVideo"
          @file="uploadFile"
          @sticker="toggleStickerPicker"
          @location="toggleLocationPicker"
          @gif="toggleGifPicker"
          @contact-card="toggleContactCardPicker"
        />
      </div>

      <!-- 中间: 编辑区 (flex-1) -->
      <div class="flex-1 min-w-0">
        <!-- 可折叠格式工具栏 — 聚焦 / 点击 Aa 时显示在输入区上方 -->
        <Transition
          enter-active-class="overflow-hidden transition-all duration-200 ease-out"
          leave-active-class="overflow-hidden transition-all duration-200 ease-out"
          enter-from-class="max-h-0 opacity-0"
          enter-to-class="max-h-10 opacity-100"
          leave-from-class="max-h-10 opacity-100"
          leave-to-class="max-h-0 opacity-0"
        >
          <div
            v-if="editor && showFormatBar"
            class="flex items-center gap-0.5 border-b border-border/30 px-2 pb-1 pt-1.5"
          >
            <button
              class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
              :class="editor.isActive('bold') && 'bg-primary text-primary-foreground hover:opacity-90'"
              :title="t('chat.format_bold')"
              @click="editor.chain().focus().toggleBold().run()"
            >
              <Bold :size="14" />
            </button>
            <button
              class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
              :class="editor.isActive('italic') && 'bg-primary text-primary-foreground hover:opacity-90'"
              :title="t('chat.format_italic')"
              @click="editor.chain().focus().toggleItalic().run()"
            >
              <Italic :size="14" />
            </button>
            <button
              class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
              :class="editor.isActive('strike') && 'bg-primary text-primary-foreground hover:opacity-90'"
              :title="t('chat.format_strike')"
              @click="editor.chain().focus().toggleStrike().run()"
            >
              <Strikethrough :size="14" />
            </button>
            <button
              class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
              :class="editor.isActive('code') && 'bg-primary text-primary-foreground hover:opacity-90'"
              :title="t('chat.format_code')"
              @click="editor.chain().focus().toggleCode().run()"
            >
              <Code :size="14" />
            </button>
            <div class="w-px h-4 bg-border/60 mx-0.5" />
            <button
              class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
              :class="editor.isActive('bulletList') && 'bg-primary text-primary-foreground hover:opacity-90'"
              :title="t('chat.format_ul')"
              @click="editor.chain().focus().toggleBulletList().run()"
            >
              <List :size="14" />
            </button>
            <button
              class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
              :class="editor.isActive('orderedList') && 'bg-primary text-primary-foreground hover:opacity-90'"
              :title="t('chat.format_ol')"
              @click="editor.chain().focus().toggleOrderedList().run()"
            >
              <ListOrdered :size="14" />
            </button>
            <button
              class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
              :class="editor.isActive('blockquote') && 'bg-primary text-primary-foreground hover:opacity-90'"
              :title="t('chat.format_quote')"
              @click="editor.chain().focus().toggleBlockquote().run()"
            >
              <Quote :size="14" />
            </button>
          </div>
        </Transition>

        <EditorContent
          v-if="editor"
          :editor="editor"
          class="rich-editor min-h-[40px] overflow-y-auto px-2 py-2 text-sm outline-none transition-[max-height] duration-200 [&_.mention]:font-medium [&_.mention]:text-primary [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child]:before:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child]:before:float-left [&_.tiptap_p.is-editor-empty:first-child]:before:h-0 [&_.tiptap_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]"
          :class="editorExpanded ? 'max-h-[400px]' : 'max-h-[150px]'"
        />
      </div>

      <!-- 右侧: GIF / Sticker / Emoji — 简洁布局 -->
      <div ref="expressionTriggerRef" class="flex items-center shrink-0 gap-0 pr-1 pb-1.5">
        <!-- @ 提及 -->
        <button
          class="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          :title="t('chat.mention_btn')"
          @click="insertMention"
        >
          <AtSign :size="16" />
        </button>
        <!-- Aa 格式切换 — 仅当有内容或格式栏已展开时显示 -->
        <button
          v-if="showFormatBar || editor?.getText().trim()"
          class="p-1.5 rounded-md transition-colors"
          :class="
            showFormatBar
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent'
          "
          :title="t('chat.format_menu')"
          @click="toggleFormatBar"
        >
          <ALargeSmall :size="16" />
        </button>
        <!-- GIF / Sticker / Emoji 整合入口 -->
        <button
          class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent"
          :title="`${t('chat.gif')} / ${t('chat.sticker_btn')} / Emoji`"
          @click="onExpressionButtonClick"
        >
          <Smile :size="16" />
          <span class="text-[11px] font-semibold leading-none">GIF</span>
        </button>
        <!-- 展开/收起编辑器 -->
        <button
          class="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          :title="
            editorExpanded
              ? t('chat.collapse_editor')
              : t('chat.expand_editor')
          "
          @click="editorExpanded = !editorExpanded"
        >
          <Minimize2 v-if="editorExpanded" :size="16" />
          <Maximize2 v-else :size="16" />
        </button>
      </div>
      <!-- TODO: Voice features (VoiceRecorder, VoiceToTextButton) disabled until voice UI is implemented -->
    </div>

    <!-- Mention 弹窗 -->
    <Teleport to="body">
      <div
        v-if="mentionState.visible && mentionState.items.length > 0"
        :style="mentionPopupStyle"
      >
        <MentionList
          ref="mentionListRef"
          :items="mentionState.items"
          :selected-index="mentionState.selectedIndex"
          @select="onMentionSelect"
        />
      </div>
    </Teleport>
    <!-- 表情统一面板（GIF / Sticker / Emoji） -->
    <Teleport to="body">
      <div
        v-if="showExpressionPicker || prewarmExpressionPicker"
        ref="expressionPickerRef"
        class="fixed"
        :class="showExpressionPicker ? 'z-50' : 'pointer-events-none opacity-0 z-[-1]'"
        :style="showExpressionPicker
          ? { left: expressionPickerStyle.left, top: expressionPickerStyle.top }
          : { left: '-99999px', top: '-99999px' }"
      >
        <ExpressionPicker
          :initial-tab="expressionTab"
          @select-emoji="handleEmojiSelect"
          @select-gif="handleGifSelect"
          @select-sticker="handleStickerSelect"
          @select-image-sticker="handleImageStickerSelect"
          @manage-sticker="openStickerManager"
          @tab-change="expressionTab = $event"
        />
      </div>
      <div
        v-if="showExpressionPicker"
        class="fixed inset-0 z-40"
        @click="showExpressionPicker = false"
      />
    </Teleport>
    <!-- 贴纸包管理器 -->
    <StickerPackManager
      v-if="showStickerManager"
      @close="showStickerManager = false"
    />
    <!-- 位置选择面板 -->
    <Teleport to="body">
      <div
        v-if="showLocationPicker"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
        @click.self="showLocationPicker = false"
      >
        <LocationPicker
          @select="handleLocationSelect"
          @close="showLocationPicker = false"
        />
      </div>
    </Teleport>
    <!-- 名片选择面板 -->
    <ContactCardPicker
      v-if="showContactCardPicker"
      @select="handleContactCardSelect"
      @close="showContactCardPicker = false"
    />
  </div>
</template>
