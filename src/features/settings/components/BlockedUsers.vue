<script setup lang="ts">
import { getBlockedUsers, unblockUser } from '@matrix/index'
import { UserX } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const blockedUsers = ref<string[]>(getBlockedUsers())
const unblocking = ref<string | null>(null)

function refreshList() {
  blockedUsers.value = getBlockedUsers()
}

async function handleUnblock(userId: string) {
  unblocking.value = userId
  try {
    await unblockUser(userId)
    refreshList()
  }
  finally {
    unblocking.value = null
  }
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="blockedUsers.length === 0" class="flex items-center gap-2 text-sm text-muted-foreground/60 py-2">
      <UserX :size="14" class="opacity-50" />
      <span>{{ t('settings.no_blocked_users') }}</span>
    </div>

    <div
      v-for="userId in blockedUsers"
      :key="userId"
      class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
    >
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-7 h-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-xs font-medium shrink-0">
          {{ userId.slice(1, 2).toUpperCase() }}
        </div>
        <span class="text-sm truncate font-mono">{{ userId }}</span>
      </div>
      <button
        class="shrink-0 px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        :disabled="unblocking === userId"
        @click="handleUnblock(userId)"
      >
        {{ t('settings.unblock') }}
      </button>
    </div>
  </div>
</template>
