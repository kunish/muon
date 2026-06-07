<script setup lang="ts">
import { useSelector } from '@tanstack/vue-store';
import { routeParam } from '@/shared/lib/routeParams';
import { useNotificationSound } from '../composables/useNotificationSound';
import { useScheduledMessageFlush } from '../composables/useScheduledMessageFlush';
import { chatStore, setCurrentRoom, setCurrentRoomFromRoute } from '../stores/chatStore';
import ChatWindow from './ChatWindow.vue';
import EmptyState from './EmptyState.vue';

const route = useRoute();
const currentRoomId = useSelector(chatStore, (s) => s.currentRoomId);

// 启用消息通知提示音
useNotificationSound();
// 到点发送已排程的定时消息
useScheduledMessageFlush();

watch(
  () => routeParam(route, 'roomId') || routeParam(route, 'channelId'),
  (encodedRoomId) => {
    if (!encodedRoomId) {
      setCurrentRoom(null);
      return;
    }

    let roomId = encodedRoomId;
    try {
      roomId = decodeURIComponent(encodedRoomId);
    } catch {
      roomId = encodedRoomId;
    }

    if (routeParam(route, 'roomId')) setCurrentRoomFromRoute(roomId);
    else setCurrentRoom(roomId);
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex-1 flex h-full min-w-0">
    <!-- Chat window or empty state -->
    <ChatWindow v-if="currentRoomId" />
    <EmptyState v-else />
  </div>
</template>
