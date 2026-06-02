<script setup lang="ts">
import type { ApprovalTemplate, BackendApproval } from '@/features/approvals/lib/approvalsApi';
import { useStorage } from '@vueuse/core';
import { CheckSquare, Clock3, FileCheck2, Plus, ShieldCheck, XCircle } from 'lucide-vue-next';
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import {
  commentApproval,
  createApproval,
  decideApproval,
  fetchApprovals,
  fetchApprovalTemplates,
  isApprovalsBackendConfigured,
  transferApproval,
} from '@/features/approvals/lib/approvalsApi';
import GroupMemberPicker from '@/features/contacts/components/GroupMemberPicker.vue';
import { useContactList } from '@/shared/composables/useContactList';

const { t } = useI18n();
const contactList = useContactList();

// 配置了应用自带审批后端(apps/api)时,数据与决策走真实后端;否则用本地工作流
const backendMode = isApprovalsBackendConfigured();

const activeQueue = shallowRef('pending');
const selectedRequestId = shallowRef('request-2');
const decisionNotices = shallowRef<Record<string, string>>({});
const approvalCommentDraft = shallowRef('');
const requestEditorOpen = shallowRef(false);
const requestDraftId = shallowRef('');
const requestDraftTitle = shallowRef('临时审批申请');
const requestDraftRequester = shallowRef(t('approvals.default_requester'));
const requestDraftRequesterIds = ref<string[]>([]);
const requestDraftDue = shallowRef('刚刚');
const transferPickerOpen = shallowRef(false);
const transferMemberIds = ref<string[]>([]);

// ── 审批模板 + 结构化表单（后端模式） ──
const templates = ref<ApprovalTemplate[]>([]);
const selectedTemplateId = shallowRef('');
const formData = ref<Record<string, string>>({});

const selectedTemplate = computed(() => templates.value.find((tpl) => tpl.id === selectedTemplateId.value));

function onSelectTemplate(): void {
  const template = selectedTemplate.value;
  formData.value = {};
  if (template) {
    for (const field of template.fields) formData.value[field.key] = '';
    if (!requestDraftTitle.value.trim() || requestDraftTitle.value === t('approvals.default_request_title')) {
      requestDraftTitle.value = template.name;
    }
  }
}

async function loadApprovalTemplates(): Promise<void> {
  try {
    const loaded = await fetchApprovalTemplates();
    templates.value = Array.isArray(loaded) ? loaded : [];
  } catch {
    templates.value = [];
  }
}

const approvalQueues = [
  { id: 'pending', label: t('approvals.queue_pending'), hint: t('approvals.queue_pending_hint'), icon: Clock3 },
  { id: 'approved', label: t('approvals.queue_approved'), hint: t('approvals.queue_approved_hint'), icon: CheckSquare },
  {
    id: 'compliance',
    label: t('approvals.queue_compliance'),
    hint: t('approvals.queue_compliance_hint'),
    icon: ShieldCheck,
  },
  { id: 'rejected', label: t('approvals.queue_rejected'), hint: t('approvals.queue_rejected_hint'), icon: XCircle },
];

interface ApprovalRequest {
  id: string;
  queue: string;
  title: string;
  requester: string;
  stage: string;
  due: string;
  currentHandler: string;
  comments: string[];
  /** 顺序审批链：逐级通过，最后一级通过后整体通过 */
  stages: string[];
  /** 结构化表单数据（来自模板） */
  formData?: Record<string, unknown>;
}

type ApprovalDecision = 'approved' | 'rejected';

/** Persisted per-request outcome so decisions/transfers/comments survive reloads. */
interface ApprovalOverride {
  decision?: ApprovalDecision;
  handler?: string;
  comments?: string[];
  /** 当前所处的审批环节下标 */
  stageIndex?: number;
}

const APPROVAL_OVERRIDES_STORAGE_KEY = 'muon_approval_overrides';
const approvalOverrides = useStorage<Record<string, ApprovalOverride>>(APPROVAL_OVERRIDES_STORAGE_KEY, {});

/** Re-derive the localized stage/due/handler labels for a decision (single source of truth). */
function approvalDecisionFields(
  decision: ApprovalDecision,
): Pick<ApprovalRequest, 'queue' | 'stage' | 'due' | 'currentHandler'> {
  const approved = decision === 'approved';
  return {
    queue: decision,
    stage: approved ? t('approvals.status_approved') : t('approvals.status_rejected'),
    due: approved ? t('approvals.status_approved') : t('approvals.status_rejected'),
    currentHandler: approved ? t('approvals.status_archived') : t('approvals.status_follow_up'),
  };
}

function applyApprovalOverrides(list: ApprovalRequest[]): ApprovalRequest[] {
  return list.map((request) => {
    const override = approvalOverrides.value[request.id];
    if (!override) return request;

    let next = { ...request };
    if (override.comments) next.comments = override.comments;
    if (
      typeof override.stageIndex === 'number' &&
      override.stageIndex >= 0 &&
      override.stageIndex < request.stages.length
    ) {
      const stageName = request.stages[override.stageIndex]!;
      next = { ...next, stage: stageName, currentHandler: stageName };
    }
    if (override.handler) next = { ...next, stage: override.handler, currentHandler: override.handler };
    if (override.decision) next = { ...next, ...approvalDecisionFields(override.decision) };
    return next;
  });
}

function setApprovalOverride(id: string, patch: ApprovalOverride): void {
  approvalOverrides.value = {
    ...approvalOverrides.value,
    [id]: { ...approvalOverrides.value[id], ...patch },
  };
}

const requests = shallowRef<ApprovalRequest[]>(
  applyApprovalOverrides([
    {
      id: 'request-1',
      queue: 'compliance',
      title: '供应商安全例外申请',
      requester: '运营团队',
      stage: '法务复核',
      due: '今日',
      currentHandler: '法务复核',
      comments: [],
      stages: ['法务复核', '安全复核'],
    },
    {
      id: 'request-2',
      queue: 'pending',
      title: '生产访问申请',
      requester: '工程团队',
      stage: '主管审批',
      due: '明日',
      currentHandler: '主管审批',
      comments: [],
      stages: ['主管审批', '安全复核'],
    },
    {
      id: 'request-3',
      queue: 'pending',
      title: '上线预算调整',
      requester: '增长团队',
      stage: '财务确认',
      due: '周五',
      currentHandler: '财务确认',
      comments: [],
      stages: ['财务确认', '管理层审批'],
    },
    {
      id: 'request-4',
      queue: 'approved',
      title: '设计资源采购',
      requester: '设计团队',
      stage: '已归档',
      due: '已通过',
      currentHandler: '已归档',
      comments: ['采购合同已归档'],
      stages: ['采购审批'],
    },
  ]),
);

const activeQueueLabel = computed(
  () => approvalQueues.find((queue) => queue.id === activeQueue.value)?.label ?? t('approvals.queue_pending'),
);

const queueCards = computed(() =>
  approvalQueues.map((queue) => ({
    ...queue,
    value: requests.value.filter((request) => request.queue === queue.id).length,
  })),
);

const filteredRequests = computed(() => requests.value.filter((request) => request.queue === activeQueue.value));
const selectedRequest = computed(
  () => filteredRequests.value.find((request) => request.id === selectedRequestId.value) ?? filteredRequests.value[0],
);
const selectedFormEntries = computed<[string, string][]>(() => {
  const data = selectedRequest.value?.formData;
  if (!data) return [];
  return Object.entries(data)
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([key, value]) => [key, String(value)]);
});
const selectedRequestDecisionNotice = computed(() => {
  const request = selectedRequest.value;
  if (!request) return t('approvals.waiting_notice');

  return decisionNotices.value[request.id] ?? t('approvals.waiting_notice');
});

/** 选中申请当前所处的审批环节下标（持久化） */
const selectedRequestStageIndex = computed(() => {
  const request = selectedRequest.value;
  if (!request) return 0;
  return approvalOverrides.value[request.id]?.stageIndex ?? 0;
});

/** 是否已是最后一个审批环节（再通过即整体通过） */
const selectedRequestIsFinalStage = computed(() => {
  const request = selectedRequest.value;
  if (!request) return true;
  return selectedRequestStageIndex.value >= request.stages.length - 1;
});

function mapBackendApproval(approval: BackendApproval): ApprovalRequest {
  return {
    id: approval.id,
    queue: approval.status,
    title: approval.title,
    requester: approval.requester,
    stage: approval.handler,
    due: approval.handler,
    currentHandler: approval.handler,
    comments: approval.comments,
    stages: approval.stages,
    formData: approval.formData,
  };
}

/** 把后端返回的单条审批写回视图与阶段链 */
function applyBackendApproval(approval: BackendApproval): void {
  const mapped = mapBackendApproval(approval);
  requests.value = requests.value.map((item) => (item.id === approval.id ? mapped : item));
  setApprovalOverride(approval.id, { stageIndex: approval.currentStageIndex });
}

async function loadBackendApprovals(): Promise<void> {
  try {
    const list = await fetchApprovals();
    requests.value = list.map(mapBackendApproval);
    for (const approval of list) setApprovalOverride(approval.id, { stageIndex: approval.currentStageIndex });
    selectedRequestId.value = list[0]?.id ?? '';
  } catch {
    /* 后端不可用时退回本地种子 */
  }
}

onMounted(() => {
  contactList.ensureContactsLoaded();
  if (backendMode) {
    void loadBackendApprovals();
    void loadApprovalTemplates();
  }
});

watch(requestDraftRequesterIds, (ids) => {
  if (ids.length > 1) {
    requestDraftRequesterIds.value = [ids[ids.length - 1]!];
    return;
  }

  requestDraftRequester.value = ids[0] ? displayNameForUserId(ids[0]) : t('approvals.default_requester');
});

function createRequest(): void {
  const requestId = `request-${Date.now()}`;
  const title = t('approvals.default_request_title');
  const requester = t('approvals.default_requester');
  const submittedStatus = t('approvals.status_submitted');
  const due = t('calls.call_just_now');
  contactList.ensureContactsLoaded();
  requestEditorOpen.value = true;
  requestDraftId.value = requestId;
  requestDraftTitle.value = title;
  requestDraftRequester.value = requester;
  requestDraftRequesterIds.value = [];
  requestDraftDue.value = due;
  selectedTemplateId.value = '';
  formData.value = {};
  // 后端模式下不做本地乐观行，新建行以后端返回（含真实 id）为准
  if (backendMode) return;
  requests.value = [
    {
      id: requestId,
      queue: activeQueue.value,
      title,
      requester,
      stage: submittedStatus,
      due,
      currentHandler: submittedStatus,
      comments: [],
      stages: [submittedStatus],
    },
    ...requests.value,
  ];
  selectedRequestId.value = requestId;
}

function selectRequest(requestId: string): void {
  selectedRequestId.value = requestId;
  closeTransferPicker();
}

function setDecisionNotice(id: string, message: string): void {
  decisionNotices.value = { ...decisionNotices.value, [id]: message };
}

async function decideSelectedRequest(queue: 'approved' | 'rejected'): Promise<void> {
  const request = selectedRequest.value;
  if (!request) return;

  selectedRequestId.value = request.id;

  // 后端模式:决策走应用自带审批后端,以后端返回为准
  if (backendMode) {
    try {
      const updated = await decideApproval(request.id, queue);
      applyBackendApproval(updated);
      activeQueue.value = updated.status;
      setDecisionNotice(
        request.id,
        updated.status === 'approved'
          ? t('approvals.approved_notice', { title: request.title })
          : updated.status === 'rejected'
            ? t('approvals.rejected_notice', { title: request.title })
            : t('approvals.stage_advanced_notice', { stage: updated.handler }),
      );
    } catch {
      setDecisionNotice(request.id, t('approvals.update_failed'));
    }
    return;
  }

  if (queue === 'rejected') {
    requests.value = requests.value.map((item) =>
      item.id === request.id ? { ...item, ...approvalDecisionFields('rejected') } : item,
    );
    setApprovalOverride(request.id, { decision: 'rejected' });
    activeQueue.value = 'rejected';
    setDecisionNotice(request.id, t('approvals.rejected_notice', { title: request.title }));
    return;
  }

  const currentIndex = approvalOverrides.value[request.id]?.stageIndex ?? 0;
  // 还有后续环节：推进到下一环节，整体仍在审批中
  if (currentIndex < request.stages.length - 1) {
    const nextIndex = currentIndex + 1;
    const nextStage = request.stages[nextIndex]!;
    setApprovalOverride(request.id, { stageIndex: nextIndex });
    requests.value = requests.value.map((item) =>
      item.id === request.id ? { ...item, stage: nextStage, currentHandler: nextStage } : item,
    );
    setDecisionNotice(request.id, t('approvals.stage_advanced_notice', { stage: nextStage }));
    return;
  }

  // 最后一个环节通过：整体通过
  requests.value = requests.value.map((item) =>
    item.id === request.id ? { ...item, ...approvalDecisionFields('approved') } : item,
  );
  setApprovalOverride(request.id, { decision: 'approved', stageIndex: request.stages.length });
  activeQueue.value = 'approved';
  setDecisionNotice(request.id, t('approvals.approved_notice', { title: request.title }));
}

async function addApprovalComment(): Promise<void> {
  const request = selectedRequest.value;
  const comment = approvalCommentDraft.value.trim();
  if (!request || !comment) return;

  if (backendMode) {
    approvalCommentDraft.value = '';
    try {
      applyBackendApproval(await commentApproval(request.id, comment));
      setDecisionNotice(request.id, t('approvals.comment_recorded_notice', { title: request.title }));
    } catch {
      setDecisionNotice(request.id, t('approvals.update_failed'));
    }
    return;
  }

  const nextComments = [...request.comments, comment];
  requests.value = requests.value.map((item) => (item.id === request.id ? { ...item, comments: nextComments } : item));
  setApprovalOverride(request.id, { comments: nextComments });
  approvalCommentDraft.value = '';
  decisionNotices.value = {
    ...decisionNotices.value,
    [request.id]: t('approvals.comment_recorded_notice', { title: request.title }),
  };
}

function fallbackNameFromUserId(userId: string): string {
  return userId.split(':')[0]?.replace(/^@/, '') || userId;
}

function displayNameForUserId(userId: string): string {
  return (
    contactList.contacts.find((contact) => contact.userId === userId)?.displayName ?? fallbackNameFromUserId(userId)
  );
}

function openTransferPicker(): void {
  const request = selectedRequest.value;
  if (!request) return;
  contactList.ensureContactsLoaded();
  transferMemberIds.value = [];
  transferPickerOpen.value = true;
}

function closeTransferPicker(): void {
  transferMemberIds.value = [];
  transferPickerOpen.value = false;
}

async function transferSelectedRequest(): Promise<void> {
  const request = selectedRequest.value;
  if (!request || transferMemberIds.value.length === 0) return;

  const nextHandler = transferMemberIds.value.map(displayNameForUserId).join('、');

  if (backendMode) {
    closeTransferPicker();
    try {
      applyBackendApproval(await transferApproval(request.id, nextHandler));
      setDecisionNotice(request.id, t('approvals.transferred_notice', { title: request.title }));
    } catch {
      setDecisionNotice(request.id, t('approvals.update_failed'));
    }
    return;
  }

  requests.value = requests.value.map((item) =>
    item.id === request.id ? { ...item, stage: nextHandler, currentHandler: nextHandler } : item,
  );
  setApprovalOverride(request.id, { handler: nextHandler });
  decisionNotices.value = {
    ...decisionNotices.value,
    [request.id]: t('approvals.transferred_notice', { title: request.title }),
  };
  closeTransferPicker();
}

async function saveDraftRequest(): Promise<void> {
  if (!requestEditorOpen.value) return;

  const requestId = requestDraftId.value;
  const title = requestDraftTitle.value.trim() || t('approvals.default_request_title');
  const requester = requestDraftRequester.value.trim() || t('approvals.default_requester');
  const due = requestDraftDue.value.trim() || t('calls.call_just_now');

  // 后端模式：真实创建并落库，以后端返回为准
  if (backendMode) {
    requestEditorOpen.value = true;
    const template = selectedTemplate.value;
    const trimmedForm = Object.fromEntries(
      Object.entries(formData.value).filter(([, value]) => String(value).trim() !== ''),
    );
    try {
      const created = await createApproval({
        title,
        requester,
        ...(template ? { templateId: template.id } : { stages: [t('approvals.status_manager')] }),
        ...(Object.keys(trimmedForm).length > 0 ? { formData: trimmedForm } : {}),
      });
      const mapped = mapBackendApproval(created);
      requests.value = [mapped, ...requests.value.filter((item) => item.id !== created.id)];
      setApprovalOverride(created.id, { stageIndex: created.currentStageIndex });
      selectedRequestId.value = created.id;
      activeQueue.value = created.status;
      setDecisionNotice(created.id, t('approvals.created_notice', { title }));
    } catch {
      setDecisionNotice(requestId, t('approvals.update_failed'));
    } finally {
      requestEditorOpen.value = false;
    }
    return;
  }

  requests.value = requests.value.map((item) =>
    item.id === requestId
      ? {
          ...item,
          title,
          requester,
          stage: t('approvals.status_manager'),
          due,
          currentHandler: t('approvals.status_manager'),
        }
      : item,
  );
  selectedRequestId.value = requestId;
  decisionNotices.value = {
    ...decisionNotices.value,
    [requestId]: t('approvals.created_notice', { title }),
  };
  requestEditorOpen.value = false;
}
</script>

<template>
  <WorkspacePageFrame :title="t('sidebar.approvals')" :subtitle="t('approvals.subtitle')" :icon="FileCheck2">
    <template #actions>
      <button
        data-testid="approvals-new-request"
        class="flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        @click="createRequest"
      >
        <Plus :size="16" />
        <span>{{ t('approvals.new_request') }}</span>
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
          <span class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">{{
            queue.label
          }}</span>
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
          {{ t('approvals.inbox_title') }}
        </h2>
        <span class="text-[12px] text-muted-foreground">
          {{ t('approvals.current_queue') }}：{{ activeQueueLabel }}
          <span v-if="selectedRequest"> · {{ t('approvals.current_request') }}：{{ selectedRequest.title }}</span>
        </span>
      </div>
      <div class="divide-y divide-border">
        <button
          v-for="request in filteredRequests"
          :key="request.id"
          :data-testid="`approvals-request-${request.id}`"
          class="grid w-full grid-cols-[minmax(0,1fr)_150px_96px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
          :class="selectedRequest?.id === request.id ? 'bg-primary/10' : ''"
          @click="selectRequest(request.id)"
        >
          <span class="min-w-0">
            <span class="block truncate text-[13px] font-semibold">{{ request.title }}</span>
            <span class="mt-1 block truncate text-[12px] text-muted-foreground">{{ request.requester }}</span>
          </span>
          <span class="text-[12px] text-muted-foreground">{{ request.stage }}</span>
          <span
            class="justify-self-start rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground"
          >
            {{ request.due }}
          </span>
        </button>
        <div
          v-if="filteredRequests.length === 0"
          class="px-4 py-12 text-center text-[13px] text-muted-foreground"
          data-testid="approvals-empty"
        >
          {{ t('approvals.no_requests') }}
        </div>
      </div>
      <div v-if="requestEditorOpen" class="border-t border-border p-4">
        <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)_120px_auto]">
          <input
            v-model="requestDraftTitle"
            data-testid="approvals-new-title"
            type="text"
            :placeholder="t('approvals.request_title_placeholder')"
            class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
          />
          <GroupMemberPicker v-model="requestDraftRequesterIds" :label="t('approvals.requester_placeholder')" />
          <input
            v-model="requestDraftDue"
            data-testid="approvals-new-due"
            type="text"
            :placeholder="t('approvals.due_placeholder')"
            class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
          />
          <button
            data-testid="approvals-save-new-request"
            class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            @click="saveDraftRequest"
          >
            {{ t('approvals.save_request') }}
          </button>
        </div>

        <!-- 审批模板 + 结构化表单（后端模式） -->
        <div v-if="backendMode && templates.length > 0" class="mt-3 grid gap-2">
          <label class="grid gap-1 text-[12px] font-semibold text-muted-foreground">
            {{ t('approvals.template_label') }}
            <select
              v-model="selectedTemplateId"
              data-testid="approvals-template-select"
              class="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-primary"
              @change="onSelectTemplate"
            >
              <option value="">{{ t('approvals.template_none') }}</option>
              <option v-for="template in templates" :key="template.id" :value="template.id">{{ template.name }}</option>
            </select>
          </label>
          <div v-if="selectedTemplate" class="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-2">
            <label
              v-for="field in selectedTemplate.fields"
              :key="field.key"
              class="grid gap-1 text-[11px] font-semibold text-muted-foreground"
            >
              {{ field.label }}<span v-if="field.required" class="text-destructive">*</span>
              <textarea
                v-if="field.type === 'textarea'"
                v-model="formData[field.key]"
                :data-testid="`approvals-form-${field.key}`"
                :rows="2"
                class="rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary"
              />
              <select
                v-else-if="field.type === 'select'"
                v-model="formData[field.key]"
                :data-testid="`approvals-form-${field.key}`"
                class="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-primary"
              >
                <option value="">{{ t('approvals.field_empty') }}</option>
                <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
              </select>
              <input
                v-else
                v-model="formData[field.key]"
                :data-testid="`approvals-form-${field.key}`"
                :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'"
                class="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-primary"
              />
            </label>
          </div>
        </div>
      </div>
      <div v-if="selectedRequest" class="border-t border-border px-4 py-3">
        <!-- 审批链：逐级流转 -->
        <div class="mb-3 flex flex-wrap items-center gap-1.5" data-testid="approvals-stage-chain">
          <template v-for="(stageName, index) in selectedRequest.stages" :key="stageName">
            <span
              class="rounded-md px-2 py-1 text-[11px] font-semibold"
              :class="
                index < selectedRequestStageIndex
                  ? 'bg-success/12 text-success'
                  : index === selectedRequestStageIndex
                    ? 'bg-primary/12 text-primary'
                    : 'bg-muted text-muted-foreground'
              "
            >
              {{ stageName }}
            </span>
            <span v-if="index < selectedRequest.stages.length - 1" class="text-[11px] text-muted-foreground">→</span>
          </template>
        </div>
        <dl
          v-if="selectedFormEntries.length > 0"
          class="mb-3 grid gap-1 rounded-lg border border-border p-3 text-[12px]"
          data-testid="approvals-form-detail"
        >
          <div v-for="[key, value] in selectedFormEntries" :key="key" class="flex gap-2">
            <dt class="shrink-0 font-semibold text-muted-foreground">{{ key }}</dt>
            <dd class="min-w-0 break-words">{{ value }}</dd>
          </div>
        </dl>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="grid gap-1 text-[12px] font-semibold text-muted-foreground">
            <span>{{ selectedRequestDecisionNotice }}</span>
            <span>{{ t('approvals.handler_label') }}：{{ selectedRequest.currentHandler }}</span>
          </span>
          <span class="flex flex-wrap gap-2">
            <button
              data-testid="approvals-transfer-selected"
              class="h-8 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
              @click="openTransferPicker"
            >
              {{ t('approvals.transfer') }}
            </button>
            <button
              data-testid="approvals-reject-selected"
              class="h-8 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
              @click="decideSelectedRequest('rejected')"
            >
              {{ t('approvals.reject') }}
            </button>
            <button
              data-testid="approvals-approve-selected"
              class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              @click="decideSelectedRequest('approved')"
            >
              {{ selectedRequestIsFinalStage ? t('approvals.approve') : t('approvals.approve_stage') }}
            </button>
          </span>
        </div>
        <div
          v-if="transferPickerOpen"
          class="mt-3 rounded-lg border border-border bg-muted/30 p-3"
          data-testid="approvals-transfer-picker"
        >
          <GroupMemberPicker v-model="transferMemberIds" :label="t('approvals.transfer_to')" />
          <div class="mt-3 flex justify-end gap-2">
            <button
              class="h-8 rounded-md px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              @click="closeTransferPicker"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              data-testid="approvals-transfer-confirm"
              class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="transferMemberIds.length === 0"
              @click="transferSelectedRequest"
            >
              {{ t('approvals.confirm_transfer') }}
            </button>
          </div>
        </div>
        <div class="mt-3 grid gap-2 rounded-lg border border-border p-3">
          <div class="flex items-center gap-2">
            <input
              v-model="approvalCommentDraft"
              data-testid="approvals-comment-input"
              type="text"
              :placeholder="t('approvals.comment_placeholder')"
              class="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
            />
            <button
              data-testid="approvals-add-comment"
              class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              @click="addApprovalComment"
            >
              {{ t('approvals.add_comment') }}
            </button>
          </div>
          <div class="grid gap-1 text-[12px] text-muted-foreground">
            <span v-for="comment in selectedRequest.comments" :key="comment"
              >{{ t('approvals.comment_prefix') }}：{{ comment }}</span
            >
            <span v-if="selectedRequest.comments.length === 0">{{ t('approvals.no_comments') }}</span>
          </div>
        </div>
      </div>
    </section>
  </WorkspacePageFrame>
</template>
