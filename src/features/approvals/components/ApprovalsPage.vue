<script setup lang="ts">
import { CheckSquare, Clock3, FileCheck2, Plus, ShieldCheck, XCircle } from 'lucide-vue-next'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue'

const { t } = useI18n()

const activeQueue = shallowRef('pending')
const selectedRequestId = shallowRef('request-2')
const decisionNotices = shallowRef<Record<string, string>>({})
const approvalCommentDraft = shallowRef('')
const requestEditorOpen = shallowRef(false)
const requestDraftId = shallowRef('')
const requestDraftTitle = shallowRef('临时审批申请')
const requestDraftRequester = shallowRef('我')
const requestDraftDue = shallowRef('刚刚')

const approvalQueues = [
  { id: 'pending', label: '待处理', hint: '3 项今日到期', icon: Clock3 },
  { id: 'approved', label: '已通过', hint: '本月累计', icon: CheckSquare },
  { id: 'compliance', label: '合规检查', hint: '需要复核', icon: ShieldCheck },
  { id: 'rejected', label: '已驳回', hint: '需申请人补充', icon: XCircle },
]

interface ApprovalRequest {
  id: string
  queue: string
  title: string
  requester: string
  stage: string
  due: string
  currentHandler: string
  comments: string[]
}

const requests = shallowRef<ApprovalRequest[]>([
  { id: 'request-1', queue: 'compliance', title: '供应商安全例外申请', requester: '运营团队', stage: '法务复核', due: '今日', currentHandler: '法务复核', comments: [] },
  { id: 'request-2', queue: 'pending', title: '生产访问申请', requester: '工程团队', stage: '主管审批', due: '明日', currentHandler: '主管审批', comments: [] },
  { id: 'request-3', queue: 'pending', title: '上线预算调整', requester: '增长团队', stage: '财务确认', due: '周五', currentHandler: '财务确认', comments: [] },
  { id: 'request-4', queue: 'approved', title: '设计资源采购', requester: '设计团队', stage: '已归档', due: '已通过', currentHandler: '已归档', comments: ['采购合同已归档'] },
])

const activeQueueLabel = computed(() => approvalQueues.find(queue => queue.id === activeQueue.value)?.label ?? '待处理')

const queueCards = computed(() => approvalQueues.map(queue => ({
  ...queue,
  value: requests.value.filter(request => request.queue === queue.id).length,
})))

const filteredRequests = computed(() => requests.value.filter(request => request.queue === activeQueue.value))
const selectedRequest = computed(() => filteredRequests.value.find(request => request.id === selectedRequestId.value) ?? filteredRequests.value[0])
const selectedRequestDecisionNotice = computed(() => {
  const request = selectedRequest.value
  if (!request)
    return '等待处理当前申请'

  return decisionNotices.value[request.id] ?? '等待处理当前申请'
})

function createRequest(): void {
  const requestId = `request-${Date.now()}`
  requestEditorOpen.value = true
  requestDraftId.value = requestId
  requestDraftTitle.value = '临时审批申请'
  requestDraftRequester.value = '我'
  requestDraftDue.value = '刚刚'
  requests.value = [
    { id: requestId, queue: activeQueue.value, title: '临时审批申请', requester: '我', stage: '待提交', due: '刚刚', currentHandler: '我', comments: [] },
    ...requests.value,
  ]
  selectedRequestId.value = requestId
}

function selectRequest(requestId: string): void {
  selectedRequestId.value = requestId
}

function decideSelectedRequest(queue: 'approved' | 'rejected'): void {
  const request = selectedRequest.value
  if (!request)
    return

  const approved = queue === 'approved'
  requests.value = requests.value.map(item => item.id === request.id
    ? {
        ...item,
        queue,
        stage: approved ? '已通过' : '已驳回',
        due: approved ? '已通过' : '已驳回',
        currentHandler: approved ? '已归档' : '申请人补充',
      }
    : item)
  activeQueue.value = queue
  selectedRequestId.value = request.id
  decisionNotices.value = {
    ...decisionNotices.value,
    [request.id]: `${approved ? '已同意' : '已驳回'}：${request.title}`,
  }
}

function addApprovalComment(): void {
  const request = selectedRequest.value
  const comment = approvalCommentDraft.value.trim()
  if (!request || !comment)
    return

  requests.value = requests.value.map(item => item.id === request.id
    ? { ...item, comments: [...item.comments, comment] }
    : item)
  approvalCommentDraft.value = ''
  decisionNotices.value = {
    ...decisionNotices.value,
    [request.id]: `已记录意见：${request.title}`,
  }
}

function transferSelectedRequest(): void {
  const request = selectedRequest.value
  if (!request)
    return

  requests.value = requests.value.map(item => item.id === request.id
    ? { ...item, stage: '法务复核', currentHandler: '法务复核' }
    : item)
  decisionNotices.value = {
    ...decisionNotices.value,
    [request.id]: `已转交：${request.title}`,
  }
}

function saveDraftRequest(): void {
  if (!requestEditorOpen.value)
    return

  const requestId = requestDraftId.value
  const title = requestDraftTitle.value.trim() || '临时审批申请'
  const requester = requestDraftRequester.value.trim() || '我'
  const due = requestDraftDue.value.trim() || '刚刚'

  requests.value = requests.value.map(item => item.id === requestId
    ? {
        ...item,
        title,
        requester,
        stage: '主管审批',
        due,
        currentHandler: '主管审批',
      }
    : item)
  selectedRequestId.value = requestId
  decisionNotices.value = {
    ...decisionNotices.value,
    [requestId]: `已新建申请：${title}`,
  }
  requestEditorOpen.value = false
}
</script>

<template>
  <WorkspacePageFrame
    :title="t('sidebar.approvals')"
    subtitle="集中处理申请、合规检查和团队决策"
    :icon="FileCheck2"
  >
    <template #actions>
      <button
        data-testid="approvals-new-request"
        class="flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        @click="createRequest"
      >
        <Plus :size="16" />
        <span>新建申请</span>
      </button>
    </template>

    <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="queue in queueCards"
        :key="queue.id"
        :data-testid="`approvals-queue-${queue.id}`"
        class="workspace-surface cursor-pointer rounded-lg p-4 transition-colors hover:bg-accent"
        :class="activeQueue === queue.id ? 'ring-1 ring-primary/30' : ''"
        @click="activeQueue = queue.id"
      >
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">{{ queue.label }}</span>
          <component :is="queue.icon" :size="18" class="text-primary" />
        </div>
        <div class="mt-3 text-2xl font-semibold leading-8">
          {{ queue.value }}
        </div>
        <p class="mt-1 text-[13px] text-muted-foreground">
          {{ queue.hint }}
        </p>
      </div>
    </div>

    <section class="workspace-surface overflow-hidden rounded-lg">
      <div class="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 class="text-[15px] font-semibold">
          审批收件箱
        </h2>
        <span class="text-[12px] text-muted-foreground">
          当前队列：{{ activeQueueLabel }}
          <span v-if="selectedRequest"> · 当前申请：{{ selectedRequest.title }}</span>
        </span>
      </div>
      <div class="divide-y divide-border">
        <button
          v-for="request in filteredRequests"
          :key="request.id"
          :data-testid="`approvals-request-${request.id}`"
          class="grid w-full grid-cols-[minmax(0,1fr)_150px_96px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
          :class="selectedRequest?.id === request.id ? 'bg-primary/8' : ''"
          @click="selectRequest(request.id)"
        >
          <span class="min-w-0">
            <span class="block truncate text-[13px] font-semibold">{{ request.title }}</span>
            <span class="mt-1 block truncate text-[12px] text-muted-foreground">{{ request.requester }}</span>
          </span>
          <span class="text-[12px] text-muted-foreground">{{ request.stage }}</span>
          <span class="justify-self-start rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            {{ request.due }}
          </span>
        </button>
      </div>
      <div v-if="requestEditorOpen" class="border-t border-border p-4">
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_120px_auto]">
          <input
            v-model="requestDraftTitle"
            data-testid="approvals-new-title"
            type="text"
            placeholder="申请标题"
            class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
          >
          <input
            v-model="requestDraftRequester"
            data-testid="approvals-new-requester"
            type="text"
            placeholder="申请人"
            class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
          >
          <input
            v-model="requestDraftDue"
            data-testid="approvals-new-due"
            type="text"
            placeholder="到期时间"
            class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
          >
          <button
            data-testid="approvals-save-new-request"
            class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            @click="saveDraftRequest"
          >
            保存申请
          </button>
        </div>
      </div>
      <div v-if="selectedRequest" class="border-t border-border px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="grid gap-1 text-[12px] font-semibold text-muted-foreground">
            <span>{{ selectedRequestDecisionNotice }}</span>
            <span>当前处理人：{{ selectedRequest.currentHandler }}</span>
          </span>
          <span class="flex flex-wrap gap-2">
            <button
              data-testid="approvals-transfer-selected"
              class="h-8 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
              @click="transferSelectedRequest"
            >
              转交
            </button>
            <button
              data-testid="approvals-reject-selected"
              class="h-8 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
              @click="decideSelectedRequest('rejected')"
            >
              驳回
            </button>
            <button
              data-testid="approvals-approve-selected"
              class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              @click="decideSelectedRequest('approved')"
            >
              同意
            </button>
          </span>
        </div>
        <div class="mt-3 grid gap-2 rounded-lg border border-border p-3">
          <div class="flex items-center gap-2">
            <input
              v-model="approvalCommentDraft"
              data-testid="approvals-comment-input"
              type="text"
              placeholder="填写审批意见..."
              class="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
            >
            <button
              data-testid="approvals-add-comment"
              class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              @click="addApprovalComment"
            >
              添加意见
            </button>
          </div>
          <div class="grid gap-1 text-[12px] text-muted-foreground">
            <span v-for="comment in selectedRequest.comments" :key="comment">审批意见：{{ comment }}</span>
            <span v-if="selectedRequest.comments.length === 0">暂无审批意见</span>
          </div>
        </div>
      </div>
    </section>
  </WorkspacePageFrame>
</template>
