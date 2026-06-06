<script setup lang="ts">
import { getClient } from '@matrix/client';
import { Avatar } from '@muon/ui/avatar';
import { useSelector } from '@tanstack/vue-store';
import { Crown, Search, Shield, ShieldCheck, X } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { chatStore, closeSidePanel } from '../stores/chatStore';
import UserInfoPanel from './UserInfoPanel.vue';

const { t } = useI18n();
const currentRoomId = useSelector(chatStore, (s) => s.currentRoomId);
const searchQuery = ref('');
const infoPanelUserId = ref<string | null>(null);
const infoPanelPosition = ref({ x: 0, y: 0 });

interface MemberInfo {
  userId: string;
  displayName: string;
  mxcAvatar?: string;
  powerLevel: number;
  membership: string;
  statusMsg?: string;
}

const members = computed<MemberInfo[]>(() => {
  const client = getClient();
  const roomId = currentRoomId.value;
  if (!roomId) return [];

  const room = client.getRoom(roomId);
  if (!room) return [];

  const joinedMembers = room.getJoinedMembers();
  return joinedMembers
    .map((m) => ({
      userId: m.userId,
      displayName: m.name || m.userId.split(':')[0]?.slice(1) || m.userId,
      mxcAvatar: m.getMxcAvatarUrl() || undefined,
      powerLevel: room.getMember(m.userId)?.powerLevel ?? 0,
      membership: 'join',
      statusMsg: client.getUser(m.userId)?.presenceStatusMsg || undefined,
    }))
    .sort((a, b) => {
      // 管理员排前面
      if (a.powerLevel !== b.powerLevel) return b.powerLevel - a.powerLevel;
      return a.displayName.localeCompare(b.displayName);
    });
});

const filteredMembers = computed(() => {
  if (!searchQuery.value.trim()) return members.value;
  const q = searchQuery.value.toLowerCase();
  return members.value.filter((m) => m.displayName.toLowerCase().includes(q) || m.userId.toLowerCase().includes(q));
});

function getPowerLevelIcon(level: number) {
  if (level >= 100) return Crown;
  if (level >= 50) return ShieldCheck;
  if (level > 0) return Shield;
  return null;
}

function getPowerLevelLabel(level: number) {
  if (level >= 100) return t('chat.role_owner');
  if (level >= 50) return t('chat.role_admin');
  if (level > 0) return t('chat.role_moderator');
  return '';
}

function openMemberProfile(member: MemberInfo, event: MouseEvent | KeyboardEvent) {
  const target = event.currentTarget as HTMLElement | null;
  const rect = target?.getBoundingClientRect();
  infoPanelPosition.value = rect
    ? { x: rect.right, y: rect.top }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  infoPanelUserId.value = member.userId;
}

function closeInfoPanel() {
  infoPanelUserId.value = null;
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
      <span class="font-medium text-sm">{{ t('chat.member_list') }} ({{ members.length }})</span>
      <button class="p-1 rounded-md hover:bg-accent text-muted-foreground" @click="closeSidePanel()">
        <X :size="16" />
      </button>
    </div>

    <!-- Search -->
    <div class="px-3 py-2 shrink-0">
      <div class="relative">
        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" :size="13" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('chat.search_members')"
          class="w-full h-[30px] pl-7.5 pr-3 text-[12px] rounded-lg bg-accent/40 border border-transparent outline-none placeholder:text-muted-foreground/35 transition-all duration-200 focus:bg-accent/70 focus:border-ring/20"
        />
      </div>
    </div>

    <!-- Member list -->
    <div class="flex-1 overflow-y-auto px-2">
      <div
        v-for="member in filteredMembers"
        :key="member.userId"
        :data-testid="`chat-member-row-${member.userId}`"
        role="button"
        tabindex="0"
        class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
        @click="openMemberProfile(member, $event)"
        @keydown.enter.prevent="openMemberProfile(member, $event)"
        @keydown.space.prevent="openMemberProfile(member, $event)"
      >
        <!-- Avatar -->
        <Avatar :src="member.mxcAvatar" :alt="member.displayName" :color-id="member.userId" size="sm" />

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1">
            <span class="text-sm truncate">{{ member.displayName }}</span>
            <component
              :is="getPowerLevelIcon(member.powerLevel)"
              v-if="getPowerLevelIcon(member.powerLevel)"
              :size="12"
              class="shrink-0"
              :class="member.powerLevel >= 100 ? 'text-warning' : 'text-primary'"
              :title="getPowerLevelLabel(member.powerLevel)"
            />
          </div>
          <div class="text-[11px] text-muted-foreground/60 truncate">
            {{ member.userId }}
          </div>
          <div v-if="member.statusMsg" class="text-[10px] text-muted-foreground/50 truncate">
            {{ member.statusMsg }}
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="filteredMembers.length === 0"
        class="flex flex-col items-center justify-center py-8 text-muted-foreground/40"
      >
        <span class="text-xs">{{ searchQuery ? t('chat.no_matching_members') : t('chat.no_members') }}</span>
      </div>

      <UserInfoPanel
        :room="null"
        :user-id="infoPanelUserId"
        :room-id="currentRoomId"
        :position="infoPanelPosition"
        @close="closeInfoPanel"
      />
    </div>
  </div>
</template>
