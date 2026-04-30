<script setup lang="ts">
import type { ReactionSummary } from '@matrix/index'
import type { MatrixEvent } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'
import { getReactions, getThreadReplies, redactMessage } from '@matrix/index'
import { fetchMediaBlobUrl } from '@matrix/media'
import { Copy, MessageSquare, Reply, Trash2 } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ask } from '@/electron/dialog'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { Avatar } from '@/shared/components/ui/avatar'
import { useAuthMedia } from '@/shared/composables/useAuthMedia'
import { useContextMenuScrollLock } from '@/shared/composables/useContextMenuScrollLock'
import { useViewportClampedFloating } from '@/shared/composables/useViewportClampedFloating'
import { isFullEmojiText } from '@/shared/lib/emoji'
import { sanitizeMatrixHtml } from '@/shared/lib/htmlSanitizer'
import { handleMatrixLinkClick } from '@/shared/lib/matrixLinks'
import { getFloatingPosition } from '../composables/useFloatingPosition'
import { useMediaViewer } from '../composables/useMediaViewer'
import { useMessageContextMenuState } from '../composables/useMessageContextMenuState'
import { getMediaFrameStyle } from '../lib/mediaFrame'
import { copyMessageContentToClipboard } from '../lib/messageClipboard'
import { useChatStore } from '../stores/chatStore'
import LinkPreview from './LinkPreview.vue'
import MessageActionBar from './MessageActionBar.vue'
import AudioMessage from './messages/AudioMessage.vue'
import ContactCardMessage from './messages/ContactCardMessage.vue'
import FileMessage from './messages/FileMessage.vue'
import ImageMessage from './messages/ImageMessage.vue'
import VideoMessage from './messages/VideoMessage.vue'
import ReactionBar from './ReactionBar.vue'

/**
 * 单条消息组件
 *
 * - isFirst=true: 显示 40px 头像 + 用户名(彩色) + 时间戳，然后是消息内容
 * - isFirst=false: 头像列留空，仅显示内容；悬浮时在头像列显示 HH:MM 时间
 * - 悬浮时右上角显示 MessageActionBar
 * - 支持 text/image/video/audio/file 消息类型
 * - 引用消息在内容上方显示：竖线 + 小头像 + 用户名 + 截断文本
 */
const props = defineProps<{
  event: MatrixEvent
  isFirst: boolean
  roomId: string
  hideAvatarColumn?: boolean
  reactions?: ReactionSummary[]
  threadReplyCount?: number
  timelineVersion?: number
}>()

const emit = defineEmits<{
  avatarClick: [userId: string, event: MouseEvent]
}>()

const RICH_MEDIA_PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
const RICH_MEDIA_MAX_WIDTH = 300
const RICH_MEDIA_MAX_HEIGHT = 400
const RICH_MEDIA_FALLBACK_WIDTH = 300
const RICH_MEDIA_FALLBACK_HEIGHT = 180

const { t } = useI18n()
const store = useChatStore()
const settingsStore = useSettingsStore()
const { openImage } = useMediaViewer()
const hovered = ref(false)
const showEmojiPicker = ref(false)
const showContextMenu = ref(false)
const actionMenuOpen = ref(false)
const actionBarHovered = ref(false)
const messageRef = ref<HTMLElement | null>(null)
const richContentRef = ref<HTMLElement | null>(null)
const actionBarRef = ref<HTMLElement | null>(null)
const actionBarStyle = ref({ left: '0px', top: '0px' })
const actionBarPositioned = ref(false)
const contextMenuRef = ref<HTMLElement | null>(null)
const contextMenuPos = ref({ x: 0, y: 0 })
const { style: contextMenuStyle } = useViewportClampedFloating({
  open: showContextMenu,
  position: contextMenuPos,
  element: contextMenuRef,
  fallbackSize: { width: 180, height: 152 },
})
const { isAnyMessageContextMenuOpen } = useMessageContextMenuState(showContextMenu)
const isVisuallyHovered = computed(() => hovered.value || showContextMenu.value || actionMenuOpen.value || actionBarHovered.value)
const shouldShowActionBar = computed(() => !isAnyMessageContextMenuOpen.value && (hovered.value || actionMenuOpen.value || actionBarHovered.value))
let hoverCloseTimer: ReturnType<typeof setTimeout> | null = null
let richMediaHydrationRun = 0

useContextMenuScrollLock(showContextMenu)

// --- 基础信息 ---
const eventId = computed(() => props.event.getId() || '')
const eventType = computed(() => props.event.getType())
const sender = computed(() => props.event.getSender() || '')
const isRedacted = computed(() => {
  void props.timelineVersion
  return props.event.isRedacted()
})
const msgtype = computed(() => props.event.getContent()?.msgtype)
const body = computed(() => props.event.getContent()?.body || '')

const myUserId = computed(() => getClient().getUserId() || '')
const isMine = computed(() => !!sender.value && sender.value === myUserId.value)
const isRightAligned = computed(() =>
  settingsStore.messageAlignment === 'leftright' && isMine.value,
)
const textBubbleClass = computed(() => [
  'w-fit max-w-full rounded-2xl px-3 py-2',
  isRightAligned.value ? 'self-end bg-primary/10' : 'bg-muted/60',
])

const avatarColumnHidden = computed(() => props.hideAvatarColumn === true)

function clearHoverCloseTimer() {
  if (!hoverCloseTimer)
    return
  clearTimeout(hoverCloseTimer)
  hoverCloseTimer = null
}

function targetIsInside(element: HTMLElement | null, target: EventTarget | null) {
  return !!(target instanceof Node && element?.contains(target))
}

function hideActionBarFromOutsideInteraction() {
  clearHoverCloseTimer()
  hovered.value = false
  actionBarHovered.value = false
  showEmojiPicker.value = false
  if (!actionMenuOpen.value)
    actionBarPositioned.value = false
}

function onMessageMouseEnter() {
  clearHoverCloseTimer()
  hovered.value = true
}

function onMessageMouseLeave() {
  clearHoverCloseTimer()
  showEmojiPicker.value = false
  hoverCloseTimer = setTimeout(() => {
    hovered.value = false
  }, 120)
}

function onActionBarMouseEnter() {
  clearHoverCloseTimer()
  actionBarHovered.value = true
}

function onActionBarMouseLeave() {
  actionBarHovered.value = false
}

function updateActionBarPosition() {
  const message = messageRef.value
  const actionBar = actionBarRef.value
  if (!message || !actionBar)
    return
  actionBarStyle.value = getFloatingPosition(message, actionBar, { margin: 8, offset: 6, align: 'end' })
  actionBarPositioned.value = true
}

async function positionActionBarAfterRender() {
  actionBarPositioned.value = false
  await nextTick()
  if (shouldShowActionBar.value && !isRedacted.value)
    updateActionBarPosition()
}

function onViewportChange() {
  if (shouldShowActionBar.value && !isRedacted.value)
    updateActionBarPosition()
}

function onDocumentActionBarPointerDown(event: PointerEvent) {
  if (!shouldShowActionBar.value || isRedacted.value)
    return
  if (
    targetIsInside(messageRef.value, event.target)
    || targetIsInside(actionBarRef.value, event.target)
  ) {
    return
  }
  hideActionBarFromOutsideInteraction()
}

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
const imageStickerFrameStyle = computed(() => {
  const info = props.event.getContent()?.info as { w?: unknown, h?: unknown } | undefined
  return getMediaFrameStyle(info, {
    maxWidth: 220,
    maxHeight: 220,
    fallbackWidth: 120,
    fallbackHeight: 120,
  })
})

// --- Full emoji text support (1-3 emojis) ---
const isFullEmoji = computed(() => {
  if (msgtype.value !== 'm.text' || !body.value)
    return false
  return isFullEmojiText(body.value)
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
  if (isToday)
    return t('chat.today_at', { time: timeStr })
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.getDate() === yesterday.getDate()
    && d.getMonth() === yesterday.getMonth()
    && d.getFullYear() === yesterday.getFullYear()
  if (isYesterday)
    return t('chat.yesterday_at', { time: timeStr })
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

const currentRoomMemberIds = computed(() => {
  void props.timelineVersion
  const room = getClient().getRoom(props.roomId)
  if (!room)
    return null
  return new Set(room.getJoinedMembers().map(member => member.userId))
})

const urlRegex = /https?:\/\/[^\s<>"]+/gi
const hasUrlRegex = /https?:\/\/[^\s<>"]+/i

function getMatrixToUserId(href: string): string {
  try {
    const url = new URL(href, 'https://matrix.to')
    if (url.hostname !== 'matrix.to')
      return ''
    const hashPath = url.hash.replace(/^#\/?/, '')
    const rawUserId = hashPath.split(/[?#]/)[0]
    const userId = decodeURIComponent(rawUserId)
    return userId.startsWith('@') ? userId : ''
  }
  catch {
    return ''
  }
}

function markOutOfContextMentions(html: string): string {
  const memberIds = currentRoomMemberIds.value
  if (!memberIds || typeof document === 'undefined')
    return html

  const template = document.createElement('template')
  template.innerHTML = html
  for (const anchor of template.content.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const userId = getMatrixToUserId(anchor.getAttribute('href') || '')
    if (userId && !memberIds.has(userId))
      anchor.classList.add('mention-out-of-context', 'opacity-50')
  }

  return template.innerHTML
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/'/g, '&#39;')
}

function stripTrailingUrlPunctuation(url: string): { href: string, trailing: string } {
  const match = url.match(/[),.;:!?]+$/)
  if (!match)
    return { href: url, trailing: '' }
  return {
    href: url.slice(0, -match[0].length),
    trailing: match[0],
  }
}

function linkifyPlainText(text: string): string {
  let html = ''
  let lastIndex = 0
  for (const match of text.matchAll(urlRegex)) {
    const rawUrl = match[0]
    const index = match.index ?? 0
    const { href, trailing } = stripTrailingUrlPunctuation(rawUrl)
    if (!href)
      continue

    html += escapeHtmlText(text.slice(lastIndex, index))
    html += `<a href="${escapeHtmlAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(href)}</a>${escapeHtmlText(trailing)}`
    lastIndex = index + rawUrl.length
  }
  html += escapeHtmlText(text.slice(lastIndex))
  return html
}

const linkifiedPlainBodyHtml = computed(() => {
  if (formattedBody.value || (msgtype.value !== 'm.text' && msgtype.value !== 'm.notice') || !body.value)
    return ''
  if (!hasUrlRegex.test(body.value))
    return ''
  return linkifyPlainText(body.value)
})

const sanitizedHtml = computed(() => {
  const html = formattedBody.value || linkifiedPlainBodyHtml.value
  if (!html)
    return ''
  return prepareRichMediaHtml(sanitizeMatrixHtml(markOutOfContextMentions(html)))
})

function prepareRichMediaHtml(html: string): string {
  if (typeof document === 'undefined')
    return html

  const template = document.createElement('template')
  template.innerHTML = html
  for (const image of template.content.querySelectorAll<HTMLImageElement>('img[src^="mxc://"]')) {
    const mxcUrl = image.getAttribute('src') || ''
    image.dataset.richMediaMxcSrc = mxcUrl
    image.dataset.richMediaPending = 'true'
    image.loading = 'lazy'
    image.decoding = 'async'
    image.src = RICH_MEDIA_PLACEHOLDER_SRC
    image.setAttribute('style', getRichMediaImageStyle(image))
  }

  return template.innerHTML
}

function getRichMediaImageStyle(image: HTMLImageElement): string {
  const sourceWidth = Number(image.dataset.width)
  const sourceHeight = Number(image.dataset.height)
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0 || !Number.isFinite(sourceHeight) || sourceHeight <= 0) {
    return `width: ${RICH_MEDIA_FALLBACK_WIDTH}px; height: ${RICH_MEDIA_FALLBACK_HEIGHT}px;`
  }

  const scale = Math.min(
    RICH_MEDIA_MAX_WIDTH / sourceWidth,
    RICH_MEDIA_MAX_HEIGHT / sourceHeight,
    1,
  )
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  return `width: ${width}px; height: ${height}px; aspect-ratio: ${sourceWidth} / ${sourceHeight};`
}

// --- Contact card support ---
const isContactCard = computed(() => msgtype.value === 'im.muon.contact_card')
const contactCardData = computed(() => {
  if (!isContactCard.value)
    return null
  return props.event.getContent()?.['im.muon.contact_card'] || null
})

// --- 编辑标记 ---
const isEdited = computed(() => {
  const content = props.event.getContent()
  return !!content?.['m.new_content']
})

// --- Reactions ---
const messageReactions = computed(() => {
  if (props.reactions)
    return props.reactions
  if (!props.roomId || !eventId.value)
    return []
  return getReactions(props.roomId, eventId.value)
})

const extractedUrls = computed((): string[] => {
  if (msgtype.value !== 'm.text' || !body.value)
    return []
  const matches: string[] | null = body.value.match(urlRegex)
  return matches ? Array.from(new Set(matches)).slice(0, 2) : []
})

const threadReplyCount = computed(() => {
  if (typeof props.threadReplyCount === 'number')
    return props.threadReplyCount
  if (!props.roomId || !eventId.value)
    return 0
  return getThreadReplies(props.roomId, eventId.value).length
})

/** Mention 链接点击：打开用户卡片 */
function onRichContentClick(e: MouseEvent) {
  const target = e.target instanceof HTMLElement ? e.target : null
  const image = target?.closest('img[data-rich-media-full-src]') as HTMLImageElement | null
  const fullSrc = image?.dataset.richMediaFullSrc
  if (fullSrc) {
    e.preventDefault()
    e.stopPropagation()
    openImage(fullSrc)
    return
  }

  handleMatrixLinkClick(e, (userId, event) => emit('avatarClick', userId, event))
}

async function hydrateRichMediaImages() {
  const run = ++richMediaHydrationRun
  await nextTick()
  const root = richContentRef.value
  if (!root)
    return

  const images = [...root.querySelectorAll<HTMLImageElement>('img[data-rich-media-mxc-src]')]
  await Promise.all(images.map(async (image) => {
    if (image.dataset.richMediaFullSrc)
      return
    const mxcUrl = image.dataset.richMediaMxcSrc
    if (!mxcUrl)
      return

    image.loading = 'lazy'
    const thumbSrc = await fetchMediaBlobUrl(mxcUrl, 300, 300)
    const fullSrc = await fetchMediaBlobUrl(mxcUrl)
    if (run !== richMediaHydrationRun)
      return
    if (thumbSrc)
      image.src = thumbSrc
    if (fullSrc) {
      image.dataset.richMediaFullSrc = fullSrc
      delete image.dataset.richMediaPending
    }
  }))
}

function onActionReact() {
  showEmojiPicker.value = !showEmojiPicker.value
}

function openThread() {
  if (!eventId.value)
    return
  store.openThread(eventId.value)
}

function closeContextMenu() {
  showContextMenu.value = false
}

function onMessageContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  contextMenuPos.value = { x: event.clientX, y: event.clientY }
  showContextMenu.value = true
}

function onReplyFromContextMenu() {
  store.setReplyingTo(props.event)
  closeContextMenu()
}

function onCopyFromContextMenu() {
  void copyMessageContentToClipboard(props.event.getContent() ?? {})
  closeContextMenu()
}

function onOpenThreadFromContextMenu() {
  openThread()
  closeContextMenu()
}

async function onDeleteFromContextMenu() {
  if (!eventId.value)
    return
  const confirmed = await ask(t('chat.delete_confirm'), {
    title: t('chat.delete_message'),
    kind: 'warning',
  })
  if (!confirmed)
    return
  await redactMessage(props.roomId, eventId.value)
  closeContextMenu()
}

function onDocumentPointerDown(event: MouseEvent) {
  if (!showContextMenu.value)
    return
  if (contextMenuRef.value?.contains(event.target as Node))
    return
  closeContextMenu()
}

watch(showContextMenu, (open) => {
  if (open) {
    setTimeout(() => document.addEventListener('mousedown', onDocumentPointerDown), 0)
  }
  else {
    document.removeEventListener('mousedown', onDocumentPointerDown)
  }
})

watch(shouldShowActionBar, (visible) => {
  if (!visible || isRedacted.value) {
    actionBarPositioned.value = false
    return
  }
  void positionActionBarAfterRender()
})

watch(sanitizedHtml, () => {
  void hydrateRichMediaImages()
})

onMounted(() => {
  void hydrateRichMediaImages()
  document.addEventListener('pointerdown', onDocumentActionBarPointerDown, true)
  window.addEventListener('resize', onViewportChange)
  document.addEventListener('scroll', onViewportChange, true)
})

onUnmounted(() => {
  clearHoverCloseTimer()
  document.removeEventListener('mousedown', onDocumentPointerDown)
  document.removeEventListener('pointerdown', onDocumentActionBarPointerDown, true)
  window.removeEventListener('resize', onViewportChange)
  document.removeEventListener('scroll', onViewportChange, true)
})
</script>

<template>
  <div
    ref="messageRef"
    class="chat-message relative flex py-0.5 group"
    data-testid="chat-message-row"
    :class="[
      avatarColumnHidden
        ? (isRightAligned ? 'justify-end px-0' : 'w-full px-0')
        : (isRightAligned ? 'justify-end pr-4 pl-12' : 'pr-12 pl-4'),
      isFirst
        ? (avatarColumnHidden ? 'pt-0.5' : 'mt-[1.0625rem] pt-0.5')
        : '',
      isVisuallyHovered ? 'bg-accent/30' : 'hover:bg-accent/30',
    ]"
    @mouseenter="onMessageMouseEnter"
    @mouseleave="onMessageMouseLeave"
    @contextmenu="onMessageContextMenu"
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
          class="mt-0.5 cursor-pointer"
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
          <div
            v-if="isImageSticker"
            data-testid="image-sticker-frame"
            class="overflow-hidden rounded-lg"
            :style="imageStickerFrameStyle"
          >
            <img
              v-if="imageStickerSrc"
              :src="imageStickerSrc"
              :alt="body"
              :title="body"
              class="h-full w-full object-contain select-none"
            >
            <div
              v-else
              class="h-full w-full animate-pulse rounded-lg bg-muted/40"
            />
          </div>
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
        <ContactCardMessage
          v-else-if="isContactCard && contactCardData"
          :user-id="contactCardData.user_id"
          :display-name="contactCardData.display_name"
          :avatar-url="contactCardData.avatar_url"
          @open-profile="(userId, e) => emit('avatarClick', userId, e)"
        />
        <div
          v-else-if="sanitizedHtml"
          ref="richContentRef"
          class="rich-message-content text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words [&_blockquote]:border-l-[3px] [&_blockquote]:border-muted-foreground [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:border [&_code]:border-border [&_code]:bg-muted [&_code]:px-[0.35em] [&_code]:py-[0.15em] [&_code]:font-['Consolas','Monaco',monospace] [&_del]:opacity-70 [&_del]:line-through [&_em]:italic [&_img]:my-1 [&_img]:block [&_img]:max-h-[400px] [&_img]:max-w-[300px] [&_img]:cursor-pointer [&_img]:rounded-lg [&_img]:bg-muted [&_img]:object-contain [&_ol]:pl-6 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-2 [&_pre]:rounded [&_pre]:border [&_pre]:border-border [&_pre]:bg-card [&_pre]:p-3 [&_pre_code]:border-0 [&_s]:opacity-70 [&_s]:line-through [&_strong]:font-bold [&_strong]:text-foreground [&_ul]:pl-6 [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline [&_a[href^='https://matrix.to']]:rounded [&_a[href^='https://matrix.to']]:bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] [&_a[href^='https://matrix.to']]:px-0.5 hover:[&_a[href^='https://matrix.to']]:bg-[color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
          :class="textBubbleClass"
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
          class="message-selectable-text text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words"
          :class="textBubbleClass"
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
        v-if="messageReactions.length > 0"
        :event-id="eventId"
        :reactions="messageReactions"
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

    <Teleport to="body">
      <!-- 悬浮操作栏 -->
      <div
        v-if="shouldShowActionBar && !isRedacted"
        ref="actionBarRef"
        class="fixed z-[190] transition-opacity duration-75"
        :class="actionBarPositioned ? 'opacity-100' : 'opacity-0'"
        :style="{ left: actionBarStyle.left, top: actionBarStyle.top }"
        data-testid="chat-message-action-bar"
        @mouseenter="onActionBarMouseEnter"
        @mouseleave="onActionBarMouseLeave"
      >
        <MessageActionBar
          :event="event"
          :room-id="roomId"
          @react="onActionReact"
          @menu-open-change="actionMenuOpen = $event"
        />
      </div>
    </Teleport>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        leave-active-class="transition-all duration-100 ease-in"
        enter-from-class="scale-[0.92] opacity-0 -translate-y-1"
        leave-to-class="scale-95 opacity-0"
      >
        <div
          v-if="showContextMenu"
          ref="contextMenuRef"
          class="fixed z-[220] min-w-[180px] rounded-xl border border-border/60 bg-popover/95 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-xl"
          :style="contextMenuStyle"
          @contextmenu.prevent
        >
          <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-[120ms] hover:bg-accent" @click="onReplyFromContextMenu">
            <Reply :size="14" />
            <span>{{ t('chat.action_reply') }}</span>
          </button>
          <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-[120ms] hover:bg-accent" @click="onCopyFromContextMenu">
            <Copy :size="14" />
            <span>{{ t('chat.action_copy') }}</span>
          </button>
          <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-[120ms] hover:bg-accent" @click="onOpenThreadFromContextMenu">
            <MessageSquare :size="14" />
            <span>{{ t('chat.thread') }}</span>
          </button>
          <button
            v-if="isMine"
            class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-destructive transition-all duration-[120ms] hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)]"
            @click="onDeleteFromContextMenu"
          >
            <Trash2 :size="14" />
            <span>{{ t('chat.delete_message') }}</span>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
