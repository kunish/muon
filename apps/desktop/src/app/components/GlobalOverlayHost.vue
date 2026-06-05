<script setup lang="ts">
import { useSelector } from '@tanstack/vue-store';
import NewChatDialog from '@/features/chat/components/NewChatDialog.vue';
import ConfirmDialogHost from '@/shared/components/ConfirmDialogHost.vue';
import { closeGlobalSearch, closeNewChat, globalUiStore } from '../stores/globalUiStore';
import GlobalSearchDialog from './GlobalSearchDialog.vue';

const globalSearchOpen = useSelector(globalUiStore, (s) => s.globalSearchOpen);
const newChatOpen = useSelector(globalUiStore, (s) => s.newChatOpen);
</script>

<template>
  <ConfirmDialogHost />
  <GlobalSearchDialog v-if="globalSearchOpen" @close="closeGlobalSearch" />
  <NewChatDialog v-if="newChatOpen" @close="closeNewChat" />
</template>
