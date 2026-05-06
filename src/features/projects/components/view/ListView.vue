<script setup lang="ts">
import type { Priority } from '../../types'
import { Button } from '@muon/ui/button'
import { ArrowDown, ArrowUp, Plus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkItemStore } from '../../composables/useWorkItemStore'
import WorkItemCreateDialog from '../WorkItemCreateDialog.vue'

defineProps<{ projectId: string }>()

const { t } = useI18n()
const store = useWorkItemStore()

const sortBy = ref<'priority' | 'dueDate' | 'createdAt' | 'title'>('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')
const showCreateDialog = ref(false)

const priorityOrder: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
}

const sortedItems = computed(() => {
  const items = [...store.currentItems]
  items.sort((a, b) => {
    let cmp = 0
    if (sortBy.value === 'priority') {
      cmp = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
    }
    else if (sortBy.value === 'dueDate') {
      cmp = (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity)
    }
    else if (sortBy.value === 'title') {
      cmp = a.title.localeCompare(b.title)
    }
    else {
      cmp = a.createdAt - b.createdAt
    }
    return sortDir.value === 'desc' ? -cmp : cmp
  })
  return items
})

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortBy.value = field
    sortDir.value = 'asc'
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center border-b px-4 py-2">
      <Button size="sm" @click="showCreateDialog = true">
        <Plus class="mr-1 h-3.5 w-3.5" />
        {{ t('projects.create_task') }}
      </Button>
    </div>

    <div class="flex-1 overflow-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b text-left text-xs text-muted-foreground">
            <th class="cursor-pointer px-4 py-2 font-medium" @click="toggleSort('title')">
              {{ t('projects.task_title') }}
              <ArrowUp v-if="sortBy === 'title' && sortDir === 'asc'" class="inline h-3 w-3" />
              <ArrowDown v-else-if="sortBy === 'title'" class="inline h-3 w-3" />
            </th>
            <th class="px-4 py-2 font-medium">
              {{ t('projects.assignee') }}
            </th>
            <th class="cursor-pointer px-4 py-2 font-medium" @click="toggleSort('dueDate')">
              {{ t('projects.due_date') }}
            </th>
            <th class="px-4 py-2 font-medium">
              {{ t('projects.status') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sortedItems" :key="item.id" class="border-b text-sm hover:bg-muted/50">
            <td class="px-4 py-2.5">
              <span class="font-medium">{{ item.title }}</span>
            </td>
            <td class="px-4 py-2.5 text-muted-foreground">
              {{ item.assignee ? item.assignee.split(':')[0] : '-' }}
            </td>
            <td class="px-4 py-2.5 text-muted-foreground">
              {{ item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-' }}
            </td>
            <td class="px-4 py-2.5">
              <span class="rounded bg-muted px-2 py-0.5 text-xs">{{ item.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="sortedItems.length === 0" class="py-12 text-center text-muted-foreground">
        {{ t('projects.no_tasks') }}
      </p>
    </div>

    <WorkItemCreateDialog
      v-model:open="showCreateDialog"
      :project-id="$props.projectId"
      default-status="todo"
    />
  </div>
</template>
