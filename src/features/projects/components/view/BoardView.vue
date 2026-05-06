<script setup lang="ts">
import type { Workflow, WorkflowStatus } from '../../types'
import { Button } from '@muon/ui/button'
import { Plus } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkflow } from '../../composables/useWorkflow'
import { useWorkItemStore } from '../../composables/useWorkItemStore'
import WorkItemCard from '../WorkItemCard.vue'
import WorkItemCreateDialog from '../WorkItemCreateDialog.vue'
import WorkItemDetail from '../WorkItemDetail.vue'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const itemStore = useWorkItemStore()
const { loadWorkflow, canTransition } = useWorkflow(() => props.projectId)

const statuses = ref<WorkflowStatus[]>([])
const workflow = ref<Workflow | null>(null)
const showCreateDialog = ref(false)
const selectedItemId = ref<string | null>(null)
const createDefaultStatus = ref('')

onMounted(async () => {
  const wf = await loadWorkflow()
  workflow.value = wf
  statuses.value = wf.statuses
})

function itemsForStatus(statusKey: string) {
  return itemStore.currentItems.filter(i => i.status === statusKey)
}

function openCreate(statusKey: string) {
  createDefaultStatus.value = statusKey
  showCreateDialog.value = true
}

function onDragStart(event: DragEvent, itemId: string) {
  if (!event.dataTransfer)
    return
  event.dataTransfer.setData('text/plain', itemId)
  event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (!event.dataTransfer)
    return
  event.dataTransfer.dropEffect = 'move'
}

async function onDrop(event: DragEvent, targetStatus: string) {
  event.preventDefault()
  const itemId = event.dataTransfer?.getData('text/plain')
  if (!itemId)
    return
  const item = itemStore.currentItems.find(current => current.id === itemId)
  if (!item)
    return
  if (item.status !== targetStatus && workflow.value && !canTransition(workflow.value, item.status, targetStatus))
    return
  const items = itemsForStatus(targetStatus)
  const newOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 0
  await itemStore.reorderItem(itemId, props.projectId, newOrder, targetStatus)
}
</script>

<template>
  <div class="relative h-full min-h-0 min-w-0">
    <div class="flex h-full min-h-0 w-full min-w-0 gap-3 overflow-x-auto p-4">
      <div
        v-for="status in statuses"
        :key="status.key"
        :data-testid="`project-board-column-${status.key}`"
        class="flex h-full min-w-[18rem] flex-1 basis-72 flex-col rounded-lg bg-muted/50"
        @dragover="onDragOver"
        @drop="onDrop($event, status.key)"
      >
        <div class="flex shrink-0 items-center justify-between px-3 py-2.5">
          <div class="flex min-w-0 items-center gap-2">
            <div
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: status.color }"
            />
            <span class="truncate text-sm font-medium">{{ status.name }}</span>
            <span class="shrink-0 text-xs text-muted-foreground">{{ itemsForStatus(status.key).length }}</span>
          </div>
          <Button variant="ghost" size="icon" class="h-6 w-6 shrink-0" @click="openCreate(status.key)">
            <Plus class="h-3.5 w-3.5" />
          </Button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          <WorkItemCard
            v-for="item in itemsForStatus(status.key)"
            :key="item.id"
            :item="item"
            :status-category="status.category"
            draggable="true"
            @dragstart="onDragStart($event, item.id)"
            @click="selectedItemId = item.id"
          />
          <p
            v-if="itemsForStatus(status.key).length === 0"
            class="py-6 text-center text-xs text-muted-foreground"
          >
            {{ t('projects.no_tasks') }}
          </p>
        </div>
      </div>
    </div>

    <WorkItemCreateDialog
      v-model:open="showCreateDialog"
      :project-id="props.projectId"
      :default-status="createDefaultStatus"
    />
    <WorkItemDetail
      v-if="selectedItemId"
      :item-id="selectedItemId"
      @close="selectedItemId = null"
    />
  </div>
</template>
