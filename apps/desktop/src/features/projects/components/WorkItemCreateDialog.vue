<script setup lang="ts">
import type { Priority, WorkItemType } from '../types'
import { Button } from '@muon/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@muon/ui/dialog'
import { Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@muon/ui/select'
import { Textarea } from '@muon/ui/textarea'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkItemStore } from '../composables/useWorkItemStore'
import { PRIORITIES, WORK_ITEM_TYPES } from '../types'
import WorkItemAssigneePicker from './WorkItemAssigneePicker.vue'

const props = defineProps<{
  open: boolean
  projectId: string
  defaultStatus: string
  initialTitle?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': []
}>()

const { t } = useI18n()
const store = useWorkItemStore()

const title = ref(props.initialTitle ?? '')
const description = ref('')
const assignee = ref<string | undefined>(undefined)
const priority = ref<Priority>('none')
const workItemType = ref<WorkItemType>('task')
const dueDate = ref('')
const creating = ref(false)

const canSubmit = computed(() => title.value.trim().length > 0 && !creating.value)
const priorityOptions = PRIORITIES
const typeOptions = WORK_ITEM_TYPES

function isPriority(value: string | number): value is Priority {
  return typeof value === 'string' && priorityOptions.includes(value as Priority)
}

function isWorkItemType(value: string | number): value is WorkItemType {
  return typeof value === 'string' && typeOptions.includes(value as WorkItemType)
}

function updatePriority(value: string | number) {
  if (isPriority(value))
    priority.value = value
}

function updateType(value: string | number) {
  if (isWorkItemType(value))
    workItemType.value = value
}

function selectedDueDateTimestamp(): number | undefined {
  return dueDate.value ? new Date(dueDate.value).getTime() : undefined
}

async function submit() {
  if (!canSubmit.value)
    return
  creating.value = true
  try {
    await store.createItem(props.projectId, {
      title: title.value.trim(),
      description: description.value.trim(),
      assignee: assignee.value,
      priority: priority.value,
      type: workItemType.value,
      dueDate: selectedDueDateTimestamp(),
      status: props.defaultStatus,
    })
    emit('created')
    emit('update:open', false)
    title.value = ''
    description.value = ''
    assignee.value = undefined
    priority.value = 'none'
    workItemType.value = 'task'
    dueDate.value = ''
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('projects.create_task') }}</DialogTitle>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid gap-2">
          <Label for="task-title">{{ t('projects.task_title') }}</Label>
          <Input
            id="task-title"
            v-model="title"
            data-testid="project-task-title-input"
            :placeholder="t('projects.task_title_placeholder')"
            @keyup.enter="submit()"
          />
        </div>
        <div class="grid gap-2">
          <Label for="task-desc">{{ t('projects.project_description') }}</Label>
          <Textarea
            id="task-desc"
            v-model="description"
            data-testid="project-task-description-input"
            :rows="3"
          />
        </div>
        <div class="grid gap-2">
          <Label>{{ t('projects.assignee') }}</Label>
          <WorkItemAssigneePicker
            v-model="assignee"
            data-testid="project-task-assignee-picker"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label>{{ t('projects.type') }}</Label>
            <Select
              data-testid="project-task-type-select"
              :model-value="workItemType"
              @update:model-value="updateType"
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="tp in typeOptions" :key="tp" :value="tp">
                  {{ t(`projects.type_${tp}`) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>{{ t('projects.priority') }}</Label>
            <Select
              data-testid="project-task-priority-select"
              :model-value="priority"
              @update:model-value="updatePriority"
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in priorityOptions" :key="p" :value="p">
                  {{ t(`projects.priority_${p}`) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div class="grid gap-2">
          <Label for="task-due-date">{{ t('projects.due_date') }}</Label>
          <Input
            id="task-due-date"
            v-model="dueDate"
            data-testid="project-task-due-date-input"
            type="date"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          {{ t('common.cancel') }}
        </Button>
        <Button :disabled="!canSubmit" :loading="creating" @click="submit()">
          {{ t('common.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
