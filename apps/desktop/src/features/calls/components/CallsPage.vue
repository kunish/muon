<script setup lang="ts">
import { findOrCreateDm } from '@matrix/index';
import { useContactList } from '@shared/composables/useContactList';
import { useSelector } from '@tanstack/vue-store';
import { Mic, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Plus, Video } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import { openUrl } from '@/desktop/opener';
import GroupMemberPicker from '@/features/contacts/components/GroupMemberPicker.vue';
import { callStore, startCall } from '../stores/callStore';

const { t } = useI18n();
const contactList = useContactList();
const callHistory = useSelector(callStore, (s) => s.callHistory);

const callMode = ref<'audio' | 'video'>('video');
const launchPickerOpen = ref(false);
const launchIds = ref<string[]>([]);
const launching = ref(false);

const callModeLabel = computed(() =>
  callMode.value === 'audio' ? t('calls.audio_call_type') : t('calls.video_call_type'),
);

const history = computed(() => callHistory.value);
const completedCalls = computed(() => history.value.filter((entry) => entry.outcome === 'completed'));
const missedCount = computed(() => history.value.filter((entry) => entry.outcome === 'missed').length);
const averageDurationMinutes = computed(() => {
  const durations = completedCalls.value.map((entry) => entry.durationSec).filter((seconds) => seconds > 0);
  if (durations.length === 0) return 0;
  const total = durations.reduce((sum, seconds) => sum + seconds, 0);
  return Math.max(1, Math.round(total / durations.length / 60));
});

const callStats = computed(() => [
  { id: 'total', label: t('calls.total_calls'), value: `${history.value.length}`, hint: t('calls.recent_first') },
  {
    id: 'duration',
    label: t('calls.avg_duration'),
    value: t('calls.minutes_short', { n: averageDurationMinutes.value }),
    hint: t('calls.avg_duration_hint'),
  },
  { id: 'missed', label: t('calls.missed_calls'), value: `${missedCount.value}`, hint: t('calls.missed_hint') },
]);

function fallbackName(userId: string): string {
  return userId.split(':')[0]?.replace(/^@/, '') || userId;
}

function displayNameForUserId(userId: string): string {
  return contactList.contacts.find((contact) => contact.userId === userId)?.displayName ?? fallbackName(userId);
}

function toggleAudioMode(): void {
  callMode.value = callMode.value === 'audio' ? 'video' : 'audio';
}

// 1:1 通话仅支持单个对端，选择多人时保留最后一个
watch(launchIds, (ids) => {
  if (ids.length > 1) launchIds.value = [ids[ids.length - 1]!];
});

function openLaunchPicker(): void {
  contactList.ensureContactsLoaded();
  launchIds.value = [];
  launchPickerOpen.value = true;
}

function closeLaunchPicker(): void {
  launchIds.value = [];
  launchPickerOpen.value = false;
}

async function confirmLaunch(): Promise<void> {
  const targetId = launchIds.value[0];
  if (!targetId || launching.value) return;

  launching.value = true;
  try {
    const roomId = await findOrCreateDm(targetId);
    await startCall(roomId, targetId, displayNameForUserId(targetId), callMode.value);
    closeLaunchPicker();
  } finally {
    launching.value = false;
  }
}

function entryIcon(entry: (typeof history.value)[number]) {
  if (entry.outcome === 'missed') return PhoneMissed;
  if (entry.mode === 'video') return Video;
  return entry.direction === 'outgoing' ? PhoneOutgoing : PhoneIncoming;
}

function entryDirectionLabel(entry: (typeof history.value)[number]): string {
  if (entry.outcome === 'missed') return t('calls.missed_label');
  return entry.direction === 'outgoing' ? t('calls.outgoing_label') : t('calls.incoming_label');
}

function entryModeLabel(entry: (typeof history.value)[number]): string {
  return entry.mode === 'video' ? t('calls.video_call_type') : t('calls.audio_call_type');
}

function openRecording(url: string): void {
  void openUrl(url);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatEndedAt(endedAt: number): string {
  return new Date(endedAt).toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(() => {
  contactList.ensureContactsLoaded();
});
</script>

<template>
  <WorkspacePageFrame :title="t('sidebar.calls')" :subtitle="t('calls.subtitle')" :icon="Phone">
    <template #actions>
      <button
        data-testid="calls-audio-mode"
        class="flex h-8 items-center gap-2 rounded-md border border-border bg-accent px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
        @click="toggleAudioMode"
      >
        <component :is="callMode === 'audio' ? Mic : Video" :size="16" />
        <span>{{ callModeLabel }}</span>
      </button>
      <button
        data-testid="calls-start"
        class="flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        @click="openLaunchPicker"
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

    <p class="text-[12px] font-semibold text-muted-foreground">{{ t('calls.current_mode') }}：{{ callModeLabel }}</p>

    <section
      v-if="launchPickerOpen"
      class="workspace-surface overflow-hidden rounded-lg"
      data-testid="calls-launch-picker"
    >
      <div class="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 class="text-[15px] font-semibold">{{ t('calls.start_call') }}</h2>
        <span class="text-[12px] text-muted-foreground">{{ callModeLabel }}</span>
      </div>
      <div class="p-4">
        <GroupMemberPicker v-model="launchIds" />
        <div class="mt-3 flex justify-end gap-2">
          <button
            class="h-8 rounded-md px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            @click="closeLaunchPicker"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            data-testid="calls-launch-confirm"
            class="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="launchIds.length === 0 || launching"
            @click="confirmLaunch"
          >
            {{ t('calls.start_call') }}
          </button>
        </div>
      </div>
    </section>

    <section class="workspace-surface overflow-hidden rounded-lg">
      <div class="flex h-11 items-center justify-between border-b border-border px-4">
        <h2 class="text-[15px] font-semibold">{{ t('calls.call_history_title') }}</h2>
        <span class="text-[12px] text-muted-foreground">{{ t('calls.recent_first') }}</span>
      </div>
      <div
        v-if="history.length === 0"
        class="p-8 text-center text-[13px] text-muted-foreground"
        data-testid="calls-empty"
      >
        {{ t('calls.history_empty') }}
      </div>
      <div v-else class="divide-y divide-border">
        <div
          v-for="entry in history"
          :key="entry.id"
          :data-testid="`calls-record-${entry.id}`"
          class="grid w-full grid-cols-[minmax(0,1fr)_120px_110px] items-center gap-4 px-4 py-3 text-left"
        >
          <span class="flex min-w-0 items-center gap-3">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted"
              :class="entry.outcome === 'missed' ? 'text-destructive' : 'text-primary'"
            >
              <component :is="entryIcon(entry)" :size="18" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-[13px] font-semibold">{{ entry.peerName }}</span>
              <span class="mt-1 block truncate text-[12px] text-muted-foreground">
                {{ entryDirectionLabel(entry) }} · {{ entryModeLabel(entry) }}
                <button
                  v-if="entry.recordingUrl"
                  type="button"
                  :data-testid="`calls-record-playback-${entry.id}`"
                  class="ml-1 font-semibold text-primary hover:underline"
                  @click="openRecording(entry.recordingUrl)"
                >
                  · {{ t('calls.play_recording') }}
                </button>
              </span>
            </span>
          </span>
          <span class="text-[12px] text-muted-foreground">{{ formatEndedAt(entry.endedAt) }}</span>
          <span
            class="justify-self-start rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground"
          >
            {{ entry.outcome === 'missed' ? t('calls.missed_label') : formatDuration(entry.durationSec) }}
          </span>
        </div>
      </div>
    </section>
  </WorkspacePageFrame>
</template>
