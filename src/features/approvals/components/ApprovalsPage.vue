<script setup lang="ts">
import { CheckSquare, Clock, FileCheck, FilePlus } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const stats = computed(() => [
  { label: t('approvals.pending'), count: 0, icon: Clock, color: 'text-warning' },
  { label: t('approvals.approved'), count: 0, icon: FileCheck, color: 'text-success' },
  { label: t('approvals.initiated'), count: 0, icon: FilePlus, color: 'text-primary' },
])
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
      <div class="flex items-center gap-2">
        <CheckSquare :size="20" class="text-primary" />
        <h1 class="text-base font-semibold">
          {{ t('approvals.title') }}
        </h1>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-[600px] mx-auto">
        <!-- Stats cards -->
        <div class="grid grid-cols-3 gap-3 mb-8">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="flex flex-col items-center gap-2 p-4 rounded-xl bg-accent/30 border border-border/40"
          >
            <component :is="stat.icon" :size="20" :class="stat.color" />
            <span class="text-xl font-semibold">{{ stat.count }}</span>
            <span class="text-xs text-muted-foreground/60">{{ stat.label }}</span>
          </div>
        </div>

        <!-- Empty state -->
        <div class="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
          <div class="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4">
            <CheckSquare :size="28" class="opacity-40" />
          </div>
          <span class="text-sm font-medium mb-1">{{ t('approvals.no_items') }}</span>
          <span class="text-xs text-muted-foreground/30">{{ t('approvals.coming_soon') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
