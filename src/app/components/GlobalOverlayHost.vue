<script setup lang="ts">
import NewChatDialog from '@/features/chat/components/NewChatDialog.vue'
import ConfirmDialogHost from '@/shared/components/ConfirmDialogHost.vue'
import { useGlobalUiStore } from '../stores/globalUiStore'
import GlobalSearchDialog from './GlobalSearchDialog.vue'

const globalUi = useGlobalUiStore()
</script>

<template>
  <ConfirmDialogHost />
  <GlobalSearchDialog
    v-if="globalUi.globalSearchOpen"
    @close="globalUi.closeGlobalSearch"
  />
  <NewChatDialog
    v-if="globalUi.newChatOpen"
    @close="globalUi.closeNewChat"
  />
</template>
