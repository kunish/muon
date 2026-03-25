<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'
import {
  getReactions,
  getReadUsers,
  getThreadReplies,
  isUserBlocked,
  redactMessage,
  sendReaction,
} from '@matrix/index'
import {
  isMessagePinned,
  isMessageStarred,
  pinMessage,
  starMessage,
  unpinMessage,
  unstarMessage,
} from '@matrix/rooms'
import { ask } from '@tauri-apps/plugin-dialog'
import {
  CheckSquare,
  Copy,
  Edit,
  EyeOff,
  Forward,
  Languages,
  MessageSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  RefreshCw,
  Reply,
  SmilePlus,
  Star,
  StarOff,
  Trash2,
} from 'lucide-vue-next'
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { useAuthMedia } from '@/shared/composables/useAuthMedia'
import { isFullEmojiText } from '@/shared/lib/emoji'
import { sanitizeMatrixHtml } from '@/shared/lib/htmlSanitizer'
import { getSystemLanguage, translateText } from '@/shared/lib/translate'
import { useChatStore } from '../stores/chatStore'
import AnimatedEmoji from './AnimatedEmoji.vue'
import ForwardDialog from './ForwardDialog.vue'
import LinkPreview from './LinkPreview.vue'
import AudioMessage from './messages/AudioMessage.vue'
import ContactCardMessage from './messages/ContactCardMessage.vue'
import FileMessage from './messages/FileMessage.vue'
import ImageMessage from './messages/ImageMessage.vue'
import LocationMessage from './messages/LocationMessage.vue'
import VideoMessage from './messages/VideoMessage.vue'

const props = defineProps<{
  event: MatrixEvent
  isMine: boolean
  showSender: boolean
  /** Position within a Telegram-style message group */
  groupPosition: 'alone' | 'first' | 'middle' | 'last'
}>()

const emit = defineEmits<{
  avatarClick: [userId: string, event: MouseEvent]
}>()

const MATRIX_TO_RE = /^https:\/\/matrix\.to\/#\/([@!#][^?]*)/

const store = useChatStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()
const triggerEmojiEffect
  = inject<(emoji: string, rect: DOMRect) => void>('triggerEmojiEffect')
const showMore = ref(false)
const showForward = ref(false)
const translatedText = ref<string | null>(null)
const translating = ref(false)

const eventId = computed(() => props.event.getId() || '')
const isSelected = computed(() => store.isMessageSelected(eventId.value))
const msgtype = computed(() => props.event.getContent()?.msgtype)
const body = computed(() => props.event.getContent()?.body || '')

function onMultiSelect() {
  showMore.value = false
  store.enterMultiSelect()
  if (eventId.value)
    store.toggleMessageSelection(eventId.value)
}

function onRowClick() {
  if (!store.multiSelectMode)
    return
  if (eventId.value)
    store.toggleMessageSelection(eventId.value)
}

const isTextMessage = computed(
  () => msgtype.value === 'm.text' || msgtype.value === 'm.notice',
)

async function onTranslate() {
  showMore.value = false
  if (translatedText.value) {
    translatedText.value = null
    return
  }
  translating.value = true
  try {
    const targetLang = getSystemLanguage()
    translatedText.value = await translateText(body.value, targetLang)
  }
  catch {
    toast.error(t('auth.error'))
  }
  finally {
    translating.value = false
  }
}

const isRightAligned = computed(
  () => settingsStore.messageAlignment === 'leftright' && props.isMine,
)

// Telegram-style grouped bubble border-radius
// 'alone' = normal rounded, 'first' = rounded top / small bottom,
// 'middle' = small all corners, 'last' = small top / rounded bottom
const bubbleRadiusClass = computed(() => {
  if (isRightAligned.value) {
    // Right-aligned (mine): avatar side is right, tail side is right
    switch (props.groupPosition) {
      case 'first':
        return 'rounded-lg rounded-br-sm'
      case 'middle':
        return 'rounded-lg rounded-r-sm'
      case 'last':
        return 'rounded-lg rounded-tr-sm'
      default:
        return 'rounded-lg'
    }
  }
  else {
    // Left-aligned: avatar side is left, tail side is left
    switch (props.groupPosition) {
      case 'first':
        return 'rounded-lg rounded-bl-sm'
      case 'middle':
        return 'rounded-lg rounded-l-sm'
      case 'last':
        return 'rounded-lg rounded-tl-sm'
      default:
        return 'rounded-lg'
    }
  }
})

const isRedacted = computed(() => props.event.isRedacted())

// --- 名片消息检测 ---
const isContactCard = computed(() => msgtype.value === 'im.muon.contact_card')
const contactCardData = computed(() => {
  if (!isContactCard.value)
    return null
  return props.event.getContent()?.['im.muon.contact_card'] || null
})

// --- 贴纸消息检测 ---
const isSticker = computed(() => props.event.getType() === 'm.sticker')
const stickerEmoji = computed(() => {
  if (!isSticker.value)
    return ''
  return (
    props.event.getContent()?.info?.['xyz.muon.emoji']
    || props.event.getContent()?.body
    || ''
  )
})
const isImageSticker = computed(() => {
  if (!isSticker.value)
    return false
  const content = props.event.getContent()
  const url = content?.url || ''
  const mimetype = content?.info?.mimetype || ''
  return url.startsWith('mxc://') && mimetype.startsWith('image/')
})
const imageStickerMxcUrl = computed(() => {
  if (!isImageSticker.value)
    return undefined
  return props.event.getContent()?.url as string | undefined
})
const imageStickerSrc = useAuthMedia(imageStickerMxcUrl, 200, 200)

// --- 发送状态检测 ---
const sendStatus = computed(() => props.event.status) // null=已发送, 'sending', 'not_sent', 'encrypting'
const isFailed = computed(() => sendStatus.value === 'not_sent')
const isSending = computed(
  () => sendStatus.value === 'sending' || sendStatus.value === 'encrypting',
)

async function resendMessage() {
  try {
    const client = getClient()
    await client.resendEvent(
      props.event,
      client.getRoom(props.event.getRoomId()!)!,
    )
  }
  catch {
    toast.error(t('chat.send_failed'))
  }
}

const replyEvent = computed(() => {
  const inReplyTo
    = props.event.getContent()?.['m.relates_to']?.['m.in_reply_to']?.event_id
  if (!inReplyTo)
    return null
  const client = getClient()
  const room = client.getRoom(props.event.getRoomId()!)
  return room?.findEventById(inReplyTo) || null
})

const replyBody = computed(() => replyEvent.value?.getContent()?.body || '')

const formattedBody = computed(() => {
  const content = props.event.getContent()
  if (content?.format === 'org.matrix.custom.html' && content?.formatted_body)
    return content.formatted_body
  return ''
})

const sanitizedHtml = computed(() => {
  if (!formattedBody.value)
    return ''
  return sanitizeMatrixHtml(formattedBody.value)
})

const isFullEmoji = computed(() => {
  if (msgtype.value !== 'm.text' || !body.value)
    return false
  return isFullEmojiText(body.value)
})

const sender = computed(() => props.event.getSender() || '')

// 检查发送者是否被屏蔽 — 使用 computed 缓存避免每次渲染都调用
const isSenderBlocked = computed(() => {
  const s = sender.value
  if (!s)
    return false
  return isUserBlocked(s)
})

function copyText() {
  navigator.clipboard.writeText(body.value)
}

/** 拦截 rich-content 中的 matrix.to mention 链接点击，打开用户卡片 */
function onRichContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const anchor = target.closest('a[href]') as HTMLAnchorElement | null
  if (!anchor)
    return
  const href = anchor.getAttribute('href') || ''
  // 匹配 https://matrix.to/#/@user:server 格式
  const match = href.match(MATRIX_TO_RE)
  if (match) {
    e.preventDefault()
    e.stopPropagation()
    const userId = decodeURIComponent(match[1])
    // 以 @ 开头的是用户 mention，打开用户卡片
    if (userId.startsWith('@')) {
      emit('avatarClick', userId, e)
    }
  }
}
function onReply() {
  store.setReplyingTo(props.event)
}
function onEdit() {
  store.setEditingEvent(props.event)
}
async function onRedact() {
  const confirmed = await ask(t('chat.recall_confirm'), {
    title: t('chat.recall_title'),
    kind: 'warning',
  })
  if (!confirmed)
    return
  const roomId = props.event.getRoomId()
  const eventId = props.event.getId()
  if (!roomId || !eventId)
    return
  try {
    await redactMessage(roomId, eventId)
  }
  catch {
    toast.error(t('auth.error'))
  }
}
function toggleMore() {
  showMore.value = !showMore.value
}
function onForward() {
  showMore.value = false
  showForward.value = true
}

function onHideForMe() {
  const eventId = props.event.getId()
  if (eventId) {
    store.hideMessage(eventId)
  }
  showMore.value = false
}

// --- Pin / Star ---
const isPinned = computed(() => {
  const roomId = props.event.getRoomId()
  const evId = props.event.getId()
  if (!roomId || !evId)
    return false
  return isMessagePinned(roomId, evId)
})

const isStarred = computed(() => {
  const roomId = props.event.getRoomId()
  const evId = props.event.getId()
  if (!roomId || !evId)
    return false
  return isMessageStarred(roomId, evId)
})

async function onTogglePin() {
  showMore.value = false
  const roomId = props.event.getRoomId()
  const evId = props.event.getId()
  if (!roomId || !evId)
    return
  try {
    if (isPinned.value) {
      await unpinMessage(roomId, evId)
    }
    else {
      await pinMessage(roomId, evId)
    }
  }
  catch {
    toast.error(t('auth.error'))
  }
}

async function onToggleStar() {
  showMore.value = false
  const roomId = props.event.getRoomId()
  const evId = props.event.getId()
  if (!roomId || !evId)
    return
  try {
    if (isStarred.value) {
      await unstarMessage(roomId, evId)
    }
    else {
      await starMessage(roomId, evId)
    }
  }
  catch {
    toast.error(t('auth.error'))
  }
}

// --- URL 检测 ---
const urlRegex = /https?:\/\/[^\s<>"']+/gi
const extractedUrls = computed((): string[] => {
  if (msgtype.value !== 'm.text' || !body.value)
    return []
  const matches: string[] | null = body.value.match(urlRegex)
  return matches ? Array.from(new Set(matches)).slice(0, 3) : []
})

// --- Reactions ---
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉']
const EMOJI_GRID = [
  '👍',
  '👏',
  '🙏',
  '🤝',
  '💪',
  '🫡',
  '👋',
  '✌️',
  '😀',
  '😊',
  '😄',
  '😁',
  '😆',
  '🥰',
  '😂',
  '🥲',
  '😎',
  '🤩',
  '😏',
  '🤔',
  '🙄',
  '😮',
  '😢',
  '😡',
  '❤️',
  '🔥',
  '🎉',
  '✅',
  '💯',
  '⭐',
  '🙌',
  '🤗',
  '👀',
  '💡',
  '📌',
  '🚀',
  '🎯',
  '💬',
  '👌',
  '🆗',
]
const showEmojiPicker = ref(false)

const reactions = computed(() => {
  const roomId = props.event.getRoomId()
  const eventId = props.event.getId()
  if (!roomId || !eventId)
    return []
  return getReactions(roomId, eventId)
})

async function onReact(emoji: string) {
  showEmojiPicker.value = false
  const roomId = props.event.getRoomId()
  const eventId = props.event.getId()
  if (!roomId || !eventId)
    return
  try {
    await sendReaction(roomId, eventId, emoji)
  }
  catch {
    toast.error(t('auth.error'))
  }
}

// --- 已读回执 ---
const readUsers = computed(() => {
  if (!props.isMine)
    return []
  const roomId = props.event.getRoomId()
  const eventId = props.event.getId()
  if (!roomId || !eventId)
    return []
  return getReadUsers(roomId, eventId)
})

// --- Thread ---
const threadReplyCount = computed(() => {
  const roomId = props.event.getRoomId()
  const evId = props.event.getId()
  if (!roomId || !evId)
    return 0
  return getThreadReplies(roomId, evId).length
})

function onOpenThread() {
  const evId = props.event.getId()
  if (evId)
    store.openThread(evId)
}
</script>

<template>
  <div
    v-if="!isSenderBlocked"
    class="group/message-row group relative transition-colors"
    :class="[
      store.multiSelectMode && isSelected
        ? 'bg-accent/30'
        : 'hover:bg-accent/30',
      store.multiSelectMode && 'cursor-pointer',
    ]"
    @mouseleave="showMore = false; showEmojiPicker = false"
    @click="onRowClick"
  >
    <!-- Multi-select checkbox -->
    <div
      v-if="store.multiSelectMode"
      class="absolute left-0 top-0 shrink-0 flex items-center pt-2 -ml-6"
    >
      <span
        class="w-4.5 h-4.5 rounded border flex items-center justify-center transition-colors"
        :class="
          isSelected
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/40'
        "
      >
        <svg
          v-if="isSelected"
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </div>

    <!-- Content column (avatar is now at group level in MessageList) -->
    <div class="min-w-0" :class="isRightAligned && 'flex flex-col items-end'">
      <!-- Sender header is now rendered at the MessageList group level -->

      <!-- Bubble row: bubble + hover actions (relative for absolute-positioned actions) -->
      <div
        class="relative flex items-center gap-1"
        :class="isRightAligned && 'flex-row-reverse'"
      >
        <!-- Redacted -->
        <div
          v-if="isRedacted"
          class="msg-bubble text-sm px-3 py-2 italic text-muted-foreground bg-muted/60"
          :class="bubbleRadiusClass"
        >
          {{ t("chat.message_redacted") }}
        </div>

        <!-- 纯 Emoji 动画显示 (Telegram 风格) -->
        <div v-else-if="isFullEmoji" class="msg-bubble py-1">
          <AnimatedEmoji
            :emoji="body"
            @effect="(e, r) => triggerEmojiEffect?.(e, r)"
          />
        </div>

        <!-- 贴纸消息 -->
        <div v-else-if="isSticker" class="msg-bubble py-1">
          <!-- 图片贴纸 -->
          <img
            v-if="isImageSticker && imageStickerSrc"
            :src="imageStickerSrc"
            :alt="body"
            :title="body"
            class="max-w-[200px] max-h-[200px] rounded-lg object-contain select-none"
          >
          <div
            v-else-if="isImageSticker"
            class="w-[120px] h-[120px] rounded-lg bg-muted/40 animate-pulse"
          />
          <!-- Emoji 贴纸 -->
          <span
            v-else
            class="text-6xl leading-none select-none"
            :title="body"
          >{{ stickerEmoji }}</span>
        </div>

        <!-- Normal bubble -->
        <div
          v-else
          class="msg-bubble max-w-[min(65vw,560px)] w-fit text-sm break-words"
          :class="[
            isMine ? 'bg-primary/10' : 'bg-muted',
            msgtype === 'm.image' || msgtype === 'm.video'
              ? 'p-0.5'
              : 'px-3 py-2',
            bubbleRadiusClass,
          ]"
        >
          <div
            v-if="replyBody"
            class="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 mb-1.5 line-clamp-2"
          >
            {{ replyBody }}
          </div>

          <ImageMessage v-if="msgtype === 'm.image'" :event="event" />
          <VideoMessage v-else-if="msgtype === 'm.video'" :event="event" />
          <AudioMessage v-else-if="msgtype === 'm.audio'" :event="event" />
          <FileMessage v-else-if="msgtype === 'm.file'" :event="event" />
          <LocationMessage
            v-else-if="msgtype === 'm.location'"
            :geo-uri="event.getContent().geo_uri || ''"
            :body="body"
          />
          <ContactCardMessage
            v-else-if="isContactCard && contactCardData"
            :user-id="contactCardData.user_id"
            :display-name="contactCardData.display_name"
            :avatar-url="contactCardData.avatar_url"
            @open-profile="
              (uid: string, e: MouseEvent) => emit('avatarClick', uid, e)
            "
          />
          <div
            v-else-if="sanitizedHtml"
            class="rich-message-content [&_blockquote]:border-l-2 [&_blockquote]:border-current [&_blockquote]:pl-[0.6em] [&_blockquote]:opacity-80 [&_code]:bg-[color-mix(in_srgb,var(--color-foreground)_8%,transparent)] [&_code]:px-[0.3em] [&_code]:py-[0.1em] [&_ol]:pl-[1.4em] [&_pre]:my-[0.4em] [&_pre]:rounded-md [&_pre]:bg-[color-mix(in_srgb,var(--color-foreground)_8%,transparent)] [&_pre]:p-2 [&_strong]:font-semibold [&_ul]:pl-[1.4em] [&_a]:underline [&_a]:underline-offset-2 [&_a[href^='https://matrix.to']]:no-underline"
            @click="onRichContentClick"
            v-html="sanitizedHtml"
          />
          <template v-else>
            {{ body }}
          </template>

          <!-- URL 链接预览 -->
          <LinkPreview v-for="url in extractedUrls" :key="url" :url="url" />
        </div>

        <!-- Inline actions (floating toolbar, absolutely positioned to not affect layout) -->
        <div
          v-if="!isRedacted"
          class="absolute top-0 z-10 opacity-0 transition-opacity duration-150 group-hover/message-row:opacity-100"
          :class="isRightAligned ? 'right-full mr-1' : 'left-full ml-1'"
        >
          <div
            class="flex items-center gap-0.5 p-1 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.1)]"
          >
            <button
              class="cursor-pointer rounded-lg p-[5px] text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
              :title="t('chat.action_reply')"
              @click.stop="onReply"
            >
              <Reply :size="14" />
            </button>
            <button
              class="cursor-pointer rounded-lg p-[5px] text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
              :title="t('chat.action_copy')"
              @click.stop="copyText"
            >
              <Copy :size="14" />
            </button>
            <button
              class="cursor-pointer rounded-lg p-[5px] text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
              :title="t('chat.thread')"
              @click.stop="onOpenThread"
            >
              <span class="relative">
                <MessageSquare :size="14" />
                <span
                  v-if="threadReplyCount > 0"
                  class="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[9px] font-medium flex items-center justify-center px-0.5 leading-none"
                >
                  {{ threadReplyCount }}
                </span>
              </span>
            </button>
            <button
              class="cursor-pointer rounded-lg p-[5px] text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
              :title="t('chat.action_forward')"
              @click.stop="onForward"
            >
              <Forward :size="14" />
            </button>
            <div class="w-px h-4 bg-border/40 mx-0.5" />
            <div class="relative">
              <button
                class="cursor-pointer rounded-lg p-[5px] text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
                :title="t('chat.action_emoji')"
                @click.stop="showEmojiPicker = !showEmojiPicker"
              >
                <SmilePlus :size="14" />
              </button>
              <Transition
                enter-active-class="transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
                leave-active-class="transition-all duration-100 ease-in"
                enter-from-class="opacity-0 -translate-y-1 scale-95"
                leave-to-class="opacity-0 -translate-y-1 scale-95"
              >
                <div
                  v-if="showEmojiPicker"
                  class="absolute bottom-full right-0 mb-1 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] z-20 w-[280px]"
                  @click.stop
                >
                  <!-- Quick reactions row -->
                  <div class="flex gap-1 p-2 border-b border-border/30">
                    <button
                      v-for="emoji in QUICK_EMOJIS"
                      :key="emoji"
                      class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent text-base transition-transform hover:scale-125 cursor-pointer"
                      @click.stop="onReact(emoji)"
                    >
                      {{ emoji }}
                    </button>
                  </div>
                  <!-- Full emoji grid -->
                  <div class="max-h-[200px] overflow-y-auto p-2">
                    <div class="grid grid-cols-8 gap-0.5">
                      <button
                        v-for="emoji in EMOJI_GRID"
                        :key="emoji"
                        class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent text-base transition-transform hover:scale-110 cursor-pointer"
                        @click.stop="onReact(emoji)"
                      >
                        {{ emoji }}
                      </button>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
            <div class="relative">
              <button
                class="cursor-pointer rounded-lg p-[5px] text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
                :title="t('chat.action_more')"
                @click.stop="toggleMore"
              >
                <MoreHorizontal :size="14" />
              </button>
              <Transition
                enter-active-class="transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
                leave-active-class="transition-all duration-100 ease-in"
                enter-from-class="opacity-0 -translate-y-1 scale-95"
                leave-to-class="opacity-0 -translate-y-1 scale-95"
              >
                <div
                  v-if="showMore"
                  class="absolute top-full right-0 mt-1 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] py-1 z-20 min-w-[140px]"
                >
                  <!-- Group 1: Edit / Delete (own messages) -->
                  <template v-if="isMine">
                    <button
                      class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs transition-colors duration-100 hover:bg-accent"
                      @click.stop="
                        onEdit();
                        showMore = false;
                      "
                    >
                      <Edit :size="13" /> {{ t("chat.edit_message") }}
                    </button>
                    <button
                      class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs text-destructive transition-colors duration-100 hover:bg-accent"
                      @click.stop="
                        onRedact();
                        showMore = false;
                      "
                    >
                      <Trash2 :size="13" /> {{ t("chat.recall") }}
                    </button>
                    <div class="h-px bg-border/40 my-1 mx-2" />
                  </template>

                  <!-- Group 2: Pin / Star -->
                  <button class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs transition-colors duration-100 hover:bg-accent" @click.stop="onTogglePin">
                    <component :is="isPinned ? PinOff : Pin" :size="13" />
                    {{
                      isPinned ? t("chat.unpin_message") : t("chat.pin_message")
                    }}
                  </button>
                  <button class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs transition-colors duration-100 hover:bg-accent" @click.stop="onToggleStar">
                    <component :is="isStarred ? StarOff : Star" :size="13" />
                    {{
                      isStarred
                        ? t("chat.unstar_message")
                        : t("chat.star_message")
                    }}
                  </button>

                  <!-- Group 3: Translate (text only) -->
                  <template v-if="isTextMessage">
                    <div class="h-px bg-border/40 my-1 mx-2" />
                    <button
                      class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs transition-colors duration-100 hover:bg-accent"
                      @click.stop="onTranslate"
                    >
                      <Languages :size="13" />
                      {{
                        translatedText
                          ? t("chat.hide_translation")
                          : t("chat.translate")
                      }}
                    </button>
                  </template>

                  <!-- Group 4: Hide / Multi-select -->
                  <div class="h-px bg-border/40 my-1 mx-2" />
                  <button
                    class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs text-muted-foreground transition-colors duration-100 hover:bg-accent"
                    @click.stop="onHideForMe"
                  >
                    <EyeOff :size="13" /> {{ t("chat.hide_for_me") }}
                  </button>
                  <button class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs transition-colors duration-100 hover:bg-accent" @click.stop="onMultiSelect">
                    <CheckSquare :size="13" /> {{ t("chat.multi_select") }}
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </div>

      <!-- 翻译结果 -->
      <div
        v-if="translating"
        class="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground/70"
      >
        <span
          class="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin"
        />
        {{ t("chat.translating") }}
      </div>
      <div
        v-else-if="translatedText"
        class="mt-1 max-w-[min(65vw,560px)] px-3 py-1.5 rounded-md bg-muted/40 border border-border/30"
      >
        <div class="text-[10px] text-muted-foreground/60 mb-0.5">
          {{ t("chat.translation_result") }}
        </div>
        <div class="text-[13px] italic text-muted-foreground leading-relaxed">
          {{ translatedText }}
        </div>
      </div>

      <!-- 发送状态指示 -->
      <div
        v-if="isSending"
        class="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground/50"
      >
        <span
          class="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin"
        />
        {{ t("chat.sending") }}
      </div>
      <div v-if="isFailed" class="flex items-center gap-1.5 mt-1">
        <span class="text-[11px] text-destructive">{{
          t("chat.send_failed")
        }}</span>
        <button
          class="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
          @click.stop="resendMessage"
        >
          <RefreshCw :size="11" />
          {{ t("chat.resend") }}
        </button>
      </div>

      <!-- Reactions 显示 -->
      <div v-if="reactions.length > 0" class="flex flex-wrap gap-1 mt-1">
        <button
          v-for="r in reactions"
          :key="r.key"
          class="reaction-chip inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border transition-all duration-150 cursor-pointer"
          :class="
            r.myReaction
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted/50 border-border/40 text-muted-foreground hover:bg-muted'
          "
          @click.stop="onReact(r.key)"
        >
          <span>{{ r.key }}</span>
          <span class="text-[10px] tabular-nums">{{ r.count }}</span>
        </button>
      </div>

      <!-- 已读回执 (仅自己发的消息，且仅在组内最后一条显示)
           使用固定高度容器，避免与下一条消息重叠 -->
      <div
        v-if="isMine && readUsers.length > 0 && (groupPosition === 'last' || groupPosition === 'alone')"
        class="h-5 flex items-start pt-1"
        :class="isRightAligned ? 'justify-end' : 'justify-start'"
      >
        <div class="flex items-center gap-1 whitespace-nowrap">
          <div class="flex -space-x-1.5">
            <template v-for="u in readUsers.slice(0, 5)" :key="u.userId">
              <img
                v-if="u.avatar"
                :src="u.avatar"
                :alt="u.name"
                :title="u.name"
                class="w-3.5 h-3.5 rounded-full ring-1 ring-background object-cover"
              >
              <div
                v-else
                :title="u.name"
                class="w-3.5 h-3.5 rounded-full ring-1 ring-background bg-muted flex items-center justify-center text-[7px] font-medium text-muted-foreground"
              >
                {{ u.name.slice(0, 1) }}
              </div>
            </template>
          </div>
          <span class="text-[10px] text-muted-foreground/50">
            {{
              readUsers.length > 5
                ? t("chat.read_by_n", { n: readUsers.length })
                : t("chat.read")
            }}
          </span>
        </div>
      </div>
    </div>

    <!-- 转发对话框 -->
    <ForwardDialog
      v-if="showForward"
      :event="event"
      @close="showForward = false"
    />
  </div>
</template>
