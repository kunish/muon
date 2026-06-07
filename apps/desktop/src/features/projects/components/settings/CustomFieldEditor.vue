<script setup lang="ts">
import type { CustomField } from '../../types';
import { Button } from '@muon/ui/button';
import { Input } from '@muon/ui/input';
import { Plus, Trash2 } from 'lucide-vue-next';
import { projectRepo } from '../../db/projectDb';

const props = defineProps<{ projectId: string }>();

const { t } = useI18n();
const fields = ref<CustomField[]>([]);

onMounted(async () => {
  fields.value = await projectRepo.listCustomFields(props.projectId);
});

async function addField() {
  const field: CustomField = {
    id: crypto.randomUUID(),
    projectId: props.projectId,
    name: '',
    type: 'text',
    options: [],
    required: false,
    order: fields.value.length,
  };
  await projectRepo.saveCustomField(field);
  fields.value.push(field);
}

async function removeField(id: string) {
  await projectRepo.deleteCustomField(id);
  fields.value = fields.value.filter((f) => f.id !== id);
}

async function saveField(field: CustomField) {
  await projectRepo.saveCustomField(field);
}

function fieldTypeLabel(type: CustomField['type']): string {
  return t(`projects.field_type_${type}`);
}

function supportsOptions(field: CustomField): boolean {
  return field.type === 'select' || field.type === 'multiSelect';
}

function updateFieldType(field: CustomField, value: string) {
  field.type = value as CustomField['type'];
  if (!supportsOptions(field)) field.options = [];
  void saveField(field);
}

function updateFieldOptions(field: CustomField, value: string | number) {
  field.options = String(value)
    .split(',')
    .map((option) => option.trim())
    .filter(Boolean);
  void saveField(field);
}

function fieldOptionsDraft(field: CustomField): string {
  return field.options.join(', ');
}

function updateRequired(field: CustomField, event: Event) {
  field.required = (event.target as HTMLInputElement).checked;
  void saveField(field);
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
      {{ t('projects.no_custom_fields') }}
    </div>

    <div v-else class="space-y-3">
      <div v-for="field in fields" :key="field.id" class="grid gap-2 rounded-lg border border-border p-3">
        <Input
          v-model="field.name"
          data-testid="project-custom-field-name"
          :placeholder="t('projects.field_name')"
          @blur="saveField(field)"
        />
        <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <select
            :value="field.type"
            data-testid="project-custom-field-type"
            class="rounded border bg-background px-2 py-1.5 text-sm"
            @change="updateFieldType(field, ($event.target as HTMLSelectElement).value)"
          >
            <option value="text">
              {{ fieldTypeLabel('text') }}
            </option>
            <option value="number">
              {{ fieldTypeLabel('number') }}
            </option>
            <option value="select">
              {{ fieldTypeLabel('select') }}
            </option>
            <option value="multiSelect">
              {{ fieldTypeLabel('multiSelect') }}
            </option>
            <option value="date">
              {{ fieldTypeLabel('date') }}
            </option>
            <option value="user">
              {{ fieldTypeLabel('user') }}
            </option>
            <option value="url">
              {{ fieldTypeLabel('url') }}
            </option>
          </select>
          <label class="flex items-center gap-1 text-sm">
            <input type="checkbox" :checked="field.required" @change="updateRequired(field, $event)" />
            {{ t('projects.field_required') }}
          </label>
          <Button variant="ghost" size="icon" @click="removeField(field.id)">
            <Trash2 class="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <Input
          v-if="supportsOptions(field)"
          :model-value="fieldOptionsDraft(field)"
          data-testid="project-custom-field-options"
          :placeholder="t('projects.field_options_placeholder')"
          @update:model-value="updateFieldOptions(field, $event)"
        />
      </div>
    </div>
  </div>
</template>
