<script setup lang="ts">
import { useContactList } from '@shared/composables/useContactList';
import { Mic, MicOff, Phone, PhoneCall, PhoneOff, Plus, ScreenShare, UserPlus, Video } from 'lucide-vue-next';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import GroupMemberPicker from '@/features/contacts/components/GroupMemberPicker.vue';

const { t } = useI18n();
const contactList = useContactList();

const callMode = shallowRef<'video' | 'audio'>('video');
const selectedCallId = shallowRef('call-1');
const callInvitePickerOpen = shallowRef(false);
const callInviteIds = ref<string[]>([]);

interface CallRecord {
  id: string;
  title: string;
  type: string;
  time: string;
  status: string;
  durationMinutes: number;
  hasNotes?: boolean;
  hasRecording?: boolean;
  icon: typeof Video;
}

interface CallControlState {
  isMuted: boolean;
  isSharingScreen: boolean;
  participants: string[];
  notice: string;
}

function defaultCallControlState(): CallControlState {
  return {
    isMuted: false,
    isSharingScreen: false,
    participants: ['我'],
    notice: t('calls.call_ready'),
  };
}

const calls = shallowRef<CallRecord[]>([
  {
    id: 'call-1',
    title: '设计评审',
    type: t('calls.video_call_type'),
    time: '10:00',
    status: t('calls.call_recorded'),
    durationMinutes: 20,
    hasRecording: true,
    icon: Video,
  },
  {
    id: 'call-2',
    title: '故障复盘跟进',
    type: t('calls.audio_call_type'),
    time: '13:30',
    status: t('calls.call_notes_hint'),
    durationMinutes: 16,
    icon: PhoneCall,
  },
  {
    id: 'call-3',
    title: '客户反馈评审',
    type: t('calls.video_call_type'),
    time: '昨天',
    status: t('calls.call_shared'),
    durationMinutes: 18,
    icon: Video,
  },
]);
const callControlStates = shallowRef<Record<string, CallControlState>>({
  'call-1': defaultCallControlState(),
  'call-2': defaultCallControlState(),
  'call-3': defaultCallControlState(),
});

const activeCallCount = computed(
  () => calls.value.filter((call) => call.status === t('calls.call_in_progress')).length,
);
const recordedCallCount = computed(() => calls.value.filter((call) => call.hasRecording).length);
const completedCallDurations = computed(() =>
  calls.value.map((call) => call.durationMinutes).filter((duration) => duration > 0),
);
const averageCallDuration = computed(() => {
  if (completedCallDurations.value.length === 0) return 0;

  const total = completedCallDurations.value.reduce((sum, duration) => sum + duration, 0);
  return Math.round(total / completedCallDurations.value.length);
});
const callStats = computed(() => [
  {
    id: 'today',
    label: t('calls.today_calls'),
    value: `${calls.value.length}`,
    hint: t('calls.today_calls_hint', { count: activeCallCount.value }),
  },
  {
    id: 'duration',
    label: t('calls.avg_duration'),
    value: t('calls.minutes_short', { n: averageCallDuration.value }),
    hint: t('calls.avg_duration_hint'),
  },
  {
    id: 'recordings',
    label: t('calls.recordings'),
    value: `${recordedCallCount.value}`,
    hint: t('calls.recordings_hint'),
  },
]);

const callModeLabel = computed(() =>
  callMode.value === 'audio' ? t('calls.audio_call_type') : t('calls.video_call_type'),
);
const selectedCall = computed(() => calls.value.find((call) => call.id === selectedCallId.value) ?? calls.value[0]);
const selectedCallGeneratedNote = computed(() => {
  const call = selectedCall.value;
  if (!call?.hasNotes) return null;
  return call;
});
const selectedCallControlState = computed(() => {
  const call = selectedCall.value;
  if (!call) return defaultCallControlState();

  return callControlStates.value[call.id] ?? defaultCallControlState();
});

function updateSelectedCallControlState(updater: (state: CallControlState) => CallControlState): void {
  const call = selectedCall.value;
  if (!call) return;

  const currentState = selectedCallControlState.value;
  callControlStates.value = {
    ...callControlStates.value,
    [call.id]: updater({
      ...currentState,
      participants: [...currentState.participants],
    }),
  };
}

function createActiveCall(
  title: string,
  type: string,
  icon: typeof Video,
  nextParticipants: string[],
  notice: string,
): void {
  const callId = `call-${Date.now()}`;
  calls.value = [
    {
      id: callId,
      title,
      type,
      time: t('calls.call_just_now'),
      status: t('calls.call_in_progress'),
      durationMinutes: 0,
      icon,
    },
    ...calls.value,
  ];
  selectedCallId.value = callId;
  callControlStates.value = {
    ...callControlStates.value,
    [callId]: {
      isMuted: false,
      isSharingScreen: false,
      participants: nextParticipants,
      notice,
    },
  };
}

onMounted(() => {
  contactList.ensureContactsLoaded();
});

function toggleAudioMode(): void {
  callMode.value = callMode.value === 'audio' ? 'video' : 'audio';
}

function startCall(): void {
  createActiveCall(
    callMode.value === 'audio' ? t('calls.instantAudio') : t('calls.instant_video'),
    callModeLabel.value,
    callMode.value === 'audio' ? PhoneCall : Video,
    ['我'],
    t('calls.call_joined'),
  );
}

function selectCall(callId: string): void {
  selectedCallId.value = callId;
}

function generateNotes(): void {
  const call = selectedCall.value;
  if (!call) return;

  calls.value = calls.value.map((item) =>
    item.id === call.id ? { ...item, hasNotes: true, status: t('calls.call_notes_generated') } : item,
  );
}

function toggleMute(): void {
  updateSelectedCallControlState((state) => {
    const isMuted = !state.isMuted;
    return {
      ...state,
      isMuted,
      notice: isMuted ? t('calls.mic_muted') : t('calls.mic_unmuted'),
    };
  });
}

function toggleShareScreen(): void {
  updateSelectedCallControlState((state) => {
    const isSharingScreen = !state.isSharingScreen;
    return {
      ...state,
      isSharingScreen,
      notice: isSharingScreen ? t('calls.now_sharing') : t('calls.stopped_sharing'),
    };
  });
}

function fallbackName(userId: string): string {
  return userId.split(':')[0]?.replace(/^@/, '') || userId;
}

function displayNameForUserId(userId: string): string {
  return contactList.contacts.find((contact) => contact.userId === userId)?.displayName ?? fallbackName(userId);
}

function toggleCallInvitePicker(): void {
  if (callInvitePickerOpen.value) {
    closeCallInvitePicker();
    return;
  }

  contactList.ensureContactsLoaded();
  callInvitePickerOpen.value = true;
}

function closeCallInvitePicker(): void {
  callInviteIds.value = [];
  callInvitePickerOpen.value = false;
}

function inviteSelectedMembers(): void {
  const invitedNames = callInviteIds.value.map(displayNameForUserId);
  if (invitedNames.length === 0) return;

  updateSelectedCallControlState((state) => ({
    ...state,
    participants: [...state.participants, ...invitedNames.filter((name) => !state.participants.includes(name))],
    notice: t('calls.invited', { names: invitedNames.join(t('system_events.list_separator')) }),
  }));
  closeCallInvitePicker();
}

function endSelectedCall(): void {
  const call = selectedCall.value;
  if (!call) return;

  calls.value = calls.value.map((item) =>
    item.id === call.id ? { ...item, status: t('calls.call_status_ended') } : item,
  );
  updateSelectedCallControlState((state) => ({
    ...state,
    isMuted: false,
    isSharingScreen: false,
    notice: t('calls.call_ended', { title: call.title }),
  }));
}
</script>

<template>
  <WorkspacePageFrame :title="t('sidebar.calls')" :subtitle="t('calls.subtitle')" :icon="Phone">
    <template #actions>
      <button
        data-testid="calls-audio-mode"
        class="flex h-8 items-center gap-2 rounded-md border border-border bg-accent px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
        @click="toggleAudioMode"
      >
        <Mic :size="16" />
        <span>{{ t('calls.audio_mode') }}</span>
      </button>
      <button
        data-testid="calls-start"
        class="flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        @click="startCall"
      >
        <Plus :size="16" />
        <span>{{ t('calls.start_call') }}</span>
      </button>
    </template>

    <div class="grid gap-3 md:grid-cols-3">
      <div v-for="stat in callStats" :key="stat.id" class="workspace-surface rounded-lg p-4">
        <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ stat.label }}
        </div>
        <div class="mt-3 text-2xl font-semibold leading-8" :data-testid="`calls-stat-${stat.id}`">
          {{ stat.value }}
        </div>
        <p class="mt-1 text-[13px] text-muted-foreground" :data-testid="`calls-stat-${stat.id}-hint`">
          {{ stat.hint }}
        </p>
      </div>
    </div>
    <p class="text-[12px] font-semibold text-muted-foreground">
      {{ t('calls.current_mode') }}：{{ callModeLabel }}
      <span v-if="selectedCall">
        · {{ t('calls.current_call') }}：{{ selectedCall.title }} · {{ t('calls.call_type') }}：{{
          selectedCall.type
        }}</span
      >
    </p>

    <section class="workspace-surface overflow-hidden rounded-lg">
      <div class="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 class="text-[15px] font-semibold">
          {{ t('calls.control_title') }}
        </h2>
        <span class="text-[12px] text-muted-foreground">{{ selectedCallControlState.notice }}</span>
      </div>
      <div class="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="grid gap-2 text-[13px] leading-5">
          <span class="font-semibold text-foreground">{{ t('calls.current_meeting') }}：{{ selectedCall.title }}</span>
          <span class="text-muted-foreground"
            >{{ t('calls.mic_label') }}：{{
              selectedCallControlState.isMuted ? t('calls.mic_off') : t('calls.mic_on')
            }}</span
          >
          <span class="text-muted-foreground"
            >{{ t('calls.screen_share_label') }}：{{
              selectedCallControlState.isSharingScreen ? t('calls.screen_sharing') : t('calls.screen_not_sharing')
            }}</span
          >
          <span class="text-muted-foreground"
            >{{ t('calls.participants_label') }}：{{
              selectedCallControlState.participants.join(t('system_events.list_separator'))
            }}</span
          >
        </div>
        <div class="grid min-w-[240px] gap-2 sm:grid-cols-4 md:grid-cols-1">
          <button
            data-testid="calls-toggle-mute"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            @click="toggleMute"
          >
            <component :is="selectedCallControlState.isMuted ? Mic : MicOff" :size="14" />
            <span>{{ selectedCallControlState.isMuted ? t('calls.unmute') : t('calls.mute') }}</span>
          </button>
          <button
            data-testid="calls-toggle-share"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
            @click="toggleShareScreen"
          >
            <ScreenShare :size="14" />
            <span>{{
              selectedCallControlState.isSharingScreen ? t('calls.stop_share') : t('calls.share_screen')
            }}</span>
          </button>
          <button
            data-testid="calls-invite-member"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
            @click="toggleCallInvitePicker"
          >
            <UserPlus :size="14" />
            <span>{{ t('calls.invite_member') }}</span>
          </button>
          <button
            data-testid="calls-end-call"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-destructive/40 px-3 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
            @click="endSelectedCall"
          >
            <PhoneOff :size="14" />
            <span>{{ t('calls.end_call') }}</span>
          </button>
        </div>
        <div
          v-if="callInvitePickerOpen"
          class="rounded-lg border border-border bg-muted/20 p-3 md:col-span-2"
          data-testid="calls-invite-picker"
        >
          <GroupMemberPicker v-model="callInviteIds" />
          <div class="mt-3 flex justify-end gap-2">
            <button
              class="h-8 rounded-md px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              @click="closeCallInvitePicker"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              data-testid="calls-invite-selected"
              class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="callInviteIds.length === 0"
              @click="inviteSelectedMembers"
            >
              {{ t('contacts.invite') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="workspace-surface overflow-hidden rounded-lg">
      <div class="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 class="text-[15px] font-semibold">
          {{ t('calls.call_history_title') }}
        </h2>
        <span class="text-[12px] text-muted-foreground">{{ t('calls.recent_first') }}</span>
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
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-primary"
            >
              <component :is="call.icon" :size="18" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-[13px] font-semibold">{{ call.title }}</span>
              <span class="mt-1 block truncate text-[12px] text-muted-foreground">{{ call.type }}</span>
            </span>
          </span>
          <span class="text-[12px] text-muted-foreground">{{ call.time }}</span>
          <span
            class="justify-self-start rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground"
          >
            {{ call.status }}
          </span>
        </button>
      </div>
    </section>

    <section class="workspace-surface overflow-hidden rounded-lg">
      <div class="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 class="text-[15px] font-semibold">会议纪要</h2>
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
          <h3 class="text-[14px] font-semibold">会议纪要：{{ selectedCallGeneratedNote.title }}</h3>
          <div class="mt-3 grid gap-2 text-[13px] leading-5 text-muted-foreground">
            <p>会议总结：围绕 {{ selectedCallGeneratedNote.title }} 完成结论同步，并沉淀可追踪记录。</p>
            <p>待办提炼：同步评审结论</p>
            <p>后续协同：将纪要共享给相关成员并跟进状态。</p>
          </div>
        </template>
        <p v-else class="text-[13px] leading-5 text-muted-foreground">
          选择一条通话记录后生成会议纪要，沉淀结论、待办和会后协同。
        </p>
      </div>
    </section>
  </WorkspacePageFrame>
</template>
