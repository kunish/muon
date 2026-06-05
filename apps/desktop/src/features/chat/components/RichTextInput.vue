<script setup lang="ts">
import type { MentionPopupState, PastedMediaSource } from '@muon/rich-text/editor';
import type { ImageSticker } from '@/shared/data/stickerPacks';
import type { GifResult } from '@/shared/lib/gifSearch';
import { getClient } from '@matrix/client';
import {
  downloadMedia,
  editMessage,
  extractImageMeta,
  replyToMessage,
  sendAudioMessage,
  sendContactCard,
  sendGifMessage,
  sendImageStickerMessage,
  sendLocationMessage,
  sendStickerMessage,
  sendTextMessage,
  uploadMedia,
} from '@matrix/index';
import { useRichTextEditor } from '@muon/rich-text/editor';
import { htmlToPlainText } from '@muon/rich-text/markdown';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@muon/ui/dropdown-menu';
import { useSelector } from '@tanstack/vue-store';
import { EditorContent } from '@tiptap/vue-3';
import { ALargeSmall, AtSign, ChevronDown, Maximize2, Minimize2, SendHorizontal, Smile } from 'lucide-vue-next';
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { captureScreen } from '@/desktop/screenshot';
import { escapeHtml } from '@/shared/lib/utils';
import { settingsStore } from '@/shared/stores/settingsStore';
import { useCurrentRoom } from '../composables/useCurrentRoom';
import { getFloatingPosition } from '../composables/useFloatingPosition';
import { useMediaUpload } from '../composables/useMediaUpload';
import { useMediaViewer } from '../composables/useMediaViewer';
import { useMention } from '../composables/useMention';
import { useTyping } from '../composables/useTyping';
import { useChatStore } from '../stores/chatStore';
import { schedule } from '../stores/scheduledMessageStore';
import AttachmentMenu from './AttachmentMenu.vue';
import ContactCardPicker from './ContactCardPicker.vue';
import ExpressionPicker from './ExpressionPicker.vue';
import LocationPicker from './LocationPicker.vue';
import MentionList from './MentionList.vue';
import ReplyPreviewBar from './ReplyPreviewBar.vue';
import RichTextToolbar from './RichTextToolbar.vue';
import ScreenshotButton from './ScreenshotButton.vue';
import StickerPackManager from './StickerPackManager.vue';
import UploadProgress from './UploadProgress.vue';
import VoiceRecorder from './VoiceRecorder.vue';

const store = useChatStore();
const sendMessageShortcut = useSelector(settingsStore, (s) => s.sendMessageShortcut);
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { startTyping, stopTyping } = useTyping();
const { openImage, openVideo } = useMediaViewer();
const { room } = useCurrentRoom();
const {
  uploading,
  progress,
  uploadImage,
  uploadVideo,
  uploadFile,
  stageFile,
  getUpload,
  waitForAll,
  removeUpload,
  clearUploads,
} = useMediaUpload(() => store.currentRoomId);
const { filterMembers } = useMention();

/** 附件菜单「截图」：抓屏后作为图片上传（与展开态 ScreenshotButton 行为一致） */
async function handleScreenshot() {
  try {
    const blob = await captureScreen();
    if (!blob) {
      toast.error(t('chat.screenshot_failed'));
      return;
    }
    uploadImage(new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' }));
  } catch {
    toast.error(t('chat.screenshot_failed'));
  }
}

// mention 弹窗状态
const mentionState = ref<MentionPopupState>({
  visible: false,
  items: [],
  selectedIndex: 0,
  clientRect: null,
  command: null,
});
const mentionListRef = ref<InstanceType<typeof MentionList>>();

// 计算 mention 弹窗位置
const mentionPopupStyle = computed(() => {
  const rect = mentionState.value.clientRect?.();
  if (!rect) return { display: 'none' };
  return {
    position: 'fixed' as const,
    left: `${rect.left}px`,
    top: `${rect.top - 8}px`,
    transform: 'translateY(-100%)',
    zIndex: '50',
  };
});

function onMentionSelect(item: { id: string; label: string }) {
  mentionState.value.command?.(item);
}

const placeholderText = computed(() => {
  const name = room.value?.name;
  return name ? t('chat.input_placeholder_channel', { name }) : t('chat.input_placeholder');
});

const editorExpanded = shallowRef(false);
const postTitle = shallowRef('');

interface PendingPasteAttachment {
  id: string;
  file: File;
  kind: 'image' | 'video' | 'file';
  previewUrl: string | null;
  /** Upload progress 0–100 when pre-upload is active */
  uploadProgress: number;
  /** Pre-uploaded mxcUrl (available before send click for 秒发) */
  preMxcUrl: string | null;
  /** Whether pre-upload has completed */
  preUploadDone: boolean;
}

const PENDING_MEDIA_NODE_PATTERN = /<(?:div|span)(?:\s[^>]*)?data-pending-media-id="([^"]+)"[^>]*>\s*<\/(?:div|span)>/g;
const ATTACHMENT_DRAFTS_STORAGE_KEY = 'muon_chat_attachment_drafts';
const MAX_STORED_ATTACHMENT_BYTES = 8 * 1024 * 1024;
let pendingPasteAttachmentId = 0;
let attachmentDraftPersistVersion = 0;
let pendingDraftRestoreRoomId: string | null = null;
const pendingPasteAttachments = shallowRef<PendingPasteAttachment[]>([]);
const pendingPasteAttachmentDrafts = new Map<string, PendingPasteAttachment[]>();

interface StoredAttachmentDraft {
  id: string;
  kind: 'image' | 'video' | 'file';
  fileName?: string;
  fileType?: string;
  dataUrl?: string;
  preMxcUrl?: string;
}

function getAttachmentDraftsStorageKey(): string | null {
  try {
    const userId = getClient().getUserId?.();
    return userId ? `${ATTACHMENT_DRAFTS_STORAGE_KEY}:${userId}` : null;
  } catch {
    return null;
  }
}

function loadAttachmentDraftsFromStorage() {
  try {
    const key = getAttachmentDraftsStorageKey();
    if (!key) return;

    const stored = localStorage.getItem(key);
    if (!stored) return;

    const parsed = JSON.parse(stored) as Record<string, StoredAttachmentDraft[]>;
    for (const [roomId, storedAttachments] of Object.entries(parsed)) {
      const attachments = storedAttachments
        .map(createPendingPasteAttachmentFromStoredDraft)
        .filter((attachment): attachment is PendingPasteAttachment => Boolean(attachment));

      if (attachments.length) pendingPasteAttachmentDrafts.set(roomId, attachments);
      if (attachments.length && !store.getDraftPreview(roomId))
        store.setDraftPreview(roomId, formatAttachmentDraftPreview(attachments));
    }
  } catch {
    // Attachment drafts are best-effort; bad storage should not block the composer.
  }
}

function createPendingPasteAttachmentFromStoredDraft(stored: StoredAttachmentDraft): PendingPasteAttachment | null {
  if (!stored.id || !stored.kind || (!stored.dataUrl && !stored.preMxcUrl)) return null;

  const fileName = stored.fileName || 'file';
  const fileType = stored.fileType || getDefaultMimeTypeForPendingKind(stored.kind);
  const file = stored.dataUrl
    ? createFileFromDataUrl(stored.dataUrl, fileName, fileType)
    : new File([], fileName, { type: fileType });
  if (!file) return null;

  return {
    id: stored.id,
    file,
    kind: stored.kind,
    previewUrl: stored.dataUrl ? createPendingPastePreviewUrl(file) : null,
    uploadProgress: stored.preMxcUrl ? 100 : 0,
    preMxcUrl: stored.preMxcUrl ?? null,
    preUploadDone: Boolean(stored.preMxcUrl),
  };
}

function getDefaultMimeTypeForPendingKind(kind: 'image' | 'video' | 'file'): string {
  if (kind === 'image') return 'image/png';
  if (kind === 'video') return 'video/mp4';
  return 'application/octet-stream';
}

function createFileFromDataUrl(dataUrl: string, fileName: string, fileType: string): File | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1 || typeof atob !== 'function') return null;

  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const mimeType = header.match(/^data:([^;]+)/)?.[1] || fileType;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: fileType || mimeType });
}

async function persistAttachmentDrafts(activeDraft?: { roomId: string; attachments: PendingPasteAttachment[] }) {
  try {
    const key = getAttachmentDraftsStorageKey();
    if (!key) return;
    const persistVersion = ++attachmentDraftPersistVersion;

    const draftEntries = new Map(pendingPasteAttachmentDrafts);
    if (activeDraft) {
      if (activeDraft.attachments.length) draftEntries.set(activeDraft.roomId, activeDraft.attachments);
      else draftEntries.delete(activeDraft.roomId);
    }

    const data: Record<string, StoredAttachmentDraft[]> = {};
    for (const [roomId, attachments] of draftEntries) {
      const storedAttachments = (await Promise.all(attachments.map(createStoredAttachmentDraft))).filter(
        (attachment): attachment is StoredAttachmentDraft => Boolean(attachment),
      );
      if (storedAttachments.length) data[roomId] = storedAttachments;
    }

    if (persistVersion !== attachmentDraftPersistVersion) return;

    if (Object.keys(data).length) localStorage.setItem(key, JSON.stringify(data));
    else localStorage.removeItem(key);
  } catch {
    // Storage quota or API failures should not interrupt composing.
  }
}

async function createStoredAttachmentDraft(attachment: PendingPasteAttachment): Promise<StoredAttachmentDraft | null> {
  const dataUrl =
    attachment.file.size > 0 && attachment.file.size <= MAX_STORED_ATTACHMENT_BYTES
      ? await readFileAsDataUrl(attachment.file)
      : null;
  const preMxcUrl = attachment.preMxcUrl ?? undefined;
  if (!dataUrl && !preMxcUrl) return null;

  return {
    id: attachment.id,
    kind: attachment.kind,
    fileName: attachment.file.name,
    fileType: attachment.file.type,
    dataUrl: dataUrl ?? undefined,
    preMxcUrl,
  };
}

function readFileAsDataUrl(file: File): Promise<string | null> {
  if (typeof FileReader === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

loadAttachmentDraftsFromStorage();
const hasPendingPasteAttachments = computed(() => pendingPasteAttachments.value.length > 0);
const editorShouldScroll = ref(false);
const editorHeightClass = computed(() => {
  if (editorExpanded.value) return 'overflow-y-auto min-h-[320px] max-h-[60vh] [&_.tiptap]:min-h-[304px]';

  if (hasPendingPasteAttachments.value) return 'overflow-y-auto min-h-[80px] max-h-[40vh] [&_.tiptap]:min-h-[64px]';

  if (!editorShouldScroll.value) return 'overflow-hidden min-h-[40px] max-h-[40vh] [&_.tiptap]:min-h-[24px]';

  return 'overflow-y-auto min-h-[40px] max-h-[40vh] [&_.tiptap]:min-h-[24px]';
});

const { editor, clear, insertEmoji, insertPendingMediaAttachment } = useRichTextEditor({
  placeholder: placeholderText,
  onSubmit: submitComposer,
  onPasteFiles: handlePasteFiles,
  onPasteMediaSources: handlePasteMediaSources,
  canSubmit: hasPendingPasteAttachments,
  pendingMedia: {
    getAttachment: (id: string) => pendingPasteAttachments.value.find((attachment) => attachment.id === id),
    onPreview: openPendingPasteAttachmentPreview,
    onRemove: removePendingPasteAttachment,
  },
  submitOnEnter: computed(() => !editorExpanded.value),
  submitShortcut: computed(() => sendMessageShortcut.value),
  mentionSearch: (query: string) => filterMembers(query),
  onMentionState: (state: MentionPopupState) => {
    mentionState.value = state;
  },
});

watch(
  editor,
  (instance, _prev, onCleanup) => {
    if (!instance) return;

    if (pendingDraftRestoreRoomId === store.currentRoomId)
      restoreRoomDraft(store.currentRoomId, { clearWhenMissing: false });

    const handler = () => {
      instance.commands.scrollIntoView();
      const html = instance.getHTML();
      syncPendingPasteAttachmentsFromEditor(html);
      saveCurrentRoomDraft();

      const dom = instance.view.dom as HTMLElement;
      const wrapper = dom.parentElement;
      if (!dom || !wrapper) return;

      const scrollH = dom.scrollHeight;
      const nowScrollable = scrollH > wrapper.clientHeight + 4;

      editorShouldScroll.value = nowScrollable;

      // Apply overflow via inline style (not CSS class) for synchronous DOM update.
      // CSS class changes happen async via Vue — too late for scroll-dimension reset.
      wrapper.style.overflowY = nowScrollable ? '' : 'hidden';
    };
    instance.on('update', handler);
    onCleanup(() => instance.off('update', handler));
  },
  { immediate: true },
);

type ExpressionTab = 'emoji' | 'gif' | 'sticker';

const showExpressionPicker = ref(false);
const expressionTab = ref<ExpressionTab>('emoji');
const expressionTriggerRef = ref<HTMLElement>();
const expressionPickerRef = ref<HTMLElement | null>(null);
const expressionPickerStyle = ref({ left: '0px', top: '0px' });
const activeExpressionAnchor = ref<HTMLElement | null>(null);
const prewarmExpressionPicker = ref(false);
let prewarmExpressionTimer = 0;

function positionExpressionPicker() {
  const trigger = activeExpressionAnchor.value || expressionTriggerRef.value;
  if (!trigger || !expressionPickerRef.value) return;
  expressionPickerStyle.value = getFloatingPosition(trigger, expressionPickerRef.value);
}

async function openExpressionPicker(tab: ExpressionTab, anchor?: HTMLElement | null) {
  prewarmExpressionPicker.value = true;

  if (showExpressionPicker.value && expressionTab.value === tab) {
    showExpressionPicker.value = false;
    return;
  }

  expressionTab.value = tab;
  activeExpressionAnchor.value = anchor ?? expressionTriggerRef.value ?? null;
  showExpressionPicker.value = true;
  await nextTick();
  positionExpressionPicker();
}

function onExpressionButtonClick(e: MouseEvent) {
  void openExpressionPicker(expressionTab.value, e.currentTarget as HTMLElement);
}

function openEmojiPicker(e: MouseEvent) {
  void openExpressionPicker('emoji', e.currentTarget as HTMLElement);
}

function toggleGifPicker() {
  void openExpressionPicker('gif');
}

async function handleGifSelect(gif: GifResult) {
  showExpressionPicker.value = false;
  const roomId = store.currentRoomId;
  if (!roomId) return;
  try {
    await sendGifMessage(roomId, gif.url, gif.width, gif.height);
  } catch {
    toast.error(t('chat.send_failed'));
  }
}

function handleEmojiSelect(emoji: string) {
  showExpressionPicker.value = false;
  insertEmoji(emoji);
}

const composeLabel = computed(() => {
  if (store.editingEvent) return t('chat.edit_label');
  return '';
});

const replyingToSenderName = computed(() => {
  const replyEvent = store.replyingTo;
  if (!replyEvent) return '';
  const senderId = replyEvent.getSender() || '';
  const roomId = store.currentRoomId;
  if (!roomId) return senderId;
  const room = getClient().getRoom(roomId);
  const member = room?.getMember(senderId);
  return member?.name || senderId;
});

const replyingToPreview = computed(() => {
  const replyEvent = store.replyingTo;
  if (!replyEvent) return '';
  const content = replyEvent.getContent() || {};
  const eventType = replyEvent.getType();
  const messageType = content.msgtype as string | undefined;

  if (eventType === 'm.sticker') return t('chat.sticker_btn');
  if (messageType === 'm.image') return t('chat.image');
  if (messageType === 'm.video') return t('chat.video');
  if (messageType === 'm.audio') return t('chat.voice_message');
  if (messageType === 'm.file') return t('chat.file');

  return content.body || t('chat.reply_label', { sender: replyingToSenderName.value });
});

async function jumpToReplyTarget() {
  const eventId = store.replyingTo?.getId();
  if (!eventId) return;
  await router.replace({
    query: {
      ...route.query,
      focusEventId: eventId,
    },
  });
}

const composeVersion = ref(0);
const sendInFlight = ref(false);

function markComposeChanged() {
  composeVersion.value += 1;
}

async function submitComposer(
  html: string,
  text: string,
  options?: { silent?: boolean; urgent?: boolean },
): Promise<boolean> {
  const hasText = text.trim().length > 0;
  if (!hasText && !hasPendingPasteAttachments.value) return false;

  if (!hasPendingPasteAttachments.value) return handleSend(html, text, options);

  if (sendInFlight.value) return false;

  const roomId = store.currentRoomId;
  if (!roomId) return false;

  sendInFlight.value = true;
  const editingEvent = store.editingEvent;
  const replyingTo = store.replyingTo;
  const submittedHtml = html;
  const submittedText = text.trim();
  const submittedComposeVersion = composeVersion.value;
  let richPayload: RichMediaSubmitPayload;

  try {
    richPayload = await createRichMediaSubmitPayload(html);
    if (!richPayload.html) return false;
    const result = await sendTextContent(roomId, richPayload.html, richPayload.text, editingEvent, replyingTo, options);
    if (!result.ok) return false;
  } catch {
    toast.error(t('chat.upload_failed'));
    return false;
  } finally {
    sendInFlight.value = false;
    uploading.value = false;
  }

  const editorTextUnchanged = editor.value?.getText().trim() === submittedText;
  const editorHtmlUnchanged = editor.value?.getHTML() === submittedHtml;
  const roomUnchanged = store.currentRoomId === roomId;
  const composeUnchanged = store.editingEvent === editingEvent && store.replyingTo === replyingTo;
  const composeVersionUnchanged = composeVersion.value === submittedComposeVersion;
  const canCleanSubmittedState =
    roomUnchanged && composeUnchanged && composeVersionUnchanged && editorTextUnchanged && editorHtmlUnchanged;

  const submittedAttachmentIds = new Set(richPayload.submittedAttachmentIds);
  const submittedAttachments = pendingPasteAttachments.value.filter((attachment) =>
    submittedAttachmentIds.has(attachment.id),
  );
  pendingPasteAttachments.value = pendingPasteAttachments.value.filter(
    (attachment) => !submittedAttachmentIds.has(attachment.id),
  );
  revokePendingPasteAttachmentUrls(submittedAttachments);
  if (store.getHtmlDraft(roomId) === submittedHtml) store.clearAllDrafts(roomId);
  if (roomId) {
    pendingPasteAttachmentDrafts.delete(roomId);
    void persistAttachmentDrafts({ roomId, attachments: pendingPasteAttachments.value });
  }
  if (canCleanSubmittedState) {
    clear();
    stopTyping();
    store.clearCompose();
  }
  markComposeChanged();

  return true;
}

async function handleSend(
  html: string,
  text: string,
  options?: { silent?: boolean; urgent?: boolean },
): Promise<boolean> {
  const roomId = store.currentRoomId;
  if (!roomId || !text.trim()) return false;
  if (sendInFlight.value) return false;
  sendInFlight.value = true;
  const editingEvent = store.editingEvent;
  const replyingTo = store.replyingTo;
  const submittedHtml = html;
  const submittedText = text.trim();
  const submittedComposeVersion = composeVersion.value;
  let sentPlainText = false;

  try {
    const result = await sendTextContent(roomId, html, text, editingEvent, replyingTo, options);
    if (!result.ok) return false;
    sentPlainText = result.sentPlainText;
  } catch {
    toast.error(t('chat.send_failed'));
    return false;
  } finally {
    sendInFlight.value = false;
  }

  const editorTextUnchanged = editor.value?.getText().trim() === submittedText;
  const editorHtmlUnchanged = editor.value?.getHTML() === submittedHtml;
  const roomUnchanged = store.currentRoomId === roomId;
  const composeUnchanged = store.editingEvent === editingEvent && store.replyingTo === replyingTo;
  const composeVersionUnchanged = composeVersion.value === submittedComposeVersion;
  const canCleanSubmittedState =
    roomUnchanged && composeUnchanged && composeVersionUnchanged && editorTextUnchanged && editorHtmlUnchanged;
  if (sentPlainText && store.getHtmlDraft(roomId) === submittedHtml) store.clearAllDrafts(roomId);
  if (canCleanSubmittedState) {
    clear();
    stopTyping();
    store.clearCompose();
  }

  return true;
}

async function sendTextContent(
  roomId: string,
  html: string,
  text: string,
  editingEvent: typeof store.editingEvent,
  replyingTo: typeof store.replyingTo,
  options?: { silent?: boolean; urgent?: boolean },
): Promise<{ ok: boolean; sentPlainText: boolean }> {
  try {
    if (editingEvent) {
      const eventId = editingEvent.getId();
      if (!eventId) {
        toast.error(t('chat.send_failed'));
        return { ok: false, sentPlainText: false };
      }
      await editMessage(roomId, eventId, text, html, options);
      return { ok: true, sentPlainText: false };
    }

    if (replyingTo) {
      const eventId = replyingTo.getId();
      if (!eventId) {
        toast.error(t('chat.send_failed'));
        return { ok: false, sentPlainText: false };
      }
      await replyToMessage(roomId, eventId, text, html, options);
      return { ok: true, sentPlainText: false };
    }

    await sendTextMessage(roomId, text, html, options);
    return { ok: true, sentPlainText: true };
  } catch {
    toast.error(t('chat.send_failed'));
    return { ok: false, sentPlainText: false };
  }
}

function createSubmitPayload(html: string, text: string) {
  const title = editorExpanded.value ? postTitle.value.trim() : '';
  if (!title) {
    return { html, text };
  }

  const titleHtml = `<p><strong>${escapeHtml(title)}</strong></p>`;
  const bodyText = text.trim();
  return {
    html: bodyText ? `${titleHtml}${html}` : titleHtml,
    text: bodyText ? `${title}\n\n${text}` : title,
  };
}

async function submitEditor(options?: { silent?: boolean; urgent?: boolean }) {
  const html = editor.value?.getHTML() || '';
  const text = editor.value?.getText() || '';
  const payload = createSubmitPayload(html, text);
  if (!store.currentRoomId || (!payload.text.trim() && !hasPendingPasteAttachments.value)) return;
  const submitted = await submitComposer(payload.html, payload.text, options);
  if (submitted) postTitle.value = '';
}

function submitEditorSilent() {
  void submitEditor({ silent: true });
}

function submitEditorUrgent() {
  void submitEditor({ urgent: true });
}

// ── 定时发送（客户端待发队列，到点由 useScheduledMessageFlush 发送） ──
const showSchedulePicker = ref(false);
const scheduleAt = ref('');

function toLocalDateTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function openSchedulePicker() {
  scheduleAt.value = toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000));
  showSchedulePicker.value = true;
}

function confirmSchedule() {
  const html = editor.value?.getHTML() || '';
  const text = editor.value?.getText() || '';
  const payload = createSubmitPayload(html, text);
  const sendAt = new Date(scheduleAt.value).getTime();
  if (!store.currentRoomId || !payload.text.trim() || !Number.isFinite(sendAt)) return;
  if (sendAt <= Date.now()) {
    toast.error(t('chat.schedule_past'));
    return;
  }
  schedule({ roomId: store.currentRoomId, body: payload.text, html: payload.html, sendAt });
  clear();
  stopTyping();
  store.clearCompose();
  showSchedulePicker.value = false;
  toast.success(t('chat.scheduled_toast'));
}

function toggleStickerPicker() {
  void openExpressionPicker('sticker');
}

async function handleStickerSelect(emoji: string, name: string) {
  showExpressionPicker.value = false;
  const roomId = store.currentRoomId;
  if (!roomId) return;
  try {
    await sendStickerMessage(roomId, emoji, name);
  } catch {
    toast.error(t('chat.send_failed'));
  }
}

async function handleImageStickerSelect(sticker: ImageSticker) {
  showExpressionPicker.value = false;
  const roomId = store.currentRoomId;
  if (!roomId) return;
  try {
    await sendImageStickerMessage(roomId, sticker.name, sticker.mxcUrl, {
      w: sticker.width,
      h: sticker.height,
      mimetype: sticker.mimetype,
      size: sticker.size,
    });
  } catch {
    toast.error(t('chat.send_failed'));
  }
}

const showStickerManager = ref(false);

function openStickerManager() {
  showExpressionPicker.value = false;
  showStickerManager.value = true;
}

const showLocationPicker = ref(false);
const showContactCardPicker = ref(false);

function toggleLocationPicker() {
  showLocationPicker.value = !showLocationPicker.value;
}

function toggleContactCardPicker() {
  showContactCardPicker.value = !showContactCardPicker.value;
}

async function handleContactCardSelect(contact: { userId: string; displayName: string; avatarUrl?: string }) {
  showContactCardPicker.value = false;
  const roomId = store.currentRoomId;
  if (!roomId) return;
  try {
    await sendContactCard(roomId, contact.userId, contact.displayName, contact.avatarUrl);
  } catch {
    toast.error(t('chat.send_failed'));
  }
}

async function handleLocationSelect(payload: { latitude: number; longitude: number; description: string }) {
  showLocationPicker.value = false;
  const roomId = store.currentRoomId;
  if (!roomId) return;
  try {
    await sendLocationMessage(roomId, payload.latitude, payload.longitude, payload.description || undefined);
  } catch {
    toast.error(t('chat.send_failed'));
  }
}

async function handleVoiceSend(blob: Blob, duration: number) {
  const roomId = store.currentRoomId;
  if (!roomId) return;
  try {
    await sendAudioMessage(roomId, blob, duration);
  } catch {
    toast.error(t('chat.send_failed'));
  }
}

function handlePasteFiles(files: File[]) {
  stagePasteFiles(files, { insert: true });
}

// 供 ChatWindow 的拖拽落点复用同一套文件暂存/发送逻辑
defineExpose({ acceptDroppedFiles: handlePasteFiles });

function stagePasteFiles(files: File[], options: { insert: boolean }): string[] {
  if (!files.length) return [];

  const attachments = files.map((file) => ({
    id: `paste-${Date.now()}-${pendingPasteAttachmentId++}`,
    file,
    kind: getPendingPasteAttachmentKind(file),
    previewUrl: createPendingPastePreviewUrl(file),
    uploadProgress: 0,
    preMxcUrl: null,
    preUploadDone: false,
  }));

  pendingPasteAttachments.value = [...pendingPasteAttachments.value, ...attachments];
  if (options.insert) {
    for (const attachment of attachments) insertPendingMediaAttachment(attachment.id);
  }

  // 秒发: start pre-upload immediately
  for (const attachment of attachments) kickoffPreUpload(attachment);

  const roomId = store.currentRoomId;
  if (roomId) void persistAttachmentDrafts({ roomId, attachments: pendingPasteAttachments.value });

  markComposeChanged();
  return attachments.map((attachment) => attachment.id);
}

/** Start pre-upload as soon as file is staged — core of 秒发 mechanism */
function kickoffPreUpload(attachment: PendingPasteAttachment) {
  stageFile(attachment.id, attachment.file).then((upload) => {
    const attachmentIndex = pendingPasteAttachments.value.findIndex((a) => a.id === attachment.id);
    if (attachmentIndex === -1) return;

    const updated = { ...pendingPasteAttachments.value[attachmentIndex] };
    updated.uploadProgress = upload.progress;
    updated.preMxcUrl = upload.mxcUrl;
    updated.preUploadDone = upload.status === 'done';
    pendingPasteAttachments.value[attachmentIndex] = updated;

    // Watch for progress updates via polling (the uploadManager emits events)
    const pollInterval = setInterval(() => {
      const u = getUpload(attachment.id);
      if (!u) {
        clearInterval(pollInterval);
        return;
      }

      const idx = pendingPasteAttachments.value.findIndex((a) => a.id === attachment.id);
      if (idx === -1) {
        clearInterval(pollInterval);
        return;
      }

      pendingPasteAttachments.value[idx] = {
        ...pendingPasteAttachments.value[idx],
        uploadProgress: u.progress,
        preMxcUrl: u.mxcUrl,
        preUploadDone: u.status === 'done',
      };

      if (u.status === 'done') {
        const roomId = store.currentRoomId;
        if (roomId) void persistAttachmentDrafts({ roomId, attachments: pendingPasteAttachments.value });
      }

      if (u.status === 'done' || u.status === 'error') clearInterval(pollInterval);
    }, 200);
  });
}

async function handlePasteMediaSources(sources: PastedMediaSource[]): Promise<string[]> {
  if (!sources.length) return [];

  const files = await Promise.all(sources.map((source) => createFileFromPastedMediaSource(source)));
  return stagePasteFiles(
    files.filter((file): file is File => Boolean(file)),
    { insert: false },
  );
}

async function createFileFromPastedMediaSource(source: PastedMediaSource): Promise<File | null> {
  try {
    const blob = await getPastedMediaBlob(source.src);
    const type = getPastedMediaFileType(source, blob);
    return new File([blob], source.name, { type });
  } catch {
    return null;
  }
}

async function getPastedMediaBlob(src: string): Promise<Blob> {
  if (src.startsWith('mxc://')) return downloadMedia(src);

  const response = await fetch(src);
  if (!response.ok) throw new Error('Failed to fetch pasted media');
  return response.blob();
}

function getPastedMediaFileType(source: PastedMediaSource, blob: Blob): string {
  if (source.kind === 'image')
    return blob.type.startsWith('image/') ? blob.type : getMimeTypeFromFileName(source.name) || 'image/png';
  if (source.kind === 'video')
    return blob.type.startsWith('video/') ? blob.type : getMimeTypeFromFileName(source.name) || 'video/mp4';
  return blob.type || getMimeTypeFromFileName(source.name) || 'application/octet-stream';
}

function getMimeTypeFromFileName(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'avif':
      return 'image/avif';
    case 'gif':
      return 'image/gif';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    default:
      return '';
  }
}

function removePendingPasteAttachment(id: string) {
  const removedAttachment = pendingPasteAttachments.value.find((attachment) => attachment.id === id);
  pendingPasteAttachments.value = pendingPasteAttachments.value.filter((attachment) => attachment.id !== id);
  if (removedAttachment) revokePendingPasteAttachmentUrls([removedAttachment]);
  removeUpload(id);
  const roomId = store.currentRoomId;
  if (roomId) void persistAttachmentDrafts({ roomId, attachments: pendingPasteAttachments.value });
  markComposeChanged();
}

function syncPendingPasteAttachmentsFromEditor(html: string) {
  if (!pendingPasteAttachments.value.length) return;

  const visibleIds = new Set(getPendingMediaIds(html));
  const removedAttachments = pendingPasteAttachments.value.filter((attachment) => !visibleIds.has(attachment.id));
  if (!removedAttachments.length) return;

  pendingPasteAttachments.value = pendingPasteAttachments.value.filter((attachment) => visibleIds.has(attachment.id));
  revokePendingPasteAttachmentUrls(removedAttachments);
  for (const attachment of removedAttachments) removeUpload(attachment.id);
  const roomId = store.currentRoomId;
  if (roomId) void persistAttachmentDrafts({ roomId, attachments: pendingPasteAttachments.value });
  markComposeChanged();
}

function openPendingPasteAttachmentPreview(attachment: Pick<PendingPasteAttachment, 'kind' | 'previewUrl'>) {
  if (!attachment.previewUrl) return;
  if (attachment.kind === 'image') {
    openImage(attachment.previewUrl);
    return;
  }
  if (attachment.kind === 'video') openVideo(attachment.previewUrl);
}

function getPendingPasteAttachmentKind(file: File): 'image' | 'video' | 'file' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}

function createPendingPastePreviewUrl(file: File): string | null {
  const kind = getPendingPasteAttachmentKind(file);
  if (kind === 'file' || typeof URL.createObjectURL !== 'function') return null;
  return URL.createObjectURL(file);
}

interface RichMediaUpload {
  attachment: PendingPasteAttachment;
  mxcUrl: string;
  width?: number;
  height?: number;
  /** True if the URL came from pre-upload (already uploaded before send click) */
  fromPreUpload: boolean;
}

interface RichMediaSubmitPayload {
  html: string;
  text: string;
  submittedAttachmentIds: string[];
}

async function createRichMediaSubmitPayload(html: string): Promise<RichMediaSubmitPayload> {
  const attachmentsById = new Map(pendingPasteAttachments.value.map((attachment) => [attachment.id, attachment]));
  const mediaIds = getPendingMediaIds(html).filter((id) => attachmentsById.has(id));
  if (!mediaIds.length) {
    return {
      html,
      text: htmlToPlainText(html),
      submittedAttachmentIds: [],
    };
  }

  // 秒发: check which uploads are already done from pre-upload
  const preDoneIds = mediaIds.filter((id) => {
    const a = attachmentsById.get(id);
    return a && a.preUploadDone && a.preMxcUrl;
  });

  uploading.value = true;
  progress.value = 0;

  // Wait for any still-in-progress uploads
  if (preDoneIds.length < mediaIds.length) {
    const pendingIds = mediaIds.filter((id) => !preDoneIds.includes(id));
    await waitForAll(pendingIds);
  }

  const uploads = new Map<string, RichMediaUpload>();
  for (const [index, id] of mediaIds.entries()) {
    const attachment = attachmentsById.get(id);
    if (!attachment) continue;

    // Use pre-uploaded URL if available
    if (attachment.preUploadDone && attachment.preMxcUrl) {
      let meta = { width: 0, height: 0 };
      if (attachment.kind === 'image') {
        try {
          meta = await extractImageMeta(attachment.file);
        } catch {
          // continue without dimensions
        }
      }
      uploads.set(id, {
        attachment,
        mxcUrl: attachment.preMxcUrl,
        width: meta.width,
        height: meta.height,
        fromPreUpload: true,
      });
    } else {
      // Fallback: upload now (shouldn't normally happen if pre-upload works)
      uploads.set(id, await uploadPendingRichMediaAttachment(attachment));
    }

    progress.value = Math.round(((index + 1) / mediaIds.length) * 90);
  }

  const richHtml = replacePendingMediaNodes(html, (id) => renderRichMediaUpload(uploads.get(id)));
  const plainTextHtml = replacePendingMediaNodes(html, (id) => {
    const attachment = uploads.get(id)?.attachment;
    return attachment ? `<p>[${escapeHtml(attachment.file.name || 'file')}]</p>` : '';
  });
  const richText = htmlToPlainText(plainTextHtml);
  progress.value = 100;

  return {
    html: richHtml,
    text: richText,
    submittedAttachmentIds: [...uploads.keys()],
  };
}

function getPendingMediaIds(html: string): string[] {
  const ids: string[] = [];
  for (const match of html.matchAll(PENDING_MEDIA_NODE_PATTERN)) {
    const id = match[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function uploadPendingRichMediaAttachment(attachment: PendingPasteAttachment): Promise<RichMediaUpload> {
  let width: number | undefined;
  let height: number | undefined;
  if (attachment.kind === 'image') {
    try {
      const meta = await extractImageMeta(attachment.file);
      width = meta.width;
      height = meta.height;
    } catch {
      // Image dimensions only stabilize the rich-text frame; upload can continue without them.
    }
  }

  return {
    attachment,
    mxcUrl: await uploadMedia(attachment.file),
    width,
    height,
    fromPreUpload: false,
  };
}

function replacePendingMediaNodes(html: string, render: (id: string) => string): string {
  return html.replace(PENDING_MEDIA_NODE_PATTERN, (_match, id: string) => render(id));
}

function renderRichMediaUpload(upload: RichMediaUpload | undefined): string {
  if (!upload) return '';

  const name = escapeHtml(upload.attachment.file.name || 'file');
  const src = escapeHtml(upload.mxcUrl);
  if (upload.attachment.kind === 'image') {
    const width = upload.width ? ` data-width="${upload.width}"` : '';
    const height = upload.height ? ` data-height="${upload.height}"` : '';
    return `<p><img src="${src}" alt="${name}" title="${name}"${width}${height}></p>`;
  }

  return `<p><a href="${src}">${name}</a></p>`;
}

function revokePendingPasteAttachmentUrls(attachments: PendingPasteAttachment[]) {
  for (const attachment of attachments) {
    if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  }
}

function revokeAllPendingPasteAttachmentUrls() {
  const urls = new Set<string>();
  for (const attachment of pendingPasteAttachments.value) {
    if (attachment.previewUrl) urls.add(attachment.previewUrl);
  }
  for (const attachments of pendingPasteAttachmentDrafts.values()) {
    for (const attachment of attachments) {
      if (attachment.previewUrl) urls.add(attachment.previewUrl);
    }
  }
  for (const url of urls) URL.revokeObjectURL(url);
  pendingPasteAttachmentDrafts.clear();
}

function saveRoomDraft(roomId: string, text: string, html: string, attachments: PendingPasteAttachment[]) {
  if (text || attachments.length) {
    store.setHtmlDraft(roomId, html);
    store.setDraft(roomId, text);
    store.setDraftPreview(roomId, text || formatAttachmentDraftPreview(attachments));
  } else {
    store.clearAllDrafts(roomId);
  }
  void persistAttachmentDrafts({ roomId, attachments });
}

function formatAttachmentDraftPreview(attachments: PendingPasteAttachment[]) {
  return attachments
    .map((attachment) => attachment.file.name || getPendingPasteAttachmentLabel(attachment.kind))
    .join(', ');
}

function getPendingPasteAttachmentLabel(kind: PendingPasteAttachment['kind']) {
  if (kind === 'image') return t('chat.image');
  if (kind === 'video') return t('chat.video');
  return t('chat.file');
}

function saveCurrentRoomDraft() {
  const roomId = store.currentRoomId;
  const activeEditor = editor.value;
  if (!roomId || !activeEditor) return;

  saveRoomDraft(roomId, activeEditor.getText().trim(), activeEditor.getHTML(), pendingPasteAttachments.value);
}

function onInput() {
  markComposeChanged();
  startTyping();
  saveCurrentRoomDraft();
}

const showFormatBar = ref(false);

function toggleFormatBar() {
  showFormatBar.value = !showFormatBar.value;
}

function insertMention() {
  editor.value?.chain().focus().insertContent('@').run();
}

function insertQueuedMentions() {
  const activeEditor = editor.value;
  if (!activeEditor || store.pendingMentionRequests.length === 0) return;

  const mentions = store.consumePendingMentionRequests();
  for (const mention of mentions) {
    activeEditor
      .chain()
      .focus()
      .insertContent([
        { type: 'mention', attrs: { id: mention.id, label: mention.label } },
        { type: 'text', text: ' ' },
      ])
      .run();
  }
  markComposeChanged();
  startTyping();
}

function focusEditor() {
  editor.value?.commands.focus();
}

function restoreRoomDraft(roomId: string | null, options: { clearWhenMissing: boolean }) {
  const savedHtml = roomId ? store.getHtmlDraft(roomId) : '';
  pendingPasteAttachments.value = roomId && savedHtml ? (pendingPasteAttachmentDrafts.get(roomId) ?? []) : [];
  if (savedHtml) {
    if (editor.value) {
      editor.value.commands.setContent(savedHtml);
      pendingDraftRestoreRoomId = null;
    } else {
      pendingDraftRestoreRoomId = roomId;
    }
  } else {
    pendingDraftRestoreRoomId = null;
    if (options.clearWhenMissing) clear();
  }
}

watch(
  () => store.currentRoomId,
  (newId, oldId) => {
    const isInitialRun = oldId === undefined;
    markComposeChanged();
    // 保存当前房间草稿
    if (oldId && editor.value) {
      const text = editor.value.getText().trim();
      const html = editor.value.getHTML();
      saveRoomDraft(oldId, text, html, pendingPasteAttachments.value);

      if (pendingPasteAttachments.value.length) {
        pendingPasteAttachmentDrafts.set(oldId, pendingPasteAttachments.value);
      } else {
        pendingPasteAttachmentDrafts.delete(oldId);
      }
    }

    if (!isInitialRun) {
      // Clean up pre-uploads from the old room
      for (const a of pendingPasteAttachments.value) removeUpload(a.id);
      clearUploads();
    }

    // 恢复目标房间草稿或清空
    restoreRoomDraft(newId, { clearWhenMissing: !isInitialRun });
    if (!isInitialRun) {
      store.clearCompose();
      showExpressionPicker.value = false;
      showLocationPicker.value = false;
      showContactCardPicker.value = false;
      postTitle.value = '';
    }
  },
  { immediate: true },
);

watch(() => [store.replyingTo, store.editingEvent], markComposeChanged);

watch([editor, () => store.pendingMentionRequests.length], insertQueuedMentions, { flush: 'post' });

watch(
  () => store.editingEvent,
  (ev) => {
    if (ev) {
      const body = ev.getContent()?.body || '';
      editor.value?.commands.setContent(body);
      editor.value?.commands.focus('end');
    }
  },
);

function onWindowResize() {
  if (showExpressionPicker.value) {
    positionExpressionPicker();
  }
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (!editor.value || editor.value.isFocused) return;
  const target = e.target as HTMLElement;
  if (!target) return;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (store.multiSelectMode) return;
  if (e.key.length !== 1) return;
  e.preventDefault();
  focusEditor();
  editor.value.commands.insertContent(e.key);
}

function getPastedFiles(dt: DataTransfer): File[] {
  const files = Array.from(dt.files);
  if (files.length) return files;
  return Array.from(dt.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((f): f is File => !!f);
}

const CLIPBOARD_MEDIA_SELECTOR = 'img, video, audio, source, picture, canvas, iframe, object, embed';

function extractHtmlMediaSources(html: string): PastedMediaSource[] {
  if (!html || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sources: PastedMediaSource[] = [];
  for (const [index, img] of Array.from(doc.body.querySelectorAll<HTMLImageElement>('img[src]')).entries()) {
    const src = img.getAttribute('data-rich-media-mxc-src')?.trim() || img.getAttribute('src')?.trim() || '';
    if (!src) continue;
    const name = img.getAttribute('alt')?.trim() || img.getAttribute('title')?.trim() || 'image.png';
    sources.push({
      index,
      src,
      name: name.includes('.') ? name : `${name}.png`,
      kind: 'image',
    });
  }
  return sources;
}

function stripMediaElements(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll(CLIPBOARD_MEDIA_SELECTOR).forEach((el) => el.remove());
  return doc.body.innerHTML.trim();
}

function onGlobalPaste(e: ClipboardEvent) {
  if (!editor.value || editor.value.isFocused) return;
  const target = e.target as HTMLElement;
  if (!target) return;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
  if (store.multiSelectMode) return;

  const dt = e.clipboardData;
  if (!dt) return;

  const files = getPastedFiles(dt);
  if (files.length) {
    e.preventDefault();
    focusEditor();
    handlePasteFiles(files);
    return;
  }

  const html = dt.getData('text/html');
  const mediaSources = extractHtmlMediaSources(html);
  if (mediaSources.length) {
    e.preventDefault();
    focusEditor();
    void handlePasteMediaSources(mediaSources).then(() => {
      if (!editor.value) return;
      const stripped = stripMediaElements(html);
      if (stripped) {
        editor.value.commands.insertContent(stripped);
      }
    });
    return;
  }

  e.preventDefault();
  focusEditor();
  if (html) {
    editor.value.commands.insertContent(html);
  } else {
    const text = dt.getData('text/plain');
    if (text) {
      editor.value.commands.insertContent(text);
    }
  }
}

onMounted(() => {
  prewarmExpressionTimer = window.setTimeout(() => {
    prewarmExpressionPicker.value = true;
  }, 220);
  window.addEventListener('resize', onWindowResize);
  document.addEventListener('keydown', onGlobalKeydown);
  document.addEventListener('paste', onGlobalPaste);
});

onUnmounted(() => {
  clearTimeout(prewarmExpressionTimer);
  window.removeEventListener('resize', onWindowResize);
  document.removeEventListener('keydown', onGlobalKeydown);
  document.removeEventListener('paste', onGlobalPaste);
  revokeAllPendingPasteAttachmentUrls();
  clearUploads();
});
</script>

<template>
  <div class="px-4 pb-4">
    <UploadProgress :progress="progress" :visible="uploading" />
    <!-- 回复/编辑 指示栏 -->
    <ReplyPreviewBar
      :replying-to-sender-name="replyingToSenderName"
      :replying-to-preview="replyingToPreview"
      :compose-label="composeLabel"
      :is-replying="!!store.replyingTo"
      @clear="
        store.clearCompose();
        clear();
      "
      @jump-to-reply-target="jumpToReplyTarget"
    />

    <!-- 主输入容器 -->
    <div
      v-if="!editorExpanded"
      data-testid="compact-composer"
      class="flex flex-col rounded-lg bg-input"
      @input="onInput"
    >
      <!-- 顶部：编辑区（含可选格式栏） -->
      <div class="min-w-0">
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
            <RichTextToolbar :editor="editor" variant="compact" />
          </div>
        </Transition>

        <EditorContent
          v-if="editor"
          :editor="editor"
          class="rich-editor px-2 py-2 text-sm leading-6 outline-none transition-[max-height,min-height] duration-200 [&_.mention]:font-medium [&_.mention]:text-primary [&_.tiptap]:leading-6 [&_.tiptap]:outline-none [&_.tiptap_ol]:my-0 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_ul]:my-0 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_li]:leading-6 [&_.tiptap_li]:pl-1 [&_.tiptap_p]:m-0 [&_.tiptap_p]:leading-6 [&_.tiptap_p.is-editor-empty:first-child]:before:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child]:before:float-left [&_.tiptap_p.is-editor-empty:first-child]:before:h-0 [&_.tiptap_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]"
          :class="editorHeightClass"
        />
      </div>

      <!-- 底部：action row（+ 在左，@ Aa GIF 展开 麦克风 在右） -->
      <div class="flex h-10 shrink-0 items-center justify-between px-1">
        <div class="flex items-center">
          <AttachmentMenu
            @image="uploadImage"
            @video="uploadVideo"
            @file="uploadFile"
            @sticker="toggleStickerPicker"
            @location="toggleLocationPicker"
            @gif="toggleGifPicker"
            @contact-card="toggleContactCardPicker"
            @screenshot="handleScreenshot"
          />
        </div>
        <div ref="expressionTriggerRef" class="flex items-center shrink-0 gap-0">
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
            :class="showFormatBar ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'"
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
            data-testid="toggle-editor-expanded"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            :title="editorExpanded ? t('chat.collapse_editor') : t('chat.expand_editor')"
            @click="editorExpanded = !editorExpanded"
          >
            <Minimize2 v-if="editorExpanded" :size="16" />
            <Maximize2 v-else :size="16" />
          </button>
          <VoiceRecorder @send="handleVoiceSend" />
        </div>
      </div>
    </div>

    <div
      v-else
      data-testid="expanded-composer"
      class="flex min-h-[420px] flex-col rounded-xl border border-border/70 bg-input shadow-sm"
      @input="onInput"
    >
      <div class="flex h-10 shrink-0 items-center justify-between px-3">
        <div v-if="editor" data-testid="expanded-format-toolbar" class="flex items-center gap-1 text-muted-foreground">
          <RichTextToolbar :editor="editor" variant="expanded" />
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
      />

      <div class="min-h-0 flex-1 px-2" @click="focusEditor">
        <EditorContent
          v-if="editor"
          :editor="editor"
          data-testid="rich-editor"
          class="rich-editor px-2 py-2 text-sm leading-6 outline-none transition-[max-height,min-height] duration-200 [&_.mention]:font-medium [&_.mention]:text-primary [&_.tiptap]:leading-6 [&_.tiptap]:outline-none [&_.tiptap_ol]:my-0 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_ul]:my-0 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_li]:leading-6 [&_.tiptap_li]:pl-1 [&_.tiptap_p]:m-0 [&_.tiptap_p]:leading-6 [&_.tiptap_p.is-editor-empty:first-child]:before:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child]:before:float-left [&_.tiptap_p.is-editor-empty:first-child]:before:h-0 [&_.tiptap_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]"
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
          @screenshot="handleScreenshot"
        />
        <button
          data-testid="expanded-send"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
          :title="t('chat.send')"
          @click="() => submitEditor()"
        >
          <SendHorizontal :size="19" />
        </button>
        <div class="mx-1 h-5 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              data-testid="expanded-send-more-trigger"
              class="inline-flex h-8 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              :title="t('chat.action_more')"
            >
              <ChevronDown :size="14" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-testid="expanded-send-silent" @click="submitEditorSilent">
              {{ t('chat.send_silent') }}
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="expanded-send-urgent" @click="submitEditorUrgent">
              {{ t('chat.send_urgent') }}
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="expanded-send-scheduled" @click="openSchedulePicker">
              {{ t('chat.send_scheduled') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div
          v-if="showSchedulePicker"
          class="absolute bottom-12 right-2 z-50 w-64 rounded-md border border-border bg-popover p-3 shadow-lg"
          data-testid="schedule-picker"
        >
          <label class="mb-1 block text-[11px] font-medium text-muted-foreground">{{
            t('chat.schedule_at_label')
          }}</label>
          <input
            v-model="scheduleAt"
            data-testid="schedule-at-input"
            type="datetime-local"
            class="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
          />
          <div class="mt-2 flex justify-end gap-2">
            <button
              class="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent"
              @click="showSchedulePicker = false"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              data-testid="schedule-confirm"
              class="h-7 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
              @click="confirmSchedule"
            >
              {{ t('chat.schedule_confirm') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mention 弹窗 -->
    <Teleport to="body">
      <div v-if="mentionState.visible && mentionState.items.length > 0" :style="mentionPopupStyle">
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
        :style="
          showExpressionPicker
            ? { left: expressionPickerStyle.left, top: expressionPickerStyle.top }
            : { left: '-99999px', top: '-99999px' }
        "
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
      <div v-if="showExpressionPicker" class="fixed inset-0 z-40" @click="showExpressionPicker = false" />
    </Teleport>
    <!-- 贴纸包管理器 -->
    <StickerPackManager v-if="showStickerManager" @close="showStickerManager = false" />
    <!-- 位置选择面板 -->
    <Teleport to="body">
      <div
        v-if="showLocationPicker"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
        @click.self="showLocationPicker = false"
      >
        <LocationPicker @select="handleLocationSelect" @close="showLocationPicker = false" />
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
