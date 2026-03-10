<script setup lang="ts">
import { Clock, FileText, FolderOpen, Plus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Mock data — these names/times are hardcoded demo content
const recentDocs = [
  { name: '项目需求文档', type: 'DOCX', time: '刚刚', color: 'text-primary' },
  { name: '会议纪要 - 周例会', type: 'DOC', time: '2小时前', color: 'text-primary' },
  { name: 'Q4 预算表', type: 'XLSX', time: '昨天', color: 'text-success' },
]
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
      <div class="flex items-center gap-2">
        <FileText :size="20" class="text-primary" />
        <h1 class="text-base font-semibold">
          {{ t('docs.title') }}
        </h1>
      </div>
      <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
        <Plus :size="14" />
        {{ t('docs.new_doc') }}
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-[600px] mx-auto">
        <!-- Quick access -->
        <div class="grid grid-cols-3 gap-3 mb-6">
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl bg-accent/30 border border-border/40 hover:bg-accent/50 transition-colors">
            <FileText :size="20" class="text-primary" />
            <span class="text-xs font-medium">{{ t('docs.new_doc') }}</span>
          </button>
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl bg-accent/30 border border-border/40 hover:bg-accent/50 transition-colors">
            <FolderOpen :size="20" class="text-warning" />
            <span class="text-xs font-medium">{{ t('docs.my_folder') }}</span>
          </button>
          <button class="flex flex-col items-center gap-2 p-4 rounded-xl bg-accent/30 border border-border/40 hover:bg-accent/50 transition-colors">
            <Clock :size="20" class="text-muted-foreground/60" />
            <span class="text-xs font-medium">{{ t('docs.recent') }}</span>
          </button>
        </div>

        <!-- Recent docs -->
        <div class="mb-3">
          <span class="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">{{ t('docs.recent_docs') }}</span>
        </div>
        <div class="space-y-1">
          <div
            v-for="doc in recentDocs"
            :key="doc.name"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer"
          >
            <FileText :size="18" :class="doc.color" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">
                {{ doc.name }}
              </div>
              <div class="text-[11px] text-muted-foreground/50">
                {{ doc.time }}
              </div>
            </div>
            <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-muted-foreground/60">{{ doc.type }}</span>
          </div>
        </div>

        <!-- Feature hint -->
        <div class="mt-8 p-4 rounded-xl border border-dashed border-border/60 text-center">
          <p class="text-xs text-muted-foreground/40">
            {{ t('docs.coming_soon') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
