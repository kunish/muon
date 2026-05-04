<script setup lang="ts">
import { Archive, Inbox, Mail, PencilLine, Reply, Search, Send, Star } from 'lucide-vue-next'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue'

const { t } = useI18n()

const EMAIL_WIDTH_STORAGE_KEY = 'muon_email_sidebar_width'
const DEFAULT_EMAIL_WIDTH = 240
const MIN_EMAIL_WIDTH = 220
const MAX_EMAIL_WIDTH = 340

const activeFolder = shallowRef('inbox')
const resizeLabel = computed(() => t('sidebar.resize_email'))

const searchQuery = shallowRef('')
const selectedMessageId = shallowRef('mail-1')
const messageActionNotices = shallowRef<Record<string, string>>({})
const replyDraftSubjects = shallowRef<Record<string, string>>({})
const composeOpen = shallowRef(false)
const composeDraftId = shallowRef('')
const composeRecipient = shallowRef('')
const composeSubject = shallowRef('草稿：新邮件')
const composeBody = shallowRef('')

interface EmailMessage {
  id: string
  folder: string
  from: string
  subject: string
  preview: string
  time: string
  unread: boolean
  to?: string
}

const folderConfig = [
  { id: 'inbox', label: '收件箱', icon: Inbox },
  { id: 'starred', label: '星标邮件', icon: Star },
  { id: 'sent', label: '已发送', icon: Send },
  { id: 'archive', label: '归档', icon: Archive },
]

const messages = shallowRef<EmailMessage[]>([
  { id: 'mail-1', folder: 'inbox', from: '上线团队', subject: '上线评审纪要', preview: '最终检查清单已准备好，请完成签核。', time: '09:48', unread: true },
  { id: 'mail-2', folder: 'inbox', from: '设计运营', subject: '桌面工作区稿件已更新', preview: '最新一轮体验走查稿已共享给你评审。', time: '昨天', unread: false },
  { id: 'mail-3', folder: 'inbox', from: '安全团队', subject: '访问申请已通过', preview: '你的生产访问申请已完成审批。', time: '周一', unread: false },
  { id: 'mail-4', folder: 'sent', from: '我', subject: '项目周报', preview: '本周项目状态已同步给核心团队。', time: '周五', unread: false },
  { id: 'mail-5', folder: 'starred', from: '产品团队', subject: '重点需求确认', preview: '请优先确认下周规划中的关键需求。', time: '周四', unread: false },
  { id: 'mail-6', folder: 'archive', from: '运营团队', subject: '历史活动归档', preview: '活动复盘资料已归档。', time: '4月20日', unread: false },
])

const folders = computed(() => folderConfig.map(folder => ({
  ...folder,
  count: messages.value.filter(message => message.folder === folder.id).length,
})))

const activeFolderLabel = computed(() => folders.value.find(folder => folder.id === activeFolder.value)?.label ?? '收件箱')

const filteredMessages = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return messages.value.filter((message) => {
    const matchesFolder = message.folder === activeFolder.value
    const matchesQuery = !query || [message.from, message.subject, message.preview].some(value => value.toLowerCase().includes(query))
    return matchesFolder && matchesQuery
  })
})

const selectedMessage = computed(() => filteredMessages.value.find(message => message.id === selectedMessageId.value) ?? filteredMessages.value[0])
const selectedMessageActionNotice = computed(() => {
  const message = selectedMessage.value
  if (!message)
    return '等待处理当前邮件'
  return messageActionNotices.value[message.id] ?? '等待处理当前邮件'
})
const selectedReplyDraftSubject = computed(() => {
  const message = selectedMessage.value
  if (!message)
    return ''
  return replyDraftSubjects.value[message.id] ?? ''
})

function selectFolder(folderId: string): void {
  activeFolder.value = folderId
  searchQuery.value = ''
  selectedMessageId.value = messages.value.find(message => message.folder === folderId)?.id ?? ''
}

function composeMessage(): void {
  const messageId = `mail-${Date.now()}`
  composeOpen.value = true
  composeDraftId.value = messageId
  composeRecipient.value = ''
  composeSubject.value = '草稿：新邮件'
  composeBody.value = ''
  activeFolder.value = 'inbox'
  searchQuery.value = ''
  messages.value = [
    { id: messageId, folder: 'inbox', from: '我', subject: '草稿：新邮件', preview: '已创建本地草稿，可继续完善后发送。', time: '刚刚', unread: false },
    ...messages.value,
  ]
  selectedMessageId.value = messageId
  messageActionNotices.value = { ...messageActionNotices.value, [messageId]: '正在编辑新邮件' }
}

function selectMessage(messageId: string): void {
  selectedMessageId.value = messageId
  messages.value = messages.value.map(message => message.id === messageId ? { ...message, unread: false } : message)
}

function createReplyDraft(): void {
  const message = selectedMessage.value
  if (!message)
    return

  replyDraftSubjects.value = { ...replyDraftSubjects.value, [message.id]: `回复草稿：${message.subject}` }
  messageActionNotices.value = { ...messageActionNotices.value, [message.id]: `已生成回复草稿：${message.subject}` }
}

function starSelectedMessage(): void {
  const message = selectedMessage.value
  if (!message)
    return

  messages.value = messages.value.map(item => item.id === message.id ? { ...item, folder: 'starred', unread: false } : item)
  activeFolder.value = 'starred'
  searchQuery.value = ''
  selectedMessageId.value = message.id
  messageActionNotices.value = { ...messageActionNotices.value, [message.id]: `已星标：${message.subject}` }
}

function archiveSelectedMessage(): void {
  const message = selectedMessage.value
  if (!message)
    return

  messages.value = messages.value.map(item => item.id === message.id ? { ...item, folder: 'archive', unread: false } : item)
  activeFolder.value = 'archive'
  searchQuery.value = ''
  selectedMessageId.value = message.id
  messageActionNotices.value = { ...messageActionNotices.value, [message.id]: `已归档：${message.subject}` }
}

function sendComposeDraft(): void {
  if (!composeOpen.value)
    return

  const subject = composeSubject.value.trim() || '无主题邮件'
  const body = composeBody.value.trim() || '已发送本地邮件。'
  const recipient = composeRecipient.value.trim() || '未填写收件人'
  const messageId = composeDraftId.value || `mail-${Date.now()}`
  const sentMessage: EmailMessage = {
    id: messageId,
    folder: 'sent',
    from: '我',
    to: recipient,
    subject,
    preview: body,
    time: '刚刚',
    unread: false,
  }

  const replacedDraft = messages.value.some(message => message.id === messageId)
  messages.value = replacedDraft
    ? messages.value.map(message => message.id === messageId ? sentMessage : message)
    : [sentMessage, ...messages.value]
  activeFolder.value = 'sent'
  searchQuery.value = ''
  selectedMessageId.value = messageId
  composeOpen.value = false
  composeDraftId.value = ''
  messageActionNotices.value = { ...messageActionNotices.value, [messageId]: `已发送：${subject}` }
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
          团队邮件中心
        </p>
      </div>

      <button
        data-testid="email-compose"
        class="mx-2 mb-4 flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        @click="composeMessage"
      >
        <PencilLine :size="16" />
        <span>写邮件</span>
      </button>

      <div class="flex flex-col gap-1">
        <button
          v-for="folder in folders"
          :key="folder.id"
          :data-testid="`email-folder-${folder.id}`"
          class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
          :class="activeFolder === folder.id ? 'workspace-row-active' : ''"
          @click="selectFolder(folder.id)"
        >
          <component :is="folder.icon" :size="18" />
          <span class="min-w-0 flex-1 truncate text-[13px] font-semibold">{{ folder.label }}</span>
          <span v-if="folder.count" class="rounded-md bg-primary/12 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{{ folder.count }}</span>
        </button>
      </div>
    </WorkspaceResizablePane>

    <section class="flex min-w-0 flex-1 flex-col bg-background">
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4">
        <label class="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border bg-input px-3 text-muted-foreground focus-within:border-primary">
          <Search :size="18" />
          <input
            v-model="searchQuery"
            data-testid="email-search-input"
            type="text"
            placeholder="搜索邮件、联系人或主题..."
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          >
        </label>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto grid w-full max-w-[1180px] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section class="workspace-surface overflow-hidden rounded-lg">
            <div class="flex h-11 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">
                {{ activeFolderLabel }}
              </h2>
              <span class="text-[12px] text-muted-foreground">
                实时更新
                <span v-if="selectedMessage"> · 当前邮件：{{ selectedMessage.subject }}</span>
              </span>
            </div>
            <div class="divide-y divide-border">
              <button
                v-for="message in filteredMessages"
                :key="message.id"
                :data-testid="`email-message-${message.id}`"
                class="grid w-full grid-cols-[minmax(0,1fr)_84px] items-start gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
                :class="selectedMessage?.id === message.id ? 'bg-primary/8' : ''"
                @click="selectMessage(message.id)"
              >
                <span class="min-w-0">
                  <span class="flex items-center gap-2">
                    <span v-if="message.unread" class="size-2 rounded-full bg-primary" />
                    <span class="truncate text-[13px] font-semibold">{{ message.from }}</span>
                  </span>
                  <span class="mt-1 block truncate text-[13px] text-foreground">{{ message.subject }}</span>
                  <span class="mt-1 block truncate text-[12px] text-muted-foreground">{{ message.preview }}</span>
                </span>
                <span class="text-right text-[12px] text-muted-foreground">{{ message.time }}</span>
              </button>
            </div>
          </section>

          <aside class="workspace-surface h-fit rounded-lg p-5">
            <span class="flex size-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/12 text-primary">
              <Mail :size="22" />
            </span>
            <h2 class="mt-4 text-[15px] font-semibold">
              智能分拣
            </h2>
            <template v-if="selectedMessage">
              <h3 class="mt-4 text-[14px] font-semibold">
                当前邮件：{{ selectedMessage.subject }}
              </h3>
              <p class="mt-2 text-[13px] leading-5 text-muted-foreground">
                {{ selectedMessage.from }}
                <template v-if="selectedMessage.to">
                  → {{ selectedMessage.to }}
                </template>
                · {{ selectedMessage.time }}
              </p>
              <p class="mt-3 text-[13px] leading-5 text-foreground">
                {{ selectedMessage.preview }}
              </p>
              <div v-if="composeOpen" class="mt-4 grid gap-2 rounded-lg border border-border p-3">
                <input
                  v-model="composeRecipient"
                  data-testid="email-compose-recipient"
                  type="text"
                  placeholder="收件人"
                  class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
                >
                <input
                  v-model="composeSubject"
                  data-testid="email-compose-subject"
                  type="text"
                  placeholder="主题"
                  class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
                >
                <textarea
                  v-model="composeBody"
                  data-testid="email-compose-body"
                  rows="4"
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
                <span v-if="selectedReplyDraftSubject" class="text-muted-foreground">{{ selectedReplyDraftSubject }}</span>
              </div>
              <div class="mt-3 grid gap-2 sm:grid-cols-3">
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
  </div>
</template>
