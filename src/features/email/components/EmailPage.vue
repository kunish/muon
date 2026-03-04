<script setup lang="ts">
import { Inbox, Mail, Send, Star, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const folders = computed(() => [
  { label: t('email.inbox'), icon: Inbox, count: 0, active: true },
  { label: t('email.sent'), icon: Send, count: 0, active: false },
  { label: t('email.starred'), icon: Star, count: 0, active: false },
  { label: t('email.trash'), icon: Trash2, count: 0, active: false },
])
</script>

<template>
  <div class="flex-1 flex h-full bg-background">
    <!-- Email sidebar -->
    <div class="w-[200px] border-r border-border/40 p-3 shrink-0">
      <div class="flex items-center gap-2 px-2 mb-4">
        <Mail :size="18" class="text-primary" />
        <span class="text-sm font-semibold">{{ t('email.title') }}</span>
      </div>

      <button class="w-full flex items-center justify-center gap-1.5 px-3 py-2 mb-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
        {{ t('email.compose') }}
      </button>

      <nav class="space-y-0.5">
        <button
          v-for="folder in folders"
          :key="folder.label"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors"
          :class="folder.active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent/50'"
        >
          <component :is="folder.icon" :size="15" />
          <span class="flex-1 text-left">{{ folder.label }}</span>
          <span v-if="folder.count" class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
            {{ folder.count }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Email content -->
    <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground/50">
      <div class="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4">
        <Inbox :size="28" class="opacity-40" />
      </div>
      <span class="text-sm font-medium mb-1">{{ t('email.empty') }}</span>
      <span class="text-xs text-muted-foreground/30">{{ t('email.coming_soon') }}</span>
    </div>
  </div>
</template>
