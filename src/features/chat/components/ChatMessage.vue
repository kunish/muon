<script setup lang="ts">
/**
 * 单条消息组件
 *
 * - isFirst=true: 显示 40px 头像 + 用户名(彩色) + 时间戳，然后是消息内容
 * - isFirst=false: 头像列留空，仅显示内容；悬浮时在头像列显示 HH:MM 时间
 * - 悬浮时右上角显示 MessageActionBar
 * - 支持 text/image/video/audio/file 消息类型
 * - 引用消息在内容上方显示：竖线 + 小头像 + 用户名 + 截断文本
 */
import { getClient } from '@matrix/client'
import { getReactions, getThreadReplies } from '@matrix/index'
import DOMPurify from 'dompurify'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { Avatar } from '@/shared/components/ui/avatar'
import { useAuthMedia } from '@/shared/composables/useAuthMedia'
import { useChatStore } from '../stores/chatStore'
import LinkPreview from './LinkPreview.vue'
import MessageActionBar from './MessageActionBar.vue'
import AudioMessage from './messages/AudioMessage.vue'
import FileMessage from './messages/FileMessage.vue'
import ImageMessage from './messages/ImageMessage.vue'
import VideoMessage from './messages/VideoMessage.vue'
import ReactionBar from './ReactionBar.vue'

const props = defineProps<{
  event: any
  isFirst: boolean
  roomId: string
  hideAvatarColumn?: boolean
}>()

const emit = defineEmits<{
  avatarClick: [userId: string, event: MouseEvent]
}>()

const { locale, t } = useI18n()
const store = useChatStore()
const settingsStore = useSettingsStore()
const hovered = ref(false)
const showEmojiPicker = ref(false)

// --- 基础信息 ---
const eventId = computed(() => props.event.getId() || '')
const eventType = computed(() => props.event.getType())
const sender = computed(() => props.event.getSender() || '')
const isRedacted = computed(() => props.event.isRedacted())
const msgtype = computed(() => props.event.getContent()?.msgtype)
const body = computed(() => props.event.getContent()?.body || '')

const myUserId = computed(() => getClient().getUserId() || '')
const isMine = computed(() => !!sender.value && sender.value === myUserId.value)
const isRightAligned = computed(() =>
  settingsStore.messageAlignment === 'leftright' && isMine.value,
)

const avatarColumnHidden = computed(() => props.hideAvatarColumn === true)

// --- Sticker support (m.sticker) ---
const isSticker = computed(() => eventType.value === 'm.sticker')
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
  return typeof url === 'string' && url.startsWith('mxc://') && mimetype.startsWith('image/')
})
const imageStickerMxcUrl = computed(() => {
  if (!isImageSticker.value)
    return undefined
  return props.event.getContent()?.url as string | undefined
})
const imageStickerSrc = useAuthMedia(imageStickerMxcUrl, 240, 240)

// --- Full emoji text support (1-3 emojis) ---
const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u
const isFullEmoji = computed(() => {
  if (msgtype.value !== 'm.text' || !body.value)
    return false
  const trimmed = body.value.trim()
  const IntlAny = Intl as any
  if (IntlAny.Segmenter) {
    const segmenter = new IntlAny.Segmenter('en', { granularity: 'grapheme' })
    const segments = [...segmenter.segment(trimmed)] as { segment: string }[]
    if (segments.length < 1 || segments.length > 3)
      return false
    return segments.every((s) => {
      return emojiRegex.test(s.segment) || /^\p{Emoji_Presentation}/u.test(s.segment)
    })
  }
  return false
})

// --- 发送者信息 ---
const senderMember = computed(() => {
  const client = getClient()
  const room = client.getRoom(props.roomId)
  return room?.getMember(sender.value)
})

const senderName = computed(() => senderMember.value?.name || sender.value)

const senderMxcAvatar = computed(() => senderMember.value?.getMxcAvatarUrl() || undefined)

// --- 用户名颜色（基于用户 ID 的确定性颜色） ---
const NAME_COLORS = [
  '#b85c4a', // terracotta
  '#c08b2e', // amber
  '#7a8f52', // olive
  '#4a9882', // sage
  '#6b88a0', // steel blue
  '#5a7a9a', // slate
  '#8b6fb0', // lavender
  '#b06878', // dusty rose
]

const nameColor = computed(() => {
  let hash = 0
  for (const ch of sender.value) {
    hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  }
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]
})

// --- 时间戳 ---
const fullTimestamp = computed(() => {
  const ts = props.event.getTs()
  if (!ts)
    return ''
  const d = new Date(ts)
  const today = new Date()
  const isToday = d.getDate() === today.getDate()
    && d.getMonth() === today.getMonth()
    && d.getFullYear() === today.getFullYear()
  const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  const isZh = locale.value.startsWith('zh')
  if (isToday)
    return isZh ? `今天 ${timeStr}` : `Today at ${timeStr}`
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.getDate() === yesterday.getDate()
    && d.getMonth() === yesterday.getMonth()
    && d.getFullYear() === yesterday.getFullYear()
  if (isYesterday)
    return isZh ? `昨天 ${timeStr}` : `Yesterday at ${timeStr}`
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()} ${timeStr}`
})

const shortTime = computed(() => {
  const ts = props.event.getTs()
  if (!ts)
    return ''
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
})

// --- 引用消息 ---
const replyEvent = computed(() => {
  const inReplyTo = props.event.getContent()?.['m.relates_to']?.['m.in_reply_to']?.event_id
  if (!inReplyTo)
    return null
  const client = getClient()
  const room = client.getRoom(props.roomId)
  return room?.findEventById(inReplyTo) || null
})

const replyBody = computed(() => replyEvent.value?.getContent()?.body || '')
const replySender = computed(() => replyEvent.value?.getSender() || '')

const replySenderName = computed(() => {
  if (!replySender.value)
    return ''
  const client = getClient()
  const room = client.getRoom(props.roomId)
  const member = room?.getMember(replySender.value)
  return member?.name || replySender.value
})

const replySenderMxcAvatar = computed(() => {
  if (!replySender.value)
    return undefined
  const client = getClient()
  const room = client.getRoom(props.roomId)
  const member = room?.getMember(replySender.value)
  return member?.getMxcAvatarUrl() || undefined
})

const replySenderColor = computed(() => {
  if (!replySender.value)
    return NAME_COLORS[0]
  let hash = 0
  for (const ch of replySender.value) {
    hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  }
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]
})

// --- HTML 内容 ---
const formattedBody = computed(() => {
  const content = props.event.getContent()
  if (content?.format === 'org.matrix.custom.html' && content?.formatted_body)
    return content.formatted_body
  return ''
})

const sanitizedHtml = computed(() => {
  if (!formattedBody.value)
    return ''
  return DOMPurify.sanitize(formattedBody.value, {
    ALLOWED_TAGS: [
      'b',
      'i',
      'em',
      'strong',
      'a',
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'code',
      'pre',
      'blockquote',
      'del',
      's',
      'u',
      'span',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  })
})

// --- 编辑标记 ---
const isEdited = computed(() => {
  const content = props.event.getContent()
  return !!content?.['m.new_content']
})

// --- Reactions ---
const reactions = computed(() => {
  if (!props.roomId || !eventId.value)
    return []
  return getReactions(props.roomId, eventId.value)
})

const urlRegex = /https?:\/\/[^\s<>"]+/gi
const extractedUrls = computed((): string[] => {
  if (msgtype.value !== 'm.text' || !body.value)
    return []
  const matches: string[] | null = body.value.match(urlRegex)
  return matches ? Array.from(new Set(matches)).slice(0, 2) : []
})

const threadReplyCount = computed(() => {
  if (!props.roomId || !eventId.value)
    return 0
  return getThreadReplies(props.roomId, eventId.value).length
})

/** Mention 链接点击：打开用户卡片 */
function onRichContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const anchor = target.closest('a[href]') as HTMLAnchorElement | null
  if (!anchor)
    return
  const href = anchor.getAttribute('href') || ''
  const match = href.match(/^https:\/\/matrix\.to\/#\/([@!#][^?]*)/)
  if (match) {
    e.preventDefault()
    e.stopPropagation()
    const userId = decodeURIComponent(match[1])
    if (userId.startsWith('@')) {
      emit('avatarClick', userId, e)
    }
  }
}

function onActionReact() {
  showEmojiPicker.value = !showEmojiPicker.value
}

function openThread() {
  if (!eventId.value)
    return
  store.openThread(eventId.value)
}
</script>

<template>
  <div
    class="chat-message relative flex py-0.5 group"
    :class="[
      avatarColumnHidden
        ? (isRightAligned ? 'justify-end px-0' : 'w-full px-0')
        : (isRightAligned ? 'justify-end pr-4 pl-12' : 'pr-12 pl-4'),
      isFirst
        ? (avatarColumnHidden ? 'pt-0.5' : 'mt-[1.0625rem] pt-0.5')
        : '',
      hovered ? 'bg-accent/30' : 'hover:bg-accent/30',
    ]"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false; showEmojiPicker = false"
  >
    <!-- 头像列 (32px 宽) -->
    <div
      v-if="!avatarColumnHidden"
      class="w-8 shrink-0 flex items-start justify-center select-none"
      :class="[
        isRightAligned ? 'order-2 ml-3 mr-0' : 'order-1 mr-4',
        isFirst ? 'sticky top-2 self-start z-[1]' : '',
      ]"
    >
      <!-- 首条消息：显示头像 -->
      <template v-if="isFirst">
        <Avatar
          :src="senderMxcAvatar"
          :alt="senderName"
          :color-id="sender"
          size="md"
          clickable
          class="mt-0.5"
          @click.stop="emit('avatarClick', sender, $event)"
        />
      </template>

      <!-- 续接消息：悬浮时显示时间 -->
      <span
        v-else
        class="text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors leading-[22px] tabular-nums select-none"
      >
        {{ shortTime }}
      </span>
    </div>

    <!-- 内容列 -->
    <div
      class="min-w-0 flex flex-col"
      :class="avatarColumnHidden
        ? (isRightAligned ? 'items-end' : 'w-full items-start')
        : (isRightAligned ? 'order-1 items-end max-w-[min(72%,900px)]' : 'order-2 items-start flex-1')"
    >
      <!-- 首条消息：用户名 + 时间戳 -->
      <div
        v-if="isFirst"
        class="mb-0.5 flex items-baseline gap-2"
        :class="isRightAligned ? 'justify-end' : ''"
      >
        <span
          class="text-[15px] font-medium leading-snug cursor-pointer hover:underline underline-offset-2"
          :style="{ color: nameColor }"
          @click.stop="emit('avatarClick', sender, $event)"
        >
          {{ senderName }}
        </span>
        <span class="text-[11px] text-muted-foreground/40 leading-snug">
          {{ fullTimestamp }}
        </span>
      </div>

      <!-- 引用回复 -->
      <div
        v-if="replyEvent"
        class="flex items-center gap-1.5 mb-1 text-[13px] leading-snug cursor-pointer hover:opacity-80"
        :class="isRightAligned ? 'self-end' : ''"
      >
        <!-- 竖线 -->
        <div class="w-[2px] h-3 rounded-full bg-muted-foreground/30 shrink-0 ml-0.5" />
        <!-- 小头像 -->
        <Avatar
          :src="replySenderMxcAvatar"
          :alt="replySenderName"
          :color-id="replySender"
          size="xs"
          class="shrink-0"
        />
        <!-- 用户名 -->
        <span class="font-medium text-[12px] shrink-0" :style="{ color: replySenderColor }">
          {{ replySenderName }}
        </span>
        <!-- 截断的消息文本 -->
        <span class="text-[12px] text-muted-foreground/60 truncate">
          {{ replyBody }}
        </span>
      </div>

      <!-- 消息内容 -->
      <div v-if="isRedacted" class="text-[13px] italic text-muted-foreground/40">
        {{ t('chat.message_deleted') }}
      </div>
      <template v-else>
        <div v-if="isSticker" class="py-1">
          <img
            v-if="isImageSticker && imageStickerSrc"
            :src="imageStickerSrc"
            :alt="body"
            :title="body"
            class="max-w-[220px] max-h-[220px] rounded-lg object-contain select-none"
          >
          <div
            v-else-if="isImageSticker"
            class="h-[120px] w-[120px] animate-pulse rounded-lg bg-muted/40"
          />
          <span
            v-else
            class="select-none text-6xl leading-none"
            :title="body"
          >{{ stickerEmoji }}</span>
        </div>
        <ImageMessage v-else-if="msgtype === 'm.image'" :event="event" />
        <VideoMessage v-else-if="msgtype === 'm.video'" :event="event" />
        <AudioMessage v-else-if="msgtype === 'm.audio'" :event="event" />
        <FileMessage v-else-if="msgtype === 'm.file'" :event="event" />
        <div
          v-else-if="sanitizedHtml"
          class="rich-content text-[15px] leading-relaxed text-foreground/90"
          :class="isRightAligned ? 'rounded-2xl bg-primary/10 px-3 py-2' : ''"
          :style="isRightAligned ? { width: 'fit-content', maxWidth: '100%', marginLeft: 'auto' } : {}"
          @click="onRichContentClick"
          v-html="sanitizedHtml"
        />
        <p
          v-else-if="isFullEmoji"
          class="whitespace-pre-wrap break-words text-[44px] leading-none"
          :class="isRightAligned ? 'self-end' : ''"
        >
          {{ body }}
        </p>
        <p
          v-else
          class="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words"
          :class="isRightAligned ? 'rounded-2xl bg-primary/10 px-3 py-2' : ''"
          :style="isRightAligned ? { width: 'fit-content', maxWidth: '100%', marginLeft: 'auto' } : {}"
        >
          {{ body }}<span v-if="isEdited" class="text-[10px] text-muted-foreground/30 ml-1">({{ t('chat.edited') }})</span>
        </p>
      </template>

      <LinkPreview
        v-for="url in extractedUrls"
        :key="url"
        :url="url"
        :class="isRightAligned ? 'self-end' : ''"
      />

      <!-- Reactions -->
      <ReactionBar
        v-if="reactions.length > 0"
        :event-id="eventId"
        :room-id="roomId"
      />

      <button
        v-if="threadReplyCount > 0"
        class="mt-1 text-xs text-primary hover:underline"
        @click.stop="openThread"
      >
        {{ t('chat.thread_replies_count', { count: threadReplyCount }) }}
      </button>
    </div>

    <!-- 悬浮操作栏 -->
    <div
      v-if="hovered && !isRedacted"
      class="absolute -top-4 right-4 z-10"
    >
      <MessageActionBar
        :event="event"
        :room-id="roomId"
        @react="onActionReact"
      />
    </div>
  </div>
</template>

<style scoped>
.rich-content :deep(p) {
  margin: 0;
}
.rich-content :deep(p + p) {
  margin-top: 0.25em;
}
.rich-content :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}
.rich-content :deep(a:hover) {
  text-decoration: underline;
}
.rich-content :deep(a[href^='https://matrix.to']) {
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
  background: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  padding: 0 2px;
  border-radius: 3px;
}
.rich-content :deep(a[href^='https://matrix.to']):hover {
  background: color-mix(in srgb, var(--color-primary) 25%, transparent);
  text-decoration: underline;
}
.rich-content :deep(strong) {
  font-weight: 700;
  color: var(--color-foreground);
}
.rich-content :deep(em) {
  font-style: italic;
}
.rich-content :deep(code) {
  font-size: 0.85em;
  padding: 0.15em 0.35em;
  border-radius: 3px;
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  font-family: 'Consolas', 'Monaco', monospace;
}
.rich-content :deep(pre) {
  margin: 0.5em 0;
  padding: 0.75em;
  border-radius: 4px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  overflow-x: auto;
  font-size: 0.85em;
}
.rich-content :deep(pre code) {
  padding: 0;
  background: none;
  border: none;
}
.rich-content :deep(blockquote) {
  margin: 0.3em 0;
  padding-left: 0.75em;
  border-left: 3px solid var(--color-muted-foreground);
  color: var(--color-muted-foreground);
}
.rich-content :deep(ul),
.rich-content :deep(ol) {
  margin: 0.2em 0;
  padding-left: 1.5em;
}
.rich-content :deep(li + li) {
  margin-top: 0.1em;
}
.rich-content :deep(del),
.rich-content :deep(s) {
  text-decoration: line-through;
  opacity: 0.7;
}
</style>
