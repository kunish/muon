<script setup lang="ts">
import type { Priority } from '../../types';
import { Button } from '@muon/ui/button';
import { ArrowDown, ArrowUp, Plus } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflow } from '../../composables/useWorkflow';
import { useWorkItemStore } from '../../composables/useWorkItemStore';
import WorkItemCreateDialog from '../WorkItemCreateDialog.vue';
import WorkItemDetail from '../WorkItemDetail.vue';

const props = defineProps<{ projectId: string }>();

const { t } = useI18n();
const store = useWorkItemStore();
const { loadWorkflow } = useWorkflow(() => props.projectId);

const sortBy = ref<'priority' | 'dueDate' | 'createdAt' | 'title'>('createdAt');
const sortDir = ref<'asc' | 'desc'>('desc');
const showCreateDialog = ref(false);
const selectedItemId = ref<string | null>(null);
const statuses = ref<Array<{ key: string; name: string }>>([]);

const priorityOrder: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

const sortedItems = computed(() => {
  const items = [...store.currentItems];
  items.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === 'priority') {
      cmp = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    } else if (sortBy.value === 'dueDate') {
      cmp = (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity);
    } else if (sortBy.value === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else {
      cmp = a.createdAt - b.createdAt;
    }
    return sortDir.value === 'desc' ? -cmp : cmp;
  });
  return items;
});

const statusByKey = computed(() => new Map(statuses.value.map((status) => [status.key, status])));
const defaultCreateStatus = computed(() => statuses.value[0]?.key ?? 'todo');

watch(
  () => props.projectId,
  async () => {
    const workflow = await loadWorkflow();
    statuses.value = workflow.statuses.map((status) => ({
      key: status.key,
      name: status.name,
    }));
  },
  { immediate: true },
);

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = field;
    sortDir.value = 'asc';
  }
}

function statusLabel(statusKey: string): string {
  return statusByKey.value.get(statusKey)?.name || statusKey;
}
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col">
    <div class="flex shrink-0 items-center border-b px-4 py-2">
      <Button size="sm" data-testid="project-list-create-task" @click="showCreateDialog = true">
        <Plus class="mr-1 h-3.5 w-3.5" />
        {{ t('projects.create_task') }}
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <table class="min-w-[840px] w-full">
        <thead class="sticky top-0 z-10 bg-background">
          <tr class="border-b text-left text-xs text-muted-foreground">
            <th class="cursor-pointer px-4 py-2 font-medium" @click="toggleSort('title')">
              {{ t('projects.task_title') }}
              <ArrowUp v-if="sortBy === 'title' && sortDir === 'asc'" class="inline h-3 w-3" />
              <ArrowDown v-else-if="sortBy === 'title'" class="inline h-3 w-3" />
            </th>
            <th class="px-4 py-2 font-medium">
              {{ t('projects.assignee') }}
            </th>
            <th
              class="cursor-pointer px-4 py-2 font-medium"
              data-testid="project-list-sort-priority"
              @click="toggleSort('priority')"
            >
              {{ t('projects.priority') }}
              <ArrowUp v-if="sortBy === 'priority' && sortDir === 'asc'" class="inline h-3 w-3" />
              <ArrowDown v-else-if="sortBy === 'priority'" class="inline h-3 w-3" />
            </th>
            <th class="cursor-pointer px-4 py-2 font-medium" @click="toggleSort('dueDate')">
              {{ t('projects.due_date') }}
              <ArrowUp v-if="sortBy === 'dueDate' && sortDir === 'asc'" class="inline h-3 w-3" />
              <ArrowDown v-else-if="sortBy === 'dueDate'" class="inline h-3 w-3" />
            </th>
            <th class="px-4 py-2 font-medium">
              {{ t('projects.status') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in sortedItems"
            :key="item.id"
            :data-testid="`project-list-row-${item.id}`"
            class="cursor-pointer border-b text-sm hover:bg-muted/50"
            @click="selectedItemId = item.id"
          >
            <td class="max-w-0 px-4 py-2.5">
              <span class="block truncate font-medium">{{ item.title }}</span>
            </td>
            <td class="px-4 py-2.5 text-muted-foreground">
              {{ item.assignee ? item.assignee.split(':')[0] : '-' }}
            </td>
            <td class="px-4 py-2.5 text-muted-foreground">
              {{ t(`projects.priority_${item.priority}`) }}
            </td>
            <td class="px-4 py-2.5 text-muted-foreground">
              {{ item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-' }}
            </td>
            <td class="px-4 py-2.5">
              <span class="rounded bg-muted px-2 py-0.5 text-xs">{{ statusLabel(item.status) }}</span>
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
      :project-id="props.projectId"
      :default-status="defaultCreateStatus"
    />
    <WorkItemDetail v-if="selectedItemId" :item-id="selectedItemId" @close="selectedItemId = null" />
  </div>
</template>
