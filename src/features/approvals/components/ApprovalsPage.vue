<script setup lang="ts">
import { CheckSquare, Clock3, FileCheck2, Plus, ShieldCheck } from 'lucide-vue-next'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue'

const { t } = useI18n()

const activeQueue = shallowRef('pending')

const approvalQueues = [
  { id: 'pending', label: '待处理', hint: '3 项今日到期', icon: Clock3 },
  { id: 'approved', label: '已通过', hint: '本月累计', icon: CheckSquare },
  { id: 'compliance', label: '合规检查', hint: '需要复核', icon: ShieldCheck },
]

const requests = shallowRef([
  { id: 'request-1', queue: 'compliance', title: '供应商安全例外申请', requester: '运营团队', stage: '法务复核', due: '今日' },
  { id: 'request-2', queue: 'pending', title: '生产访问申请', requester: '工程团队', stage: '主管审批', due: '明日' },
  { id: 'request-3', queue: 'pending', title: '上线预算调整', requester: '增长团队', stage: '财务确认', due: '周五' },
  { id: 'request-4', queue: 'approved', title: '设计资源采购', requester: '设计团队', stage: '已归档', due: '已通过' },
])

const activeQueueLabel = computed(() => approvalQueues.find(queue => queue.id === activeQueue.value)?.label ?? '待处理')

const queueCards = computed(() => approvalQueues.map(queue => ({
  ...queue,
  value: requests.value.filter(request => request.queue === queue.id).length,
})))

const filteredRequests = computed(() => requests.value.filter(request => request.queue === activeQueue.value))

function createRequest(): void {
  requests.value = [
    { id: `request-${Date.now()}`, queue: activeQueue.value, title: '临时审批申请', requester: '我', stage: '待提交', due: '刚刚' },
    ...requests.value,
  ]
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

    <div class="grid gap-3 md:grid-cols-3">
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
        <span class="text-[12px] text-muted-foreground">当前队列：{{ activeQueueLabel }}</span>
      </div>
      <div class="divide-y divide-border">
        <button
          v-for="request in filteredRequests"
          :key="request.id"
          class="grid w-full grid-cols-[minmax(0,1fr)_150px_96px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
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
    </section>
  </WorkspacePageFrame>
</template>
