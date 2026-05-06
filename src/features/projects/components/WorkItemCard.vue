<script setup lang="ts">
import type { WorkItem } from '../types'
import { CalendarDays, User } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  item: WorkItem
  isDragging?: boolean
}>()

const emit = defineEmits<{
  click: [item: WorkItem]
}>()

const { t } = useI18n()

const priorityColor = computed(() => {
  const map: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
    none: 'bg-transparent',
  }
  return map[props.item.priority] ?? map.none
})

const isOverdue = computed(() => {
  if (!props.item.dueDate)
    return false
  return props.item.dueDate < Date.now() && props.item.status !== 'done'
})
</script>

<template>
  <div
    class="cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
    :class="{ 'opacity-50': isDragging }"
    @click="emit('click', item)"
  >
    <div class="mb-2 flex items-start gap-2">
      <div
        v-if="item.priority !== 'none'"
        class="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
        :class="priorityColor"
      />
      <span class="text-sm font-medium leading-snug">{{ item.title }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span class="rounded bg-muted px-1.5 py-0.5">
        {{ t(`projects.type_${item.type}`) }}
      </span>

      <span
        v-if="item.dueDate"
        class="inline-flex items-center gap-1"
        :class="{ 'text-destructive font-medium': isOverdue }"
      >
        <CalendarDays class="h-3 w-3" />
        {{ new Date(item.dueDate).toLocaleDateString() }}
      </span>

      <span v-if="item.assignee" class="inline-flex items-center gap-1">
        <User class="h-3 w-3" />
        {{ item.assignee.split(':')[0] }}
      </span>
    </div>
  </div>
</template>
