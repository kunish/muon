<script setup lang="ts">
import type { ContactCallLaunch } from '@/features/calls/stores/callLaunchStore'
import { Mic, MicOff, Phone, PhoneCall, PhoneOff, Plus, ScreenShare, UserPlus, Video } from 'lucide-vue-next'
import { computed, onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue'
import { consumePendingContactCall } from '@/features/calls/stores/callLaunchStore'

const { t } = useI18n()

const callMode = shallowRef<'video' | 'audio'>('video')
const selectedCallId = shallowRef('call-1')
const generatedNoteCallIds = shallowRef<string[]>([])

interface CallRecord {
  id: string
  title: string
  type: string
  time: string
  status: string
  icon: typeof Video
}

interface CallControlState {
  isMuted: boolean
  isSharingScreen: boolean
  participants: string[]
  notice: string
}

function defaultCallControlState(): CallControlState {
  return {
    isMuted: false,
    isSharingScreen: false,
    participants: ['我'],
    notice: '会中控制已就绪',
  }
}

const calls = shallowRef<CallRecord[]>([
  { id: 'call-1', title: '设计评审', type: '视频会议', time: '10:00', status: '已录制', icon: Video },
  { id: 'call-2', title: '故障复盘跟进', type: '语音通话', time: '13:30', status: '待补纪要', icon: PhoneCall },
  { id: 'call-3', title: '客户反馈评审', type: '视频会议', time: '昨天', status: '已共享', icon: Video },
])
const callControlStates = shallowRef<Record<string, CallControlState>>({
  'call-1': defaultCallControlState(),
  'call-2': defaultCallControlState(),
  'call-3': defaultCallControlState(),
})

const callStats = computed(() => [
  { id: 'stat-1', label: '今日通话', value: `${calls.value.length + 3}`, hint: '2 个已预约' },
  { id: 'stat-2', label: '平均时长', value: '18m', hint: '团队通话' },
  { id: 'stat-3', label: '录制文件', value: `${calls.value.filter(call => call.status === '已录制').length + 2}`, hint: '可共享' },
])

const callModeLabel = computed(() => callMode.value === 'audio' ? '语音通话' : '视频会议')
const selectedCall = computed(() => calls.value.find(call => call.id === selectedCallId.value) ?? calls.value[0])
const selectedCallGeneratedNote = computed(() => {
  const call = selectedCall.value
  if (!call || !generatedNoteCallIds.value.includes(call.id))
    return null
  return call
})
const selectedCallControlState = computed(() => {
  const call = selectedCall.value
  if (!call)
    return defaultCallControlState()

  return callControlStates.value[call.id] ?? defaultCallControlState()
})

function updateSelectedCallControlState(updater: (state: CallControlState) => CallControlState): void {
  const call = selectedCall.value
  if (!call)
    return

  const currentState = selectedCallControlState.value
  callControlStates.value = {
    ...callControlStates.value,
    [call.id]: updater({
      ...currentState,
      participants: [...currentState.participants],
    }),
  }
}

function createActiveCall(title: string, type: string, icon: typeof Video, nextParticipants: string[], notice: string): void {
  const callId = `call-${Date.now()}`
  calls.value = [
    {
      id: callId,
      title,
      type,
      time: '刚刚',
      status: '进行中',
      icon,
    },
    ...calls.value,
  ]
  selectedCallId.value = callId
  callControlStates.value = {
    ...callControlStates.value,
    [callId]: {
      isMuted: false,
      isSharingScreen: false,
      participants: nextParticipants,
      notice,
    },
  }
}

function startContactCall(call: ContactCallLaunch): void {
  const contactName = call.displayName || call.userId
  callMode.value = call.mode
  const type = call.mode === 'audio' ? '语音通话' : '视频会议'
  createActiveCall(
    `与 ${contactName} 的${type}`,
    type,
    call.mode === 'audio' ? PhoneCall : Video,
    ['我', contactName],
    `已接通：${contactName}`,
  )
}

onMounted(() => {
  const pendingCall = consumePendingContactCall()
  if (pendingCall)
    startContactCall(pendingCall)
})

function toggleAudioMode(): void {
  callMode.value = callMode.value === 'audio' ? 'video' : 'audio'
}

function startCall(): void {
  createActiveCall(
    callMode.value === 'audio' ? '即时语音通话' : '即时视频会议',
    callModeLabel.value,
    callMode.value === 'audio' ? PhoneCall : Video,
    ['我'],
    '已进入会议',
  )
}

function selectCall(callId: string): void {
  selectedCallId.value = callId
}

function generateNotes(): void {
  if (!selectedCall.value)
    return
  generatedNoteCallIds.value = [...new Set([...generatedNoteCallIds.value, selectedCall.value.id])]
}

function toggleMute(): void {
  updateSelectedCallControlState((state) => {
    const isMuted = !state.isMuted
    return {
      ...state,
      isMuted,
      notice: isMuted ? '麦克风已静音' : '麦克风已开启',
    }
  })
}

function toggleShareScreen(): void {
  updateSelectedCallControlState((state) => {
    const isSharingScreen = !state.isSharingScreen
    return {
      ...state,
      isSharingScreen,
      notice: isSharingScreen ? '正在共享屏幕' : '已停止共享屏幕',
    }
  })
}

function inviteMember(): void {
  updateSelectedCallControlState(state => ({
    ...state,
    participants: state.participants.includes('产品团队') ? state.participants : [...state.participants, '产品团队'],
    notice: '已邀请：产品团队',
  }))
}

function endSelectedCall(): void {
  const call = selectedCall.value
  if (!call)
    return

  calls.value = calls.value.map(item => item.id === call.id
    ? { ...item, status: '已结束' }
    : item)
  updateSelectedCallControlState(state => ({
    ...state,
    isMuted: false,
    isSharingScreen: false,
    notice: `通话已结束：${call.title}`,
  }))
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
      <span v-if="selectedCall"> · 当前通话：{{ selectedCall.title }} · 会议类型：{{ selectedCall.type }}</span>
    </p>

    <section class="workspace-surface overflow-hidden rounded-lg">
      <div class="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 class="text-[15px] font-semibold">
          会中控制
        </h2>
        <span class="text-[12px] text-muted-foreground">{{ selectedCallControlState.notice }}</span>
      </div>
      <div class="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="grid gap-2 text-[13px] leading-5">
          <span class="font-semibold text-foreground">当前会议：{{ selectedCall.title }}</span>
          <span class="text-muted-foreground">麦克风：{{ selectedCallControlState.isMuted ? '已静音' : '已开启' }}</span>
          <span class="text-muted-foreground">共享屏幕：{{ selectedCallControlState.isSharingScreen ? '正在共享' : '未共享' }}</span>
          <span class="text-muted-foreground">参会人：{{ selectedCallControlState.participants.join('、') }}</span>
        </div>
        <div class="grid min-w-[240px] gap-2 sm:grid-cols-4 md:grid-cols-1">
          <button
            data-testid="calls-toggle-mute"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            @click="toggleMute"
          >
            <component :is="selectedCallControlState.isMuted ? Mic : MicOff" :size="14" />
            <span>{{ selectedCallControlState.isMuted ? '取消静音' : '静音' }}</span>
          </button>
          <button
            data-testid="calls-toggle-share"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
            @click="toggleShareScreen"
          >
            <ScreenShare :size="14" />
            <span>{{ selectedCallControlState.isSharingScreen ? '停止共享' : '共享屏幕' }}</span>
          </button>
          <button
            data-testid="calls-invite-member"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
            @click="inviteMember"
          >
            <UserPlus :size="14" />
            <span>邀请成员</span>
          </button>
          <button
            data-testid="calls-end-call"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-destructive/40 px-3 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
            @click="endSelectedCall"
          >
            <PhoneOff :size="14" />
            <span>结束通话</span>
          </button>
        </div>
      </div>
    </section>

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
          :data-testid="`calls-record-${call.id}`"
          class="grid w-full grid-cols-[minmax(0,1fr)_120px_110px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
          :class="selectedCall?.id === call.id ? 'bg-primary/8' : ''"
          @click="selectCall(call.id)"
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

    <section class="workspace-surface overflow-hidden rounded-lg">
      <div class="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 class="text-[15px] font-semibold">
          会议纪要
        </h2>
        <button
          data-testid="calls-generate-notes"
          class="flex h-8 items-center rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
          @click="generateNotes"
        >
          生成纪要
        </button>
      </div>
      <div class="p-4">
        <template v-if="selectedCallGeneratedNote">
          <h3 class="text-[14px] font-semibold">
            会议纪要：{{ selectedCallGeneratedNote.title }}
          </h3>
          <div class="mt-3 grid gap-2 text-[13px] leading-5 text-muted-foreground">
            <p>会议总结：围绕 {{ selectedCallGeneratedNote.title }} 完成结论同步，并沉淀可追踪记录。</p>
            <p>待办提炼：同步评审结论</p>
            <p>后续协同：将纪要共享给相关成员并跟进状态。</p>
          </div>
        </template>
        <p v-else class="text-[13px] leading-5 text-muted-foreground">
          选择一条通话记录后生成本地会议纪要，用于沉淀结论、待办和会后协同。
        </p>
      </div>
    </section>
  </WorkspacePageFrame>
</template>
