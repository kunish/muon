<script setup lang="ts">
import type { NotificationChannelId } from '../stores/settingsStore';
import { Label } from '@muon/ui/label';
import { Switch } from '@muon/ui/switch';
import { useSelector } from '@tanstack/vue-store';
import { AtSign, BellRing, CalendarDays, ClipboardCheck, MessageSquare, Volume2 } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import {
  selectActiveNotificationChannelCount,
  selectNormalizedNotificationChannels,
  setBadgeCount,
  setDndEnd,
  setDndStart,
  setNotificationChannel,
  setNotificationPreview,
  setNotificationsEnabled as setNotificationsEnabledStore,
  setNotificationSound,
  settingsStore,
} from '@/shared/stores/settingsStore';

const { t } = useI18n();

const notificationsEnabled = useSelector(settingsStore, (s) => s.notificationsEnabled);
const notificationPreview = useSelector(settingsStore, (s) => s.notificationPreview);
const notificationSound = useSelector(settingsStore, (s) => s.notificationSound);
const badgeCount = useSelector(settingsStore, (s) => s.badgeCount);
const dndStart = useSelector(settingsStore, (s) => s.dndStart);
const dndEnd = useSelector(settingsStore, (s) => s.dndEnd);
const activeNotificationChannelCount = useSelector(settingsStore, selectActiveNotificationChannelCount);
const channelStates = useSelector(settingsStore, selectNormalizedNotificationChannels);

const notificationChannels: {
  id: NotificationChannelId;
  title: () => string;
  desc: () => string;
  icon: typeof MessageSquare;
}[] = [
  {
    id: 'messages',
    title: () => t('settings.channel_messages'),
    desc: () => t('settings.channel_messages_desc'),
    icon: MessageSquare,
  },
  {
    id: 'mentions',
    title: () => t('settings.channel_mentions'),
    desc: () => t('settings.channel_mentions_desc'),
    icon: AtSign,
  },
  {
    id: 'calendar',
    title: () => t('settings.channel_calendar'),
    desc: () => t('settings.channel_calendar_desc'),
    icon: CalendarDays,
  },
  {
    id: 'approvals',
    title: () => t('settings.channel_approvals'),
    desc: () => t('settings.channel_approvals_desc'),
    icon: ClipboardCheck,
  },
];

function requestSystemNotificationPermission(): void {
  const NotificationCtor = globalThis.Notification;
  if (typeof NotificationCtor?.requestPermission !== 'function') return;

  if (NotificationCtor.permission !== 'default') return;

  void NotificationCtor.requestPermission();
}

function setNotificationsEnabled(enabled: boolean): void {
  setNotificationsEnabledStore(enabled);
  if (enabled) requestSystemNotificationPermission();
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-lg font-semibold">
      {{ t('settings.notification_title') }}
    </h2>

    <Label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.enable_notifications') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.enable_notifications_desc') }}</div>
      </div>
      <Switch
        data-testid="settings-enable-notifications"
        :model-value="notificationsEnabled"
        @update:model-value="setNotificationsEnabled"
      />
    </Label>

    <Label class="flex items-center justify-between">
      <div>
        <div class="text-sm">{{ t('settings.message_preview') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('settings.message_preview_desc') }}</div>
      </div>
      <Switch :model-value="notificationPreview" @update:model-value="setNotificationPreview" />
    </Label>

    <Label class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Volume2 :size="18" class="text-muted-foreground" />
        <div>
          <div class="text-sm">{{ t('settings.notification_sound') }}</div>
          <div class="text-xs text-muted-foreground">{{ t('settings.notification_sound_desc') }}</div>
        </div>
      </div>
      <Switch
        :model-value="notificationSound"
        data-testid="settings-notification-sound"
        @update:model-value="setNotificationSound"
      />
    </Label>

    <Label class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <BellRing :size="18" class="text-muted-foreground" />
        <div>
          <div class="text-sm">{{ t('settings.badge_count') }}</div>
          <div class="text-xs text-muted-foreground">{{ t('settings.badge_count_desc') }}</div>
        </div>
      </div>
      <Switch :model-value="badgeCount" data-testid="settings-badge-count" @update:model-value="setBadgeCount" />
    </Label>

    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-medium">
            {{ t('settings.notification_channels') }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ t('settings.notification_channels_desc') }}
          </div>
        </div>
        <div
          data-testid="settings-notification-channel-summary"
          class="shrink-0 rounded-md bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground"
        >
          {{ t('settings.notification_channel_summary', { count: activeNotificationChannelCount }) }}
        </div>
      </div>

      <div class="grid gap-2">
        <Label
          v-for="channel in notificationChannels"
          :key="channel.id"
          class="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
          :class="!notificationsEnabled ? 'opacity-60' : ''"
        >
          <div class="flex min-w-0 items-center gap-3">
            <component :is="channel.icon" :size="18" class="shrink-0 text-muted-foreground" />
            <div class="min-w-0">
              <div class="truncate text-sm">
                {{ channel.title() }}
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {{ channel.desc() }}
              </div>
            </div>
          </div>
          <Switch
            :data-testid="`settings-channel-${channel.id}`"
            :model-value="channelStates[channel.id]"
            :disabled="!notificationsEnabled"
            @update:model-value="(val: boolean) => setNotificationChannel(channel.id, val)"
          />
        </Label>
      </div>
    </div>

    <div class="space-y-2">
      <div class="text-sm">
        {{ t('settings.dnd') }}
      </div>
      <div class="flex items-center gap-2">
        <input
          :value="dndStart"
          type="time"
          class="h-8 px-2 text-sm rounded border border-border bg-background outline-none"
          @input="(e) => setDndStart((e.target as HTMLInputElement).value)"
        />
        <span class="text-sm text-muted-foreground">{{ t('settings.dnd_to') }}</span>
        <input
          :value="dndEnd"
          type="time"
          class="h-8 px-2 text-sm rounded border border-border bg-background outline-none"
          @input="(e) => setDndEnd((e.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>
