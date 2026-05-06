<script setup lang="ts">
import { Button } from '@muon/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@muon/ui/dialog'
import { Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
import { Textarea } from '@muon/ui/textarea'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkItemStore } from '../composables/useWorkItemStore'

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
const creating = ref(false)

const canSubmit = computed(() => title.value.trim().length > 0 && !creating.value)

async function submit() {
  if (!canSubmit.value)
    return
  creating.value = true
  try {
    await store.createItem(props.projectId, {
      title: title.value.trim(),
      description: description.value.trim(),
      status: props.defaultStatus,
    })
    emit('created')
    emit('update:open', false)
    title.value = ''
    description.value = ''
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
            :placeholder="t('projects.task_title_placeholder')"
            @keyup.enter="submit()"
          />
        </div>
        <div class="grid gap-2">
          <Label for="task-desc">{{ t('projects.project_description') }}</Label>
          <Textarea id="task-desc" v-model="description" rows="3" />
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
