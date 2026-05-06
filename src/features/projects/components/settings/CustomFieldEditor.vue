<script setup lang="ts">
import type { CustomField } from '../../types'
import { Button } from '@muon/ui/button'
import { Input } from '@muon/ui/input'
import { Plus, Trash2 } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { projectRepo } from '../../db/projectDb'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const fields = ref<CustomField[]>([])

onMounted(async () => {
  fields.value = await projectRepo.listCustomFields(props.projectId)
})

async function addField() {
  const field: CustomField = {
    id: crypto.randomUUID(),
    projectId: props.projectId,
    name: '',
    type: 'text',
    options: [],
    required: false,
    order: fields.value.length,
  }
  await projectRepo.saveCustomField(field)
  fields.value.push(field)
}

async function removeField(id: string) {
  await projectRepo.deleteCustomField(id)
  fields.value = fields.value.filter(f => f.id !== id)
}

async function saveField(field: CustomField) {
  await projectRepo.saveCustomField(field)
}
</script>

<template>
  <div class="space-y-4 p-6">
    <div class="flex items-center justify-between">
      <h3 class="font-medium">
        {{ t('projects.custom_fields') }}
      </h3>
      <Button size="sm" variant="outline" @click="addField()">
        <Plus class="mr-1 h-3.5 w-3.5" /> {{ t('projects.add_field') }}
      </Button>
    </div>

    <div v-if="fields.length === 0" class="py-6 text-center text-sm text-muted-foreground">
      {{ t('projects.no_tasks') }}
    </div>

    <div v-else class="space-y-3">
      <div v-for="field in fields" :key="field.id" class="flex items-center gap-2">
        <Input
          v-model="field.name"
          class="w-44"
          :placeholder="t('projects.field_name')"
          @blur="saveField(field)"
        />
        <select
          v-model="field.type"
          class="rounded border bg-background px-2 py-1.5 text-sm"
          @change="saveField(field)"
        >
          <option value="text">
            Text
          </option>
          <option value="number">
            Number
          </option>
          <option value="select">
            Select
          </option>
          <option value="multiSelect">
            Multi-select
          </option>
          <option value="date">
            Date
          </option>
          <option value="user">
            User
          </option>
          <option value="url">
            URL
          </option>
        </select>
        <label class="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            :checked="field.required"
            @change="field.required = !field.required; saveField(field)"
          >
          {{ t('projects.field_required') }}
        </label>
        <Button variant="ghost" size="icon" @click="removeField(field.id)">
          <Trash2 class="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  </div>
</template>
