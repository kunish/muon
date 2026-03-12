<script setup lang="ts">
import { getRoomTopic } from '@matrix/rooms'
import { AtSign, Bell, Hash, Lock, MessageSquareText, MoreHorizontal, Pin, Search, Star, Timer, Users } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isDirectRoom } from '@/shared/lib/roomUtils'
import { useCurrentRoom } from '../composables/useCurrentRoom'
import { useChatStore } from '../stores/chatStore'
import DisappearingMessageSettings from './DisappearingMessageSettings.vue'

const { room, currentRoomId } = useCurrentRoom()
const store = useChatStore()
const { t } = useI18n()
const showDisappearing = ref(false)
const showMore = ref(false)

const isDirect = computed(() => currentRoomId.value ? isDirectRoom(currentRoomId.value) : false)

const _memberCount = computed(() => {
  if (!room.value)
    return 0
  return room.value.getJoinedMemberCount()
})

const isEncrypted = computed(() => {
  if (!room.value)
    return false
  return room.value.hasEncryptionStateEvent()
})

/** 频道话题，截断显示在频道名后方 */
const roomTopic = computed(() => {
  if (!currentRoomId.value)
    return ''
  return getRoomTopic(currentRoomId.value)
})

function toggleStarred() {
  showMore.value = false
  store.toggleSidePanel('starred')
}

function openDisappearing() {
  showMore.value = false
  showDisappearing.value = !showDisappearing.value
}
</script>

<template>
  <div v-if="room" class="shrink-0 border-b border-border bg-background">
    <!-- Header row -->
    <div class="flex items-center h-12 px-4 gap-2">
      <!-- Left: channel icon + name + topic -->
      <div class="flex items-center gap-1.5 min-w-0 flex-1">
        <AtSign v-if="isDirect" :size="20" class="text-muted-foreground shrink-0" />
        <Lock v-else-if="isEncrypted" :size="20" class="text-success shrink-0" />
        <Hash v-else :size="20" class="text-muted-foreground shrink-0" />
        <span class="font-semibold text-[15px] text-foreground truncate shrink-0">{{ room.name }}</span>
        <template v-if="roomTopic">
          <div class="w-px h-4 bg-border/60 mx-1.5 shrink-0" />
          <span
            class="text-xs text-muted-foreground truncate"
            :title="roomTopic"
          >{{ roomTopic }}</span>
        </template>
      </div>

      <!-- Right: action buttons -->
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          class="header-btn"
          :title="t('chat.thread_inbox')"
          :class="store.activeSidePanel === 'threads' && 'header-btn-active'"
          @click="store.toggleSidePanel('threads')"
        >
          <MessageSquareText :size="18" />
        </button>
        <button
          class="header-btn"
          :title="t('chat.notification_settings')"
          :class="store.activeSidePanel === 'settings' && 'header-btn-active'"
          @click="store.toggleSidePanel('settings')"
        >
          <Bell :size="18" />
        </button>
        <button
          class="header-btn"
          :title="t('chat.pinned_messages')"
          :class="store.activeSidePanel === 'pinned' && 'header-btn-active'"
          @click="store.toggleSidePanel('pinned')"
        >
          <Pin :size="18" />
        </button>
        <button
          class="header-btn"
          :title="t('chat.member_list')"
          :class="store.activeSidePanel === 'members' && 'header-btn-active'"
          @click="store.toggleSidePanel('members')"
        >
          <Users :size="18" />
        </button>
        <button
          class="header-search-btn"
          :title="t('chat.search_messages')"
          :class="store.activeSidePanel === 'search' && 'header-btn-active'"
          @click="store.toggleSidePanel('search')"
        >
          <div class="search-pill">
            <Search :size="14" class="shrink-0" />
            <span class="truncate">{{ t('common.search') }}</span>
          </div>
        </button>

        <div class="relative">
          <button
            class="header-btn"
            :title="t('chat.more_actions')"
            aria-haspopup="menu"
            :aria-expanded="showMore"
            @click="showMore = !showMore"
          >
            <MoreHorizontal :size="18" />
          </button>

          <div
            v-if="showMore"
            role="menu"
            class="absolute right-0 top-full z-30 mt-1 min-w-[170px] rounded-md bg-popover p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          >
            <button role="menuitem" class="header-menu-item" @click="toggleStarred">
              <Star :size="14" />
              <span>{{ t('chat.starred_messages') }}</span>
            </button>
            <button role="menuitem" class="header-menu-item" @click="openDisappearing">
              <Timer :size="14" />
              <span>{{ t('chat.disappearing_messages') }}</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="showMore" class="fixed inset-0 z-20" @click="showMore = false" />
    </div>

    <DisappearingMessageSettings
      v-if="showDisappearing && currentRoomId"
      :room-id="currentRoomId"
      @close="showDisappearing = false"
    />
  </div>
</template>

<style scoped>
.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: var(--radius);
  color: var(--color-muted-foreground);
  transition: all 0.15s ease;
  cursor: pointer;
}
.header-btn:hover {
  background: var(--color-accent);
  color: var(--color-foreground);
}
.header-btn-active {
  color: var(--color-foreground);
  background: var(--color-accent);
}

.header-search-btn {
  display: flex;
  align-items: center;
  border-radius: var(--radius);
  color: var(--color-muted-foreground);
  transition: all 0.15s ease;
  cursor: pointer;
}

.search-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 140px;
  border-radius: var(--radius);
  background: var(--color-input);
  padding: 6px 8px;
  font-size: 12px;
  color: var(--color-muted-foreground);
}

.header-search-btn:hover .search-pill {
  background: color-mix(in srgb, var(--color-input) 70%, var(--color-accent));
  color: var(--color-foreground);
}

.header-btn-active .search-pill {
  background: var(--color-accent);
  color: var(--color-foreground);
}

.header-menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  border-radius: var(--radius);
  padding: 6px 8px;
  color: var(--color-muted-foreground);
  cursor: pointer;
  transition: all 0.12s ease;
}

.header-menu-item:hover {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
</style>
