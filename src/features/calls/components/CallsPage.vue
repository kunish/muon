<script setup lang="ts">
import { Mic, Phone, PhoneCall, Plus, Video } from 'lucide-vue-next'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue'

const { t } = useI18n()

const callMode = shallowRef<'video' | 'audio'>('video')

const calls = shallowRef([
  { id: 'call-1', title: '设计评审', type: '视频会议', time: '10:00', status: '已录制', icon: Video },
  { id: 'call-2', title: '故障复盘跟进', type: '语音通话', time: '13:30', status: '待补纪要', icon: PhoneCall },
  { id: 'call-3', title: '客户反馈评审', type: '视频会议', time: '昨天', status: '已共享', icon: Video },
])

const callStats = computed(() => [
  { id: 'stat-1', label: '今日通话', value: `${calls.value.length + 3}`, hint: '2 个已预约' },
  { id: 'stat-2', label: '平均时长', value: '18m', hint: '团队通话' },
  { id: 'stat-3', label: '录制文件', value: `${calls.value.filter(call => call.status === '已录制').length + 2}`, hint: '可共享' },
])

const callModeLabel = computed(() => callMode.value === 'audio' ? '语音通话' : '视频会议')

function toggleAudioMode(): void {
  callMode.value = callMode.value === 'audio' ? 'video' : 'audio'
}

function startCall(): void {
  calls.value = [
    {
      id: `call-${Date.now()}`,
      title: callMode.value === 'audio' ? '即时语音通话' : '即时视频会议',
      type: callModeLabel.value,
      time: '刚刚',
      status: '进行中',
      icon: callMode.value === 'audio' ? PhoneCall : Video,
    },
    ...calls.value,
  ]
}
</script>

<template>
  <WorkspacePageFrame
    :title="t('sidebar.calls')"
    subtitle="视频会议、语音通话和录制回放"
    :icon="Phone"
  >
    <template #actions>
      <button
        data-testid="calls-audio-mode"
        class="flex h-8 items-center gap-2 rounded-md border border-border bg-accent px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
        @click="toggleAudioMode"
      >
        <Mic :size="16" />
        <span>语音</span>
      </button>
      <button
        data-testid="calls-start"
        class="flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        @click="startCall"
      >
        <Plus :size="16" />
        <span>发起通话</span>
      </button>
    </template>

    <div class="grid gap-3 md:grid-cols-3">
      <div
        v-for="stat in callStats"
        :key="stat.id"
        class="workspace-surface rounded-lg p-4"
      >
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ stat.label }}
        </div>
        <div class="mt-3 text-2xl font-semibold leading-8">
          {{ stat.value }}
        </div>
        <p class="mt-1 text-[13px] text-muted-foreground">
          {{ stat.hint }}
        </p>
      </div>
    </div>
    <p class="text-[12px] font-semibold text-muted-foreground">
      当前模式：{{ callModeLabel }}
    </p>

    <section class="workspace-surface overflow-hidden rounded-lg">
      <div class="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 class="text-[15px] font-semibold">
          通话记录
        </h2>
        <span class="text-[12px] text-muted-foreground">最近优先</span>
      </div>
      <div class="divide-y divide-border">
        <button
          v-for="call in calls"
          :key="call.id"
          class="grid w-full grid-cols-[minmax(0,1fr)_120px_110px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
        >
          <span class="flex min-w-0 items-center gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-primary">
              <component :is="call.icon" :size="18" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-[13px] font-semibold">{{ call.title }}</span>
              <span class="mt-1 block truncate text-[12px] text-muted-foreground">{{ call.type }}</span>
            </span>
          </span>
          <span class="text-[12px] text-muted-foreground">{{ call.time }}</span>
          <span class="justify-self-start rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            {{ call.status }}
          </span>
        </button>
      </div>
    </section>
  </WorkspacePageFrame>
</template>
