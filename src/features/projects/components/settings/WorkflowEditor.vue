<script setup lang="ts">
import type { Workflow } from '../../types'
import { Button } from '@muon/ui/button'
import { Input } from '@muon/ui/input'
import { Plus, Trash2 } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkflow } from '../../composables/useWorkflow'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const { loadWorkflow, saveWorkflow } = useWorkflow(() => props.projectId)
const workflow = ref<Workflow | null>(null)
const saving = ref(false)

onMounted(async () => {
  workflow.value = await loadWorkflow()
})

function addStatus() {
  if (!workflow.value)
    return
  workflow.value.statuses.push({
    key: `status_${workflow.value.statuses.length + 1}`,
    name: 'New Status',
    color: '#e5e7eb',
    category: 'todo',
  })
}

function removeStatus(index: number) {
  if (!workflow.value)
    return
  workflow.value.statuses.splice(index, 1)
}

function addTransition() {
  if (!workflow.value || workflow.value.statuses.length < 2)
    return
  workflow.value.transitions.push({
    from: workflow.value.statuses[0].key,
    to: workflow.value.statuses[1].key,
    name: '',
  })
}

function removeTransition(index: number) {
  if (!workflow.value)
    return
  workflow.value.transitions.splice(index, 1)
}

async function handleSave() {
  if (!workflow.value)
    return
  saving.value = true
  try {
    await saveWorkflow(workflow.value)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="workflow" class="space-y-6 p-6">
    <div>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-medium">
          {{ t('projects.status') }}
        </h3>
        <Button size="sm" variant="outline" @click="addStatus()">
          <Plus class="mr-1 h-3.5 w-3.5" /> {{ t('projects.add_status') }}
        </Button>
      </div>
      <div class="space-y-2">
        <div v-for="(status, i) in workflow.statuses" :key="i" class="flex items-center gap-2">
          <Input v-model="status.key" class="w-32" placeholder="Key" />
          <Input v-model="status.name" class="w-40" placeholder="Name" />
          <Input v-model="status.color" type="color" class="w-12 p-1" />
          <Button variant="ghost" size="icon" @click="removeStatus(i)">
            <Trash2 class="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>

    <div>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-medium">
          {{ t('projects.workflow') }}
        </h3>
        <Button
          size="sm" variant="outline"
          :disabled="workflow.statuses.length < 2"
          @click="addTransition()"
        >
          <Plus class="mr-1 h-3.5 w-3.5" /> {{ t('projects.add_transition') }}
        </Button>
      </div>
      <div class="space-y-2">
        <div v-for="(tr, i) in workflow.transitions" :key="i" class="flex items-center gap-2">
          <select v-model="tr.from" class="rounded border bg-background px-2 py-1.5 text-sm">
            <option v-for="s in workflow.statuses" :key="s.key" :value="s.key">
              {{ s.name }}
            </option>
          </select>
          <span class="text-muted-foreground">→</span>
          <select v-model="tr.to" class="rounded border bg-background px-2 py-1.5 text-sm">
            <option v-for="s in workflow.statuses" :key="s.key" :value="s.key">
              {{ s.name }}
            </option>
          </select>
          <Input v-model="tr.name" class="w-32" :placeholder="t('projects.transition_name')" />
          <Button variant="ghost" size="icon" @click="removeTransition(i)">
            <Trash2 class="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>

    <Button :loading="saving" @click="handleSave()">
      {{ t('common.save') }}
    </Button>
  </div>
</template>
