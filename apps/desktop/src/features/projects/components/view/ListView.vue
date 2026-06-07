<script setup lang="ts">
import type { SortingState } from '@tanstack/vue-table';
import type { Priority, WorkItem } from '../../types';
import { Button } from '@muon/ui/button';
import { useSelector } from '@tanstack/vue-store';
import { createColumnHelper, getCoreRowModel, getSortedRowModel, useVueTable } from '@tanstack/vue-table';
import { ArrowDown, ArrowUp, Plus } from 'lucide-vue-next';
import { useWorkflow } from '../../composables/useWorkflow';
import { selectCurrentItems, workItemStore } from '../../composables/useWorkItemStore';
import WorkItemCreateDialog from '../WorkItemCreateDialog.vue';
import WorkItemDetail from '../WorkItemDetail.vue';

const props = defineProps<{ projectId: string }>();

const { t } = useI18n();
const currentItems = useSelector(workItemStore, selectCurrentItems);
const { loadWorkflow } = useWorkflow(() => props.projectId);

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

const columnHelper = createColumnHelper<WorkItem>();
const columns = [
  // Hidden default-sort key (not rendered); preserves the old "newest first" default.
  columnHelper.accessor('createdAt', { id: 'createdAt' }),
  columnHelper.accessor('title', {
    id: 'title',
    sortingFn: (a, b) => a.original.title.localeCompare(b.original.title),
  }),
  columnHelper.accessor('priority', {
    id: 'priority',
    sortingFn: (a, b) => (priorityOrder[a.original.priority] ?? 4) - (priorityOrder[b.original.priority] ?? 4),
  }),
  columnHelper.accessor((row) => row.dueDate ?? Number.POSITIVE_INFINITY, { id: 'dueDate', sortingFn: 'basic' }),
];

const sorting = ref<SortingState>([{ id: 'createdAt', desc: true }]);

const table = useVueTable({
  get data() {
    return currentItems.value;
  },
  columns,
  state: {
    get sorting() {
      return sorting.value;
    },
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater;
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  enableSortingRemoval: false,
  sortDescFirst: false,
});

const rows = computed(() => table.getRowModel().rows);

function sortDirection(columnId: string): false | 'asc' | 'desc' {
  return table.getColumn(columnId)?.getIsSorted() ?? false;
}

function toggleSort(columnId: string) {
  table.getColumn(columnId)?.toggleSorting();
}

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
              <ArrowUp v-if="sortDirection('title') === 'asc'" class="inline h-3 w-3" />
              <ArrowDown v-else-if="sortDirection('title') === 'desc'" class="inline h-3 w-3" />
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
              <ArrowUp v-if="sortDirection('priority') === 'asc'" class="inline h-3 w-3" />
              <ArrowDown v-else-if="sortDirection('priority') === 'desc'" class="inline h-3 w-3" />
            </th>
            <th class="cursor-pointer px-4 py-2 font-medium" @click="toggleSort('dueDate')">
              {{ t('projects.due_date') }}
              <ArrowUp v-if="sortDirection('dueDate') === 'asc'" class="inline h-3 w-3" />
              <ArrowDown v-else-if="sortDirection('dueDate') === 'desc'" class="inline h-3 w-3" />
            </th>
            <th class="px-4 py-2 font-medium">
              {{ t('projects.status') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.original.id"
            :data-testid="`project-list-row-${row.original.id}`"
            class="cursor-pointer border-b text-sm hover:bg-muted/50"
            @click="selectedItemId = row.original.id"
          >
            <td class="max-w-0 px-4 py-2.5">
              <span class="block truncate font-medium">{{ row.original.title }}</span>
            </td>
            <td class="px-4 py-2.5 text-muted-foreground">
              {{ row.original.assignee ? row.original.assignee.split(':')[0] : '-' }}
            </td>
            <td class="px-4 py-2.5 text-muted-foreground">
              {{ t(`projects.priority_${row.original.priority}`) }}
            </td>
            <td class="px-4 py-2.5 text-muted-foreground">
              {{ row.original.dueDate ? new Date(row.original.dueDate).toLocaleDateString() : '-' }}
            </td>
            <td class="px-4 py-2.5">
              <span class="rounded bg-muted px-2 py-0.5 text-xs">{{ statusLabel(row.original.status) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="rows.length === 0" class="py-12 text-center text-muted-foreground">
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
