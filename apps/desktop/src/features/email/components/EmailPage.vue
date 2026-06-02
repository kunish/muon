<script setup lang="ts">
import { useStorage } from '@vueuse/core';
import {
  Archive,
  Inbox,
  Mail,
  PencilLine,
  RefreshCw,
  Reply,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
} from 'lucide-vue-next';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue';
import { fetchInbox, isMailBridgeAvailable, sendMail } from '@/desktop/mail';
import { useMailAccountStore } from '@/features/email/stores/mailAccountStore';
import { useContactList } from '@/shared/composables/useContactList';

const { t } = useI18n();
const contactList = useContactList();
const mailAccount = useMailAccountStore();

// ── 邮箱账号配置（真实 SMTP/IMAP） ──
const accountPanelOpen = shallowRef(false);
const refreshing = shallowRef(false);
const sending = shallowRef(false);
const composeTo = shallowRef('');
const accountForm = ref({
  user: '',
  password: '',
  smtpHost: '',
  smtpPort: 465,
  smtpSecure: true,
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
});

function openAccountPanel(): void {
  if (mailAccount.account) accountForm.value = { ...mailAccount.account };
  accountPanelOpen.value = true;
}

async function saveAccount(): Promise<void> {
  await mailAccount.save({ ...accountForm.value });
  accountPanelOpen.value = false;
  toast.success(t('email.account_saved'));
}

const EMAIL_WIDTH_STORAGE_KEY = 'muon_email_sidebar_width';
const DEFAULT_EMAIL_WIDTH = 240;
const MIN_EMAIL_WIDTH = 220;
const MAX_EMAIL_WIDTH = 340;

const activeFolder = shallowRef('inbox');
const resizeLabel = computed(() => t('sidebar.resize_email'));

const searchQuery = shallowRef('');
const selectedMessageId = shallowRef('mail-1');
const messageActionNotices = shallowRef<Record<string, string>>({});
const replyDraftSubjects = shallowRef<Record<string, string>>({});
const composeOpen = shallowRef(false);
const composeDraftId = shallowRef('');
const composeSubject = shallowRef('');
const composeBody = shallowRef('');

interface EmailMessage {
  id: string;
  folder: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  starred?: boolean;
  to?: string;
}

/** Persisted per-message state so read/star/archive/trash survive reloads. */
interface EmailOverride {
  read?: boolean;
  starred?: boolean;
  archived?: boolean;
  trashed?: boolean;
}

const EMAIL_OVERRIDES_STORAGE_KEY = 'muon_email_overrides';
const emailOverrides = useStorage<Record<string, EmailOverride>>(EMAIL_OVERRIDES_STORAGE_KEY, {});

function overriddenFolder(message: EmailMessage, override: EmailOverride): string {
  if (override.trashed) return 'trash';
  if (override.archived) return 'archive';
  return message.folder;
}

function applyEmailOverrides(list: EmailMessage[]): EmailMessage[] {
  return list.map((message) => {
    const override = emailOverrides.value[message.id];
    if (!override) return message;
    return {
      ...message,
      unread: override.read ? false : message.unread,
      starred: override.starred ?? message.starred,
      folder: overriddenFolder(message, override),
    };
  });
}

function setEmailOverride(id: string, patch: EmailOverride): void {
  emailOverrides.value = {
    ...emailOverrides.value,
    [id]: { ...emailOverrides.value[id], ...patch },
  };
}

const folderConfig = computed(() => [
  { id: 'inbox', label: t('email.folder_inbox'), icon: Inbox },
  { id: 'starred', label: t('email.folder_starred'), icon: Star },
  { id: 'sent', label: t('email.folder_sent'), icon: Send },
  { id: 'archive', label: t('email.folder_archive'), icon: Archive },
  { id: 'trash', label: t('email.folder_trash'), icon: Trash2 },
]);

const messages = shallowRef<EmailMessage[]>(
  applyEmailOverrides([
    {
      id: 'mail-1',
      folder: 'inbox',
      from: '上线团队',
      subject: '上线评审纪要',
      preview: '最终检查清单已准备好，请完成签核。',
      time: '09:48',
      unread: true,
    },
    {
      id: 'mail-2',
      folder: 'inbox',
      from: '设计运营',
      subject: '桌面工作区稿件已更新',
      preview: '最新一轮体验走查稿已共享给你评审。',
      time: '昨天',
      unread: false,
    },
    {
      id: 'mail-3',
      folder: 'inbox',
      from: '安全团队',
      subject: '访问申请已通过',
      preview: '你的生产访问申请已完成审批。',
      time: '周一',
      unread: false,
    },
    {
      id: 'mail-4',
      folder: 'sent',
      from: '我',
      subject: '项目周报',
      preview: '本周项目状态已同步给核心团队。',
      time: '周五',
      unread: false,
    },
    {
      id: 'mail-5',
      folder: 'inbox',
      from: '产品团队',
      subject: '重点需求确认',
      preview: '请优先确认下周规划中的关键需求。',
      time: '周四',
      unread: false,
      starred: true,
    },
    {
      id: 'mail-6',
      folder: 'archive',
      from: '运营团队',
      subject: '历史活动归档',
      preview: '活动复盘资料已归档。',
      time: '4月20日',
      unread: false,
    },
  ]),
);

async function refreshInbox(): Promise<void> {
  if (!mailAccount.isConfigured || !isMailBridgeAvailable()) {
    openAccountPanel();
    toast.error(t('email.configure_required'));
    return;
  }
  refreshing.value = true;
  try {
    const fetched = await fetchInbox(mailAccount.account!, 30);
    const inbox: EmailMessage[] = fetched.map((mail) => ({
      id: `imap:${mail.uid}`,
      folder: 'inbox',
      from: mail.fromName || mail.from,
      subject: mail.subject || t('email.no_subject'),
      preview: mail.snippet,
      time: mail.date ? new Date(mail.date).toLocaleString() : '',
      unread: !mail.seen,
    }));
    messages.value = [...inbox, ...messages.value.filter((message) => message.folder !== 'inbox')];
    activeFolder.value = 'inbox';
    toast.success(t('email.refreshed', { count: inbox.length }));
  } catch {
    toast.error(t('email.refresh_failed'));
  } finally {
    refreshing.value = false;
  }
}

const defaultComposeSubject = computed(() => t('email.default_subject'));

const folders = computed(() =>
  folderConfig.value.map((folder) => ({
    ...folder,
    count: messages.value.filter((message) => messageBelongsToFolder(message, folder.id)).length,
  })),
);

const activeFolderLabel = computed(
  () => folders.value.find((folder) => folder.id === activeFolder.value)?.label ?? t('email.folder_inbox'),
);

const filteredMessages = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return messages.value.filter((message) => {
    const matchesFolder = messageBelongsToFolder(message, activeFolder.value);
    const matchesQuery =
      !query || [message.from, message.subject, message.preview].some((value) => value.toLowerCase().includes(query));
    return matchesFolder && matchesQuery;
  });
});

const selectedMessage = computed(
  () => filteredMessages.value.find((message) => message.id === selectedMessageId.value) ?? filteredMessages.value[0],
);
const selectedMessageActionNotice = computed(() => {
  const message = selectedMessage.value;
  if (!message) return t('email.notice_pending');
  return messageActionNotices.value[message.id] ?? t('email.notice_pending');
});
const selectedReplyDraftSubject = computed(() => {
  const message = selectedMessage.value;
  if (!message) return '';
  return replyDraftSubjects.value[message.id] ?? '';
});

onMounted(() => {
  composeSubject.value = defaultComposeSubject.value;
  contactList.ensureContactsLoaded();
  void mailAccount.load();
});

function selectFolder(folderId: string): void {
  activeFolder.value = folderId;
  searchQuery.value = '';
  selectedMessageId.value = messages.value.find((message) => messageBelongsToFolder(message, folderId))?.id ?? '';
}

function composeMessage(): void {
  const messageId = `mail-${Date.now()}`;
  composeOpen.value = true;
  composeDraftId.value = messageId;
  composeTo.value = '';
  composeSubject.value = defaultComposeSubject.value;
  composeBody.value = '';
  contactList.ensureContactsLoaded();
  activeFolder.value = 'inbox';
  searchQuery.value = '';
  messages.value = [
    {
      id: messageId,
      folder: 'inbox',
      from: '我',
      subject: defaultComposeSubject.value,
      preview: t('email.notice_editing'),
      time: '刚刚',
      unread: false,
    },
    ...messages.value,
  ];
  selectedMessageId.value = messageId;
  messageActionNotices.value = { ...messageActionNotices.value, [messageId]: t('email.notice_editing') };
}

function messageBelongsToFolder(message: EmailMessage, folderId: string): boolean {
  return folderId === 'starred' ? !!message.starred : message.folder === folderId;
}

function selectMessage(messageId: string): void {
  selectedMessageId.value = messageId;
  messages.value = messages.value.map((message) =>
    message.id === messageId ? { ...message, unread: false } : message,
  );
  setEmailOverride(messageId, { read: true });
}

function createReplyDraft(): void {
  const message = selectedMessage.value;
  if (!message) return;

  replyDraftSubjects.value = {
    ...replyDraftSubjects.value,
    [message.id]: t('email.reply_draft', { subject: message.subject }),
  };
  messageActionNotices.value = {
    ...messageActionNotices.value,
    [message.id]: t('email.notice_reply_generated', { subject: message.subject }),
  };
}

function starSelectedMessage(): void {
  const message = selectedMessage.value;
  if (!message) return;

  messages.value = messages.value.map((item) =>
    item.id === message.id ? { ...item, starred: true, unread: false } : item,
  );
  selectedMessageId.value = message.id;
  setEmailOverride(message.id, { starred: true, read: true });
  messageActionNotices.value = {
    ...messageActionNotices.value,
    [message.id]: t('email.notice_starred', { subject: message.subject }),
  };
}

function archiveSelectedMessage(): void {
  const message = selectedMessage.value;
  if (!message) return;

  messages.value = messages.value.map((item) =>
    item.id === message.id ? { ...item, folder: 'archive', unread: false } : item,
  );
  activeFolder.value = 'archive';
  searchQuery.value = '';
  selectedMessageId.value = message.id;
  setEmailOverride(message.id, { archived: true, read: true });
  messageActionNotices.value = {
    ...messageActionNotices.value,
    [message.id]: t('email.notice_archived', { subject: message.subject }),
  };
}

function deleteSelectedMessage(): void {
  const message = selectedMessage.value;
  if (!message) return;

  messages.value = messages.value.map((item) =>
    item.id === message.id ? { ...item, folder: 'trash', unread: false } : item,
  );
  activeFolder.value = 'trash';
  searchQuery.value = '';
  selectedMessageId.value = message.id;
  setEmailOverride(message.id, { trashed: true, read: true });
  messageActionNotices.value = {
    ...messageActionNotices.value,
    [message.id]: t('email.notice_trashed', { subject: message.subject }),
  };
}

async function sendComposeDraft(): Promise<void> {
  if (!composeOpen.value || sending.value) return;

  const subject = composeSubject.value.trim() || t('email.default_subject');
  const body = composeBody.value.trim() || t('email.default_body');
  const toAddress = composeTo.value.trim();

  // 真实发送：必须配置邮箱账号且桥可用，否则诚实拒绝（不伪造已发送）
  if (!mailAccount.isConfigured || !isMailBridgeAvailable()) {
    openAccountPanel();
    toast.error(t('email.configure_required'));
    return;
  }
  if (!toAddress) {
    toast.error(t('email.recipient_required'));
    return;
  }

  sending.value = true;
  try {
    await sendMail(mailAccount.account!, { to: toAddress, subject, text: body });
  } catch {
    toast.error(t('email.send_failed'));
    sending.value = false;
    return;
  }
  sending.value = false;
  toast.success(t('email.send_success'));

  const messageId = composeDraftId.value || `mail-${Date.now()}`;
  const sentMessage: EmailMessage = {
    id: messageId,
    folder: 'sent',
    from: '我',
    to: toAddress,
    subject,
    preview: body,
    time: '刚刚',
    unread: false,
  };

  const replacedDraft = messages.value.some((message) => message.id === messageId);
  messages.value = replacedDraft
    ? messages.value.map((message) => (message.id === messageId ? sentMessage : message))
    : [sentMessage, ...messages.value];
  activeFolder.value = 'sent';
  searchQuery.value = '';
  selectedMessageId.value = messageId;
  composeOpen.value = false;
  composeDraftId.value = '';
  messageActionNotices.value = { ...messageActionNotices.value, [messageId]: t('email.notice_sent', { subject }) };
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 bg-background text-foreground">
    <WorkspaceResizablePane
      as="nav"
      pane-test-id="email-sidebar"
      content-test-id="email-sidebar-content"
      handle-test-id="email-sidebar-resize-handle"
      content-class="flex h-full min-h-0 flex-col overflow-hidden px-2 py-6"
      :width-storage-key="EMAIL_WIDTH_STORAGE_KEY"
      :default-width="DEFAULT_EMAIL_WIDTH"
      :min-width="MIN_EMAIL_WIDTH"
      :max-width="MAX_EMAIL_WIDTH"
      :resize-label="resizeLabel"
    >
      <div class="mb-6 px-3">
        <h1 class="text-[18px] font-semibold leading-6 text-foreground">
          {{ t('sidebar.email') }}
        </h1>
        <p class="mt-1 text-[13px] leading-[18px] text-muted-foreground">
          {{ t('email.subtitle') }}
        </p>
      </div>

      <button
        type="button"
        data-testid="email-compose"
        class="mx-2 mb-2 flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        @click="composeMessage"
      >
        <PencilLine :size="16" />
        <span>{{ t('email.compose') }}</span>
      </button>

      <div class="mx-2 mb-3 flex gap-2">
        <button
          type="button"
          data-testid="email-refresh"
          class="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          :disabled="refreshing"
          @click="refreshInbox"
        >
          <RefreshCw :size="14" :class="refreshing ? 'animate-spin' : ''" />
          <span>{{ t('email.refresh') }}</span>
        </button>
        <button
          type="button"
          data-testid="email-account-settings"
          class="flex h-8 items-center justify-center rounded-md border border-border px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          :title="t('email.account_settings')"
          @click="openAccountPanel"
        >
          <Settings :size="14" />
        </button>
      </div>

      <div
        v-if="!mailAccount.isConfigured"
        class="mx-2 mb-3 rounded-md border border-dashed border-border px-3 py-2 text-[11px] leading-4 text-muted-foreground"
        data-testid="email-not-configured"
      >
        {{ t('email.account_required_hint') }}
      </div>

      <div class="flex flex-col gap-1">
        <button
          v-for="folder in folders"
          :key="folder.id"
          type="button"
          :data-testid="`email-folder-${folder.id}`"
          class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
          :class="activeFolder === folder.id ? 'workspace-row-active' : ''"
          @click="selectFolder(folder.id)"
        >
          <component :is="folder.icon" :size="18" />
          <span class="min-w-0 flex-1 truncate text-[13px] font-semibold">{{ folder.label }}</span>
          <span
            v-if="folder.count"
            class="rounded-md bg-primary/12 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
            :data-testid="`email-folder-count-${folder.id}`"
          >
            {{ folder.count }}
          </span>
        </button>
      </div>
    </WorkspaceResizablePane>

    <section class="flex min-w-0 flex-1 flex-col bg-background">
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4">
        <label
          class="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border bg-input px-3 text-muted-foreground focus-within:border-primary"
        >
          <Search :size="18" />
          <input
            v-model="searchQuery"
            data-testid="email-search-input"
            type="text"
            :placeholder="t('email.search_placeholder')"
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto grid w-full max-w-[1180px] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section class="workspace-surface overflow-hidden rounded-lg">
            <div class="flex h-11 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold" data-testid="email-active-folder-title">
                {{ activeFolderLabel }}
              </h2>
              <span class="text-[12px] text-muted-foreground">
                {{ t('email.real_time') }}
                <span v-if="selectedMessage"> · {{ t('email.current_message') }}：{{ selectedMessage.subject }}</span>
              </span>
            </div>
            <div class="divide-y divide-border">
              <button
                v-for="message in filteredMessages"
                :key="message.id"
                type="button"
                :data-testid="`email-message-${message.id}`"
                class="grid w-full grid-cols-[minmax(0,1fr)_84px] items-start gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
                :class="selectedMessage?.id === message.id ? 'bg-primary/10' : ''"
                @click="selectMessage(message.id)"
              >
                <span class="min-w-0">
                  <span class="flex items-center gap-2">
                    <span v-if="message.unread" class="size-2 rounded-full bg-primary" />
                    <span class="truncate text-[13px] font-semibold">{{ message.from }}</span>
                    <Star
                      v-if="message.starred"
                      :size="12"
                      class="shrink-0 fill-current text-warning"
                      aria-label="已星标"
                    />
                  </span>
                  <span class="mt-1 block truncate text-[13px] text-foreground">{{ message.subject }}</span>
                  <span class="mt-1 block truncate text-[12px] text-muted-foreground">{{ message.preview }}</span>
                </span>
                <span class="text-right text-[12px] text-muted-foreground">{{ message.time }}</span>
              </button>
              <div
                v-if="filteredMessages.length === 0"
                class="px-4 py-12 text-center text-[13px] text-muted-foreground"
                data-testid="email-empty"
              >
                {{ t('email.no_messages') }}
              </div>
            </div>
          </section>

          <aside class="workspace-surface h-fit rounded-lg p-5">
            <span
              class="flex size-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/12 text-primary"
            >
              <Mail :size="22" />
            </span>
            <h2 class="mt-4 text-[15px] font-semibold">
              {{ t('email.smart_sort') }}
            </h2>
            <template v-if="selectedMessage">
              <h3 class="mt-4 text-[14px] font-semibold">当前邮件：{{ selectedMessage.subject }}</h3>
              <p class="mt-2 text-[13px] leading-5 text-muted-foreground">
                {{ selectedMessage.from }}
                <template v-if="selectedMessage.to"> → {{ selectedMessage.to }} </template>
                · {{ selectedMessage.time }}
              </p>
              <p class="mt-3 text-[13px] leading-5 text-foreground">
                {{ selectedMessage.preview }}
              </p>
              <div v-if="composeOpen" class="mt-4 grid gap-2 rounded-lg border border-border p-3">
                <input
                  v-model="composeTo"
                  data-testid="email-compose-to"
                  type="email"
                  :placeholder="t('email.to_placeholder')"
                  class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
                />
                <input
                  v-model="composeSubject"
                  data-testid="email-compose-subject"
                  type="text"
                  placeholder="主题"
                  class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
                />
                <textarea
                  v-model="composeBody"
                  data-testid="email-compose-body"
                  :rows="4"
                  placeholder="正文"
                  class="min-h-[88px] resize-none rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none focus:border-primary"
                />
                <button
                  data-testid="email-compose-send"
                  class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  @click="sendComposeDraft"
                >
                  发送邮件
                </button>
              </div>
              <div class="mt-4 grid gap-2 rounded-lg border border-border p-3 text-[12px]">
                <span class="font-semibold text-foreground">{{ selectedMessageActionNotice }}</span>
                <span v-if="selectedReplyDraftSubject" class="text-muted-foreground">{{
                  selectedReplyDraftSubject
                }}</span>
              </div>
              <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  data-testid="email-reply-selected"
                  class="flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  @click="createReplyDraft"
                >
                  <Reply :size="14" />
                  <span>回复</span>
                </button>
                <button
                  data-testid="email-star-selected"
                  class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
                  @click="starSelectedMessage"
                >
                  <Star :size="14" />
                  <span>星标</span>
                </button>
                <button
                  data-testid="email-archive-selected"
                  class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
                  @click="archiveSelectedMessage"
                >
                  <Archive :size="14" />
                  <span>归档</span>
                </button>
                <button
                  data-testid="email-delete-selected"
                  class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-destructive/40 px-2 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  @click="deleteSelectedMessage"
                >
                  <Trash2 :size="14" />
                  <span>删除</span>
                </button>
              </div>
            </template>
            <template v-else>
              <p class="mt-2 text-[13px] leading-5 text-muted-foreground">
                重要邮件、审批提醒和会议跟进会和工作区其他任务一起保持可见。
              </p>
            </template>
          </aside>
        </div>
      </main>
    </section>

    <!-- 邮箱账号配置（真实 SMTP/IMAP） -->
    <div
      v-if="accountPanelOpen"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      data-testid="email-account-panel"
      @click.self="accountPanelOpen = false"
    >
      <div class="w-[360px] rounded-lg border border-border bg-popover p-4 shadow-2xl">
        <h2 class="mb-3 text-[15px] font-semibold text-foreground">{{ t('email.account_settings') }}</h2>
        <div class="grid gap-2">
          <input
            v-model="accountForm.user"
            data-testid="email-account-user"
            type="email"
            :placeholder="t('email.field_user')"
            class="h-8 rounded-md border border-border bg-background px-3 text-[12px] outline-none focus:border-primary"
          />
          <input
            v-model="accountForm.password"
            data-testid="email-account-password"
            type="password"
            :placeholder="t('email.field_password')"
            class="h-8 rounded-md border border-border bg-background px-3 text-[12px] outline-none focus:border-primary"
          />
          <div class="grid grid-cols-[1fr_72px] gap-2">
            <input
              v-model="accountForm.smtpHost"
              data-testid="email-account-smtp-host"
              type="text"
              :placeholder="t('email.field_smtp_host')"
              class="h-8 rounded-md border border-border bg-background px-3 text-[12px] outline-none focus:border-primary"
            />
            <input
              v-model.number="accountForm.smtpPort"
              type="number"
              :placeholder="t('email.field_port')"
              class="h-8 rounded-md border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
            />
          </div>
          <div class="grid grid-cols-[1fr_72px] gap-2">
            <input
              v-model="accountForm.imapHost"
              data-testid="email-account-imap-host"
              type="text"
              :placeholder="t('email.field_imap_host')"
              class="h-8 rounded-md border border-border bg-background px-3 text-[12px] outline-none focus:border-primary"
            />
            <input
              v-model.number="accountForm.imapPort"
              type="number"
              :placeholder="t('email.field_port')"
              class="h-8 rounded-md border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
            />
          </div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button
            class="h-8 rounded-md px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            @click="accountPanelOpen = false"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            data-testid="email-account-save"
            class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            @click="saveAccount"
          >
            {{ t('email.save_account') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
