<script setup lang="ts">
import type { Priority, WorkItemType } from '../types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2, X } from 'lucide-vue-next'
import { Button } from '@muon/ui/button'
import { Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@muon/ui/select'
import { Textarea } from '@muon/ui/textarea'
import { useWorkItemStore } from '../composables/useWorkItemStore'
import { useWorkflow } from '../composables/useWorkflow'

const props = defineProps<{ itemId: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const store = useWorkItemStore()
const item = computed(() => store.currentItems.find(i => i.id === props.itemId))

const { loadWorkflow, getAvailableTransitions, changeStatus } = useWorkflow(
  () => item.value?.projectId ?? '',
)

const availableTransitions = ref<string[]>([])
const editing = ref(false)
const editTitle = ref('')
const editDescription = ref('')

watch(() => props.itemId, async () => {
  if (!item.value) return
  const wf = await loadWorkflow()
  availableTransitions.value = getAvailableTransitions(wf, item.value.status)
  editTitle.value = item.value.title
  editDescription.value = item.value.description
}, { immediate: true })

async function handleSave() {
  if (!item.value) return
  await store.updateItem(item.value.id, {
    title: editTitle.value,
    description: editDescription.value,
  })
  editing.value = false
}

async function handleTransition(toStatus: string) {
  await changeStatus(props.itemId, toStatus)
}

async function handleDelete() {
  if (!item.value) return
  await store.deleteItem(item.value.id, item.value.projectId)
  emit('close')
}

const priorityOptions: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']
const typeOptions: WorkItemType[] = ['task', 'bug', 'milestone', 'epic']
</script>

<template>
  <div v-if="item" class="fixed inset-y-0 right-0 z-40 w-96 border-l bg-background shadow-xl">
    <div class="flex items-center justify-between border-b px-4 py-3">
      <h2 class="font-semibold">{{ t('projects.task_title') }}</h2>
      <Button variant="ghost" size="icon" @click="emit('close')">
        <X class="h-4 w-4" />
      </Button>
    </div>

    <div class="flex flex-col gap-4 overflow-y-auto p-4">
      <!-- Title & Description -->
      <div v-if="editing" class="grid gap-2">
        <Label>{{ t('projects.task_title') }}</Label>
        <Input v-model="editTitle" />
        <Label>{{ t('projects.project_description') }}</Label>
        <Textarea v-model="editDescription" rows="4" />
        <div class="flex gap-2">
          <Button size="sm" @click="handleSave()">{{ t('common.save') }}</Button>
          <Button size="sm" variant="outline" @click="editing = false">{{ t('common.cancel') }}</Button>
        </div>
      </div>
      <div v-else>
        <h3 class="text-lg font-medium" @dblclick="editing = true">{{ item.title }}</h3>
        <p v-if="item.description" class="mt-2 text-sm text-muted-foreground">{{ item.description }}</p>
        <Button variant="ghost" size="sm" class="mt-1" @click="editing = true">{{ t('common.edit') }}</Button>
      </div>

      <!-- Priority -->
      <div class="grid gap-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('assignee') }}</Label>
        <Select
          :model-value="item.priority"
          @update:model-value="(v: Priority) => store.updateItem(item.id, { priority: v })"
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="p in priorityOptions" :key="p" :value="p">
              {{ t(`projects.priority_${p}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Type -->
      <div class="grid gap-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('projects.type_task') }}</Label>
        <Select
          :model-value="item.type"
          @update:model-value="(v: WorkItemType) => store.updateItem(item.id, { type: v })"
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="tp in typeOptions" :key="tp" :value="tp">
              {{ t(`projects.type_${tp}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Due Date -->
      <div class="grid gap-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('projects.due_date') }}</Label>
        <Input
          type="date"
          :model-value="item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : ''"
          @update:model-value="(v: string) => store.updateItem(item.id, { dueDate: v ? new Date(v).getTime() : undefined })"
        />
      </div>

      <!-- Transitions -->
      <div v-if="availableTransitions.length > 0" class="grid gap-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('projects.status') }}</Label>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="tStatus in availableTransitions"
            :key="tStatus"
            size="sm"
            variant="outline"
            @click="handleTransition(tStatus)"
          >
            {{ tStatus }}
          </Button>
        </div>
      </div>

      <!-- Delete -->
      <Button variant="destructive" size="sm" @click="handleDelete()">
        <Trash2 class="mr-1 h-3.5 w-3.5" />
        {{ t('common.delete') }}
      </Button>
    </div>
  </div>
</template>
