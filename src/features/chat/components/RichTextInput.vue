<script setup lang="ts">
import type { MentionPopupState } from '../composables/useEditor'
import type { ImageSticker } from '@/shared/data/stickerPacks'
import type { GifResult } from '@/shared/lib/gifSearch'
import {
  editMessage,
  extractImageMeta,
  getClient,
  replyToMessage,
  sendAudioMessage,
  sendContactCard,
  sendGifMessage,
  sendImageStickerMessage,
  sendLocationMessage,
  sendStickerMessage,
  sendTextMessage,
  uploadMedia,
} from '@matrix/index'
import { EditorContent } from '@tiptap/vue-3'
import {
  ALargeSmall,
  AtSign,
  Bold,
  Braces,
  ChevronDown,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Quote,
  SendHorizontal,
  Smile,
  Strikethrough,
  Underline,
  X,
} from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { htmlToPlainText } from '@/shared/lib/markdown'
import { useCurrentRoom } from '../composables/useCurrentRoom'
import { useEditor } from '../composables/useEditor'
import { getFloatingPosition } from '../composables/useFloatingPosition'
import { useMediaUpload } from '../composables/useMediaUpload'
import { useMediaViewer } from '../composables/useMediaViewer'
import { useMention } from '../composables/useMention'
import { useTyping } from '../composables/useTyping'
import { useChatStore } from '../stores/chatStore'
import AttachmentMenu from './AttachmentMenu.vue'
import ContactCardPicker from './ContactCardPicker.vue'
import ExpressionPicker from './ExpressionPicker.vue'
import LocationPicker from './LocationPicker.vue'
import MentionList from './MentionList.vue'
import ScreenshotButton from './ScreenshotButton.vue'
import StickerPackManager from './StickerPackManager.vue'
import UploadProgress from './UploadProgress.vue'
import VoiceRecorder from './VoiceRecorder.vue'

const store = useChatStore()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { startTyping, stopTyping } = useTyping()
const { openImage, openVideo } = useMediaViewer()
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

const editorExpanded = shallowRef(false)
const postTitle = shallowRef('')

interface PendingPasteAttachment {
  id: string
  file: File
  kind: 'image' | 'video' | 'file'
  previewUrl: string | null
}

const PENDING_MEDIA_NODE_PATTERN
  = /<(?:div|span)(?:\s[^>]*)?data-pending-media-id="([^"]+)"[^>]*>\s*<\/(?:div|span)>/g
let pendingPasteAttachmentId = 0
const pendingPasteAttachments = shallowRef<PendingPasteAttachment[]>([])
const pendingPasteAttachmentDrafts = new Map<string, PendingPasteAttachment[]>()
const hasPendingPasteAttachments = computed(() => pendingPasteAttachments.value.length > 0)
const editorHeightClass = computed(() => {
  if (editorExpanded.value)
    return 'overflow-y-auto min-h-[320px] max-h-[60vh] [&_.tiptap]:min-h-[304px]'

  if (hasPendingPasteAttachments.value)
    return 'overflow-y-auto min-h-[80px] max-h-[180px] [&_.tiptap]:min-h-[64px] [&_.tiptap]:overflow-visible [&_.tiptap]:whitespace-normal'

  return 'overflow-hidden min-h-[40px] max-h-[40px] [&_.tiptap]:min-h-[24px] [&_.tiptap]:overflow-hidden [&_.tiptap]:whitespace-nowrap [&_.tiptap_p]:truncate'
})

const { editor, clear, insertEmoji, insertPendingMediaAttachment } = useEditor({
  placeholder: placeholderText,
  onSubmit: submitComposer,
  onPasteFiles: handlePasteFiles,
  canSubmit: hasPendingPasteAttachments,
  pendingMedia: {
    getAttachment: (id: string) => pendingPasteAttachments.value.find(attachment => attachment.id === id),
    onPreview: openPendingPasteAttachmentPreview,
    onRemove: removePendingPasteAttachment,
  },
  submitOnEnter: computed(() => !editorExpanded.value),
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

function openEmojiPicker(e: MouseEvent) {
  void openExpressionPicker('emoji', e.currentTarget as HTMLElement)
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
    toast.error(t('chat.send_failed'))
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

const composeVersion = ref(0)
const sendInFlight = ref(false)

function markComposeChanged() {
  composeVersion.value += 1
}

async function submitComposer(html: string, text: string): Promise<boolean> {
  const hasText = text.trim().length > 0
  if (!hasText && !hasPendingPasteAttachments.value)
    return false

  if (!hasPendingPasteAttachments.value)
    return handleSend(html, text)

  if (sendInFlight.value)
    return false

  const roomId = store.currentRoomId
  if (!roomId)
    return false

  sendInFlight.value = true
  const editingEvent = store.editingEvent
  const replyingTo = store.replyingTo
  const submittedHtml = html
  const submittedText = text.trim()
  const submittedComposeVersion = composeVersion.value
  let richPayload: RichMediaSubmitPayload

  try {
    richPayload = await createRichMediaSubmitPayload(html)
    if (!richPayload.html)
      return false
    const result = await sendTextContent(roomId, richPayload.html, richPayload.text, editingEvent, replyingTo)
    if (!result.ok)
      return false
  }
  catch {
    toast.error(t('chat.upload_failed'))
    return false
  }
  finally {
    sendInFlight.value = false
    uploading.value = false
  }

  const editorTextUnchanged = editor.value?.getText().trim() === submittedText
  const editorHtmlUnchanged = editor.value?.getHTML() === submittedHtml
  const roomUnchanged = store.currentRoomId === roomId
  const composeUnchanged = store.editingEvent === editingEvent && store.replyingTo === replyingTo
  const composeVersionUnchanged = composeVersion.value === submittedComposeVersion
  const canCleanSubmittedState = roomUnchanged && composeUnchanged && composeVersionUnchanged && editorTextUnchanged && editorHtmlUnchanged

  const submittedAttachmentIds = new Set(richPayload.submittedAttachmentIds)
  const submittedAttachments = pendingPasteAttachments.value.filter(attachment => submittedAttachmentIds.has(attachment.id))
  pendingPasteAttachments.value = pendingPasteAttachments.value.filter(
    attachment => !submittedAttachmentIds.has(attachment.id),
  )
  revokePendingPasteAttachmentUrls(submittedAttachments)
  if (drafts.get(roomId) === submittedHtml)
    drafts.delete(roomId)
  if (roomId)
    pendingPasteAttachmentDrafts.delete(roomId)
  if (canCleanSubmittedState) {
    clear()
    stopTyping()
    store.clearCompose()
  }
  markComposeChanged()

  return true
}

async function handleSend(html: string, text: string): Promise<boolean> {
  const roomId = store.currentRoomId
  if (!roomId || !text.trim())
    return false
  if (sendInFlight.value)
    return false
  sendInFlight.value = true
  const editingEvent = store.editingEvent
  const replyingTo = store.replyingTo
  const submittedHtml = html
  const submittedText = text.trim()
  const submittedComposeVersion = composeVersion.value
  let sentPlainText = false

  try {
    const result = await sendTextContent(roomId, html, text, editingEvent, replyingTo)
    if (!result.ok)
      return false
    sentPlainText = result.sentPlainText
  }
  catch {
    toast.error(t('chat.send_failed'))
    return false
  }
  finally {
    sendInFlight.value = false
  }

  const editorTextUnchanged = editor.value?.getText().trim() === submittedText
  const editorHtmlUnchanged = editor.value?.getHTML() === submittedHtml
  const roomUnchanged = store.currentRoomId === roomId
  const composeUnchanged = store.editingEvent === editingEvent && store.replyingTo === replyingTo
  const composeVersionUnchanged = composeVersion.value === submittedComposeVersion
  const canCleanSubmittedState = roomUnchanged && composeUnchanged && composeVersionUnchanged && editorTextUnchanged && editorHtmlUnchanged
  if (sentPlainText && drafts.get(roomId) === submittedHtml)
    drafts.delete(roomId)
  if (canCleanSubmittedState) {
    clear()
    stopTyping()
    store.clearCompose()
  }

  return true
}

async function sendTextContent(
  roomId: string,
  html: string,
  text: string,
  editingEvent: typeof store.editingEvent,
  replyingTo: typeof store.replyingTo,
): Promise<{ ok: boolean, sentPlainText: boolean }> {
  try {
    if (editingEvent) {
      const eventId = editingEvent.getId()
      if (!eventId) {
        toast.error(t('chat.send_failed'))
        return { ok: false, sentPlainText: false }
      }
      await editMessage(roomId, eventId, text, html)
      return { ok: true, sentPlainText: false }
    }

    if (replyingTo) {
      const eventId = replyingTo.getId()
      if (!eventId) {
        toast.error(t('chat.send_failed'))
        return { ok: false, sentPlainText: false }
      }
      await replyToMessage(roomId, eventId, text, html)
      return { ok: true, sentPlainText: false }
    }

    await sendTextMessage(roomId, text, html)
    return { ok: true, sentPlainText: true }
  }
  catch {
    toast.error(t('chat.send_failed'))
    return { ok: false, sentPlainText: false }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

function createSubmitPayload(html: string, text: string) {
  const title = editorExpanded.value ? postTitle.value.trim() : ''
  if (!title) {
    return { html, text }
  }

  const titleHtml = `<p><strong>${escapeHtml(title)}</strong></p>`
  const bodyText = text.trim()
  return {
    html: bodyText ? `${titleHtml}${html}` : titleHtml,
    text: bodyText ? `${title}\n\n${text}` : title,
  }
}

async function submitEditor() {
  const html = editor.value?.getHTML() || ''
  const text = editor.value?.getText() || ''
  const payload = createSubmitPayload(html, text)
  if (!store.currentRoomId || (!payload.text.trim() && !hasPendingPasteAttachments.value))
    return
  const submitted = await submitComposer(payload.html, payload.text)
  if (submitted)
    postTitle.value = ''
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
    toast.error(t('chat.send_failed'))
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
    toast.error(t('chat.send_failed'))
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
    toast.error(t('chat.send_failed'))
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
    toast.error(t('chat.send_failed'))
  }
}

async function handleVoiceSend(blob: Blob, duration: number) {
  const roomId = store.currentRoomId
  if (!roomId)
    return
  try {
    await sendAudioMessage(roomId, blob, duration)
  }
  catch {
    toast.error(t('auth.error'))
  }
}

function handlePasteFiles(files: File[]) {
  if (!files.length)
    return

  const attachments = files.map(file => ({
    id: `paste-${Date.now()}-${pendingPasteAttachmentId++}`,
    file,
    kind: getPendingPasteAttachmentKind(file),
    previewUrl: createPendingPastePreviewUrl(file),
  }))

  pendingPasteAttachments.value = [
    ...pendingPasteAttachments.value,
    ...attachments,
  ]
  for (const attachment of attachments)
    insertPendingMediaAttachment(attachment.id)
  markComposeChanged()
}

function removePendingPasteAttachment(id: string) {
  const removedAttachment = pendingPasteAttachments.value.find(attachment => attachment.id === id)
  pendingPasteAttachments.value = pendingPasteAttachments.value.filter(attachment => attachment.id !== id)
  if (removedAttachment)
    revokePendingPasteAttachmentUrls([removedAttachment])
  markComposeChanged()
}

function openPendingPasteAttachmentPreview(attachment: PendingPasteAttachment) {
  if (!attachment.previewUrl)
    return
  if (attachment.kind === 'image') {
    openImage(attachment.previewUrl)
    return
  }
  if (attachment.kind === 'video')
    openVideo(attachment.previewUrl)
}

function getPendingPasteAttachmentKind(file: File): 'image' | 'video' | 'file' {
  if (file.type.startsWith('image/'))
    return 'image'
  if (file.type.startsWith('video/'))
    return 'video'
  return 'file'
}

function createPendingPastePreviewUrl(file: File): string | null {
  const kind = getPendingPasteAttachmentKind(file)
  if (kind === 'file' || typeof URL.createObjectURL !== 'function')
    return null
  return URL.createObjectURL(file)
}

interface RichMediaUpload {
  attachment: PendingPasteAttachment
  mxcUrl: string
  width?: number
  height?: number
}

interface RichMediaSubmitPayload {
  html: string
  text: string
  submittedAttachmentIds: string[]
}

async function createRichMediaSubmitPayload(html: string): Promise<RichMediaSubmitPayload> {
  const attachmentsById = new Map(pendingPasteAttachments.value.map(attachment => [attachment.id, attachment]))
  const mediaIds = getPendingMediaIds(html).filter(id => attachmentsById.has(id))
  if (!mediaIds.length) {
    return {
      html,
      text: htmlToPlainText(html),
      submittedAttachmentIds: [],
    }
  }

  uploading.value = true
  progress.value = 0
  const uploads = new Map<string, RichMediaUpload>()
  for (const [index, id] of mediaIds.entries()) {
    const attachment = attachmentsById.get(id)
    if (!attachment)
      continue
    uploads.set(id, await uploadPendingRichMediaAttachment(attachment))
    progress.value = Math.round(((index + 1) / mediaIds.length) * 90)
  }

  const richHtml = replacePendingMediaNodes(html, id => renderRichMediaUpload(uploads.get(id)))
  const plainTextHtml = replacePendingMediaNodes(html, (id) => {
    const attachment = uploads.get(id)?.attachment
    return attachment ? `<p>[${escapeHtml(attachment.file.name || 'file')}]</p>` : ''
  })
  const richText = htmlToPlainText(plainTextHtml)
  progress.value = 100

  return {
    html: richHtml,
    text: richText,
    submittedAttachmentIds: [...uploads.keys()],
  }
}

function getPendingMediaIds(html: string): string[] {
  const ids: string[] = []
  for (const match of html.matchAll(PENDING_MEDIA_NODE_PATTERN)) {
    const id = match[1]
    if (id && !ids.includes(id))
      ids.push(id)
  }
  return ids
}

async function uploadPendingRichMediaAttachment(attachment: PendingPasteAttachment): Promise<RichMediaUpload> {
  let width: number | undefined
  let height: number | undefined
  if (attachment.kind === 'image') {
    try {
      const meta = await extractImageMeta(attachment.file)
      width = meta.width
      height = meta.height
    }
    catch {
      // Image dimensions only stabilize the rich-text frame; upload can continue without them.
    }
  }

  return {
    attachment,
    mxcUrl: await uploadMedia(attachment.file),
    width,
    height,
  }
}

function replacePendingMediaNodes(html: string, render: (id: string) => string): string {
  return html.replace(PENDING_MEDIA_NODE_PATTERN, (_match, id: string) => render(id))
}

function renderRichMediaUpload(upload: RichMediaUpload | undefined): string {
  if (!upload)
    return ''

  const name = escapeHtml(upload.attachment.file.name || 'file')
  const src = escapeHtml(upload.mxcUrl)
  if (upload.attachment.kind === 'image') {
    const width = upload.width ? ` data-width="${upload.width}"` : ''
    const height = upload.height ? ` data-height="${upload.height}"` : ''
    return `<p><img src="${src}" alt="${name}" title="${name}"${width}${height}></p>`
  }

  return `<p><a href="${src}">${name}</a></p>`
}

function revokePendingPasteAttachmentUrls(attachments: PendingPasteAttachment[]) {
  for (const attachment of attachments) {
    if (attachment.previewUrl)
      URL.revokeObjectURL(attachment.previewUrl)
  }
}

function revokeAllPendingPasteAttachmentUrls() {
  const urls = new Set<string>()
  for (const attachment of pendingPasteAttachments.value) {
    if (attachment.previewUrl)
      urls.add(attachment.previewUrl)
  }
  for (const attachments of pendingPasteAttachmentDrafts.values()) {
    for (const attachment of attachments) {
      if (attachment.previewUrl)
        urls.add(attachment.previewUrl)
    }
  }
  for (const url of urls)
    URL.revokeObjectURL(url)
  pendingPasteAttachmentDrafts.clear()
}

function onInput() {
  markComposeChanged()
  startTyping()
}

const showFormatBar = ref(false)
const showLinkEditor = shallowRef(false)
const linkUrl = shallowRef('')

function toggleFormatBar() {
  showFormatBar.value = !showFormatBar.value
}

function insertMention() {
  editor.value?.chain().focus().insertContent('@').run()
}

function focusEditor() {
  editor.value?.commands.focus()
}

function toggleLinkEditor() {
  const activeEditor = editor.value
  if (!activeEditor)
    return

  linkUrl.value = activeEditor.getAttributes('link').href as string | undefined || ''
  showLinkEditor.value = !showLinkEditor.value
}

function applyLink() {
  const activeEditor = editor.value
  if (!activeEditor)
    return

  const nextHref = linkUrl.value.trim()
  if (!nextHref) {
    activeEditor.chain().focus().extendMarkRange('link').unsetLink().run()
    showLinkEditor.value = false
    return
  }

  activeEditor.chain().focus().extendMarkRange('link').setLink({ href: nextHref }).run()
  showLinkEditor.value = false
}

function closeLinkEditor() {
  showLinkEditor.value = false
}

watch(
  () => store.currentRoomId,
  (newId, oldId) => {
    markComposeChanged()
    // 保存当前房间草稿
    if (oldId && editor.value) {
      const text = editor.value.getText().trim()
      if (text) {
        drafts.set(oldId, editor.value.getHTML())
      }
      else {
        drafts.delete(oldId)
      }

      if (pendingPasteAttachments.value.length) {
        pendingPasteAttachmentDrafts.set(oldId, pendingPasteAttachments.value)
      }
      else {
        pendingPasteAttachmentDrafts.delete(oldId)
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

    pendingPasteAttachments.value = newId
      ? pendingPasteAttachmentDrafts.get(newId) ?? []
      : []
    store.clearCompose()
    showExpressionPicker.value = false
    showLocationPicker.value = false
    showContactCardPicker.value = false
    postTitle.value = ''
  },
)

watch(
  () => [store.replyingTo, store.editingEvent],
  markComposeChanged,
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
  revokeAllPendingPasteAttachmentUrls()
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
    <div v-if="!editorExpanded" data-testid="compact-composer" class="flex items-center gap-0 rounded-lg bg-input" @input="onInput">
      <!-- 左侧: + 附件按钮 -->
      <div class="flex h-10 items-center shrink-0 pl-1">
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
              :class="editor.isActive('underline') && 'bg-primary text-primary-foreground hover:opacity-90'"
              :title="t('chat.format_underline')"
              @click="editor.chain().focus().toggleUnderline().run()"
            >
              <Underline :size="14" />
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
              <Braces :size="14" />
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
            <button
              class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
              :class="editor.isActive('link') && 'bg-primary text-primary-foreground hover:opacity-90'"
              :title="t('chat.format_link')"
              @click="toggleLinkEditor"
            >
              <Link2 :size="14" />
            </button>
            <form
              v-if="showLinkEditor"
              class="ml-1 flex h-8 items-center gap-0.5 rounded-md border border-border/60 bg-background px-1"
              @submit.prevent="applyLink"
            >
              <input
                v-model="linkUrl"
                class="h-6 w-40 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
                :placeholder="t('chat.format_link_prompt')"
                @keydown.stop
              >
              <button type="submit" class="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent">
                <Link2 :size="13" />
              </button>
              <button type="button" class="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent" @click="closeLinkEditor">
                <X :size="13" />
              </button>
            </form>
          </div>
        </Transition>

        <EditorContent
          v-if="editor"
          :editor="editor"
          class="rich-editor px-2 py-2 text-sm leading-6 outline-none transition-[max-height,min-height] duration-200 [&_.mention]:font-medium [&_.mention]:text-primary [&_.tiptap]:leading-6 [&_.tiptap]:outline-none [&_.tiptap_ol]:my-1 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_ul]:my-1 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_li]:pl-1 [&_.tiptap_p]:m-0 [&_.tiptap_p]:leading-6 [&_.tiptap_p.is-editor-empty:first-child]:before:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child]:before:float-left [&_.tiptap_p.is-editor-empty:first-child]:before:h-0 [&_.tiptap_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]"
          :class="editorHeightClass"
        />
      </div>

      <!-- 右侧: GIF / Sticker / Emoji — 简洁布局 -->
      <div ref="expressionTriggerRef" class="flex h-10 items-center shrink-0 gap-0 pr-1">
        <!-- @ 提及 -->
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          :title="t('chat.mention_btn')"
          @click="insertMention"
        >
          <AtSign :size="16" />
        </button>
        <!-- Aa 格式切换 — 仅当有内容或格式栏已展开时显示 -->
        <button
          v-if="showFormatBar || editor?.getText().trim()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
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
          class="inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent"
          :title="`${t('chat.gif')} / ${t('chat.sticker_btn')} / Emoji`"
          @click="onExpressionButtonClick"
        >
          <Smile :size="16" />
          <span class="text-[11px] font-semibold leading-none">GIF</span>
        </button>
        <!-- 展开/收起编辑器 -->
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
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
        <VoiceRecorder @send="handleVoiceSend" />
      </div>
    </div>

    <div
      v-else
      data-testid="expanded-composer"
      class="flex min-h-[420px] flex-col rounded-xl border border-border/70 bg-input shadow-sm"
      @input="onInput"
    >
      <div class="flex h-10 shrink-0 items-center justify-between px-3">
        <div
          v-if="editor"
          data-testid="expanded-format-toolbar"
          class="flex items-center gap-1 text-muted-foreground"
        >
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
            :class="editor.isActive('bold') && 'bg-primary text-primary-foreground hover:opacity-90'"
            :title="t('chat.format_bold')"
            @click="editor.chain().focus().toggleBold().run()"
          >
            <Bold :size="17" />
          </button>
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
            :class="editor.isActive('strike') && 'bg-primary text-primary-foreground hover:opacity-90'"
            :title="t('chat.format_strike')"
            @click="editor.chain().focus().toggleStrike().run()"
          >
            <Strikethrough :size="17" />
          </button>
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
            :class="editor.isActive('italic') && 'bg-primary text-primary-foreground hover:opacity-90'"
            :title="t('chat.format_italic')"
            @click="editor.chain().focus().toggleItalic().run()"
          >
            <Italic :size="17" />
          </button>
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
            :class="editor.isActive('underline') && 'bg-primary text-primary-foreground hover:opacity-90'"
            :title="t('chat.format_underline')"
            @click="editor.chain().focus().toggleUnderline().run()"
          >
            <Underline :size="17" />
          </button>
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
            :class="editor.isActive('orderedList') && 'bg-primary text-primary-foreground hover:opacity-90'"
            :title="t('chat.format_ol')"
            @click="editor.chain().focus().toggleOrderedList().run()"
          >
            <ListOrdered :size="17" />
          </button>
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
            :class="editor.isActive('bulletList') && 'bg-primary text-primary-foreground hover:opacity-90'"
            :title="t('chat.format_ul')"
            @click="editor.chain().focus().toggleBulletList().run()"
          >
            <List :size="17" />
          </button>
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
            :class="editor.isActive('blockquote') && 'bg-primary text-primary-foreground hover:opacity-90'"
            :title="t('chat.format_quote')"
            @click="editor.chain().focus().toggleBlockquote().run()"
          >
            <Quote :size="17" />
          </button>
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
            :class="editor.isActive('link') && 'bg-primary text-primary-foreground hover:opacity-90'"
            :title="t('chat.format_link')"
            @click="toggleLinkEditor"
          >
            <Link2 :size="17" />
          </button>
          <form
            v-if="showLinkEditor"
            class="ml-1 flex h-8 items-center gap-0.5 rounded-md border border-border/60 bg-background px-1"
            @submit.prevent="applyLink"
          >
            <input
              v-model="linkUrl"
              class="h-6 w-44 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
              :placeholder="t('chat.format_link_prompt')"
              @keydown.stop
            >
            <button type="submit" class="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent">
              <Link2 :size="13" />
            </button>
            <button type="button" class="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent" @click="closeLinkEditor">
              <X :size="13" />
            </button>
          </form>
          <button
            class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
            :class="editor.isActive('code') && 'bg-primary text-primary-foreground hover:opacity-90'"
            :title="t('chat.format_code')"
            @click="editor.chain().focus().toggleCode().run()"
          >
            <Braces :size="17" />
          </button>
        </div>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          :title="t('chat.collapse_editor')"
          @click="editorExpanded = false"
        >
          <Minimize2 :size="16" />
        </button>
      </div>

      <input
        v-model="postTitle"
        data-testid="expanded-composer-title"
        class="mx-4 h-9 shrink-0 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
        :placeholder="t('chat.post_title_placeholder')"
        @keydown.enter.prevent="focusEditor"
      >

      <div class="min-h-0 flex-1 px-2" @click="focusEditor">
        <EditorContent
          v-if="editor"
          :editor="editor"
          data-testid="rich-editor"
          class="rich-editor px-2 py-2 text-sm leading-6 outline-none transition-[max-height,min-height] duration-200 [&_.mention]:font-medium [&_.mention]:text-primary [&_.tiptap]:leading-6 [&_.tiptap]:outline-none [&_.tiptap_ol]:my-1 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_ul]:my-1 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_li]:pl-1 [&_.tiptap_p]:m-0 [&_.tiptap_p]:leading-6 [&_.tiptap_p.is-editor-empty:first-child]:before:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child]:before:float-left [&_.tiptap_p.is-editor-empty:first-child]:before:h-0 [&_.tiptap_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]"
          :class="editorHeightClass"
        />
      </div>

      <div
        ref="expressionTriggerRef"
        data-testid="expanded-action-bar"
        class="flex h-12 shrink-0 items-center justify-end gap-1 px-3 pb-2"
      >
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          :title="`${t('chat.gif')} / ${t('chat.sticker_btn')} / Emoji`"
          @click="openEmojiPicker"
        >
          <Smile :size="18" />
        </button>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          :title="t('chat.mention_btn')"
          @click="insertMention"
        >
          <AtSign :size="18" />
        </button>
        <ScreenshotButton @capture="uploadImage" />
        <AttachmentMenu
          trigger-icon="image"
          @image="uploadImage"
          @video="uploadVideo"
          @file="uploadFile"
          @sticker="toggleStickerPicker"
          @location="toggleLocationPicker"
          @gif="toggleGifPicker"
          @contact-card="toggleContactCardPicker"
        />
        <button
          data-testid="expanded-send"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
          :title="t('chat.send')"
          @click="submitEditor"
        >
          <SendHorizontal :size="19" />
        </button>
        <div class="mx-1 h-5 w-px bg-border" />
        <button
          class="inline-flex h-8 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          :title="t('chat.action_more')"
        >
          <ChevronDown :size="14" />
        </button>
      </div>
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
