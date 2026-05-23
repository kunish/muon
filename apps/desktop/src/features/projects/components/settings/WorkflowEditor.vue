<script setup lang="ts">
import type { StatusCategory, Workflow, WorkflowStatus } from '../../types';
import { Button } from '@muon/ui/button';
import { Input } from '@muon/ui/input';
import { Plus, Trash2 } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflow } from '../../composables/useWorkflow';
import { STATUS_CATEGORIES } from '../../types';

const props = defineProps<{ projectId: string }>();

const { t } = useI18n();
const { loadWorkflow, saveWorkflow } = useWorkflow(() => props.projectId);
const workflow = ref<Workflow | null>(null);
const saving = ref(false);
const statusCategories = STATUS_CATEGORIES;

onMounted(async () => {
  workflow.value = await loadWorkflow();
});

function addStatus() {
  if (!workflow.value) return;
  workflow.value.statuses.push({
    key: `status_${workflow.value.statuses.length + 1}`,
    name: t('projects.new_status'),
    color: '#e5e7eb',
    category: 'todo',
  });
}

function removeStatus(index: number) {
  if (!workflow.value) return;
  const status = workflow.value.statuses[index];
  if (!status) return;
  workflow.value.statuses.splice(index, 1);
  workflow.value.transitions = workflow.value.transitions.filter(
    (tr) => tr.from !== status.key && tr.to !== status.key,
  );
}

function addTransition() {
  if (!workflow.value || workflow.value.statuses.length < 2) return;
  workflow.value.transitions.push({
    from: workflow.value.statuses[0].key,
    to: workflow.value.statuses[1].key,
    name: '',
  });
}

function removeTransition(index: number) {
  if (!workflow.value) return;
  workflow.value.transitions.splice(index, 1);
}

function updateStatusKey(status: WorkflowStatus, value: string | number) {
  if (!workflow.value) return;
  const oldKey = status.key;
  const nextKey = String(value).trim();
  if (!nextKey || nextKey === oldKey) return;

  status.key = nextKey;
  for (const transition of workflow.value.transitions) {
    if (transition.from === oldKey) transition.from = nextKey;
    if (transition.to === oldKey) transition.to = nextKey;
  }
}

function updateStatusCategory(status: WorkflowStatus, value: string) {
  if (statusCategories.includes(value as StatusCategory)) status.category = value as StatusCategory;
}

function statusCategoryLabel(category: StatusCategory): string {
  return t(`projects.status_category_${category}`);
}

async function handleSave() {
  if (!workflow.value) return;
  saving.value = true;
  try {
    await saveWorkflow(workflow.value);
  } finally {
    saving.value = false;
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
        <Button size="sm" variant="outline" data-testid="project-workflow-add-status" @click="addStatus()">
          <Plus class="mr-1 h-3.5 w-3.5" /> {{ t('projects.add_status') }}
        </Button>
      </div>
      <div class="space-y-2">
        <div
          v-for="(status, i) in workflow.statuses"
          :key="status.key"
          class="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[8rem_minmax(0,1fr)_9rem_3.5rem_auto]"
        >
          <Input
            :model-value="status.key"
            data-testid="project-workflow-status-key"
            :placeholder="t('projects.status_key')"
            @update:model-value="updateStatusKey(status, $event)"
          />
          <Input
            v-model="status.name"
            data-testid="project-workflow-status-name"
            :placeholder="t('projects.status_name')"
          />
          <select
            :value="status.category"
            data-testid="project-workflow-status-category"
            class="rounded border bg-background px-2 py-1.5 text-sm"
            @change="updateStatusCategory(status, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="category in statusCategories" :key="category" :value="category">
              {{ statusCategoryLabel(category) }}
            </option>
          </select>
          <Input v-model="status.color" type="color" class="p-1" :aria-label="t('projects.status_color')" />
          <Button variant="ghost" size="icon" data-testid="project-workflow-remove-status" @click="removeStatus(i)">
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
          size="sm"
          variant="outline"
          data-testid="project-workflow-add-transition"
          :disabled="workflow.statuses.length < 2"
          @click="addTransition()"
        >
          <Plus class="mr-1 h-3.5 w-3.5" /> {{ t('projects.add_transition') }}
        </Button>
      </div>
      <div class="space-y-2">
        <div
          v-for="(tr, i) in workflow.transitions"
          :key="i"
          class="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(8rem,1fr)_auto]"
        >
          <select
            v-model="tr.from"
            data-testid="project-workflow-transition-from"
            class="rounded border bg-background px-2 py-1.5 text-sm"
          >
            <option v-for="s in workflow.statuses" :key="s.key" :value="s.key">
              {{ s.name }}
            </option>
          </select>
          <span class="text-muted-foreground">→</span>
          <select
            v-model="tr.to"
            data-testid="project-workflow-transition-to"
            class="rounded border bg-background px-2 py-1.5 text-sm"
          >
            <option v-for="s in workflow.statuses" :key="s.key" :value="s.key">
              {{ s.name }}
            </option>
          </select>
          <Input v-model="tr.name" :placeholder="t('projects.transition_name')" />
          <Button
            variant="ghost"
            size="icon"
            data-testid="project-workflow-remove-transition"
            @click="removeTransition(i)"
          >
            <Trash2 class="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>

    <Button :loading="saving" data-testid="project-workflow-save" @click="handleSave()">
      {{ t('common.save') }}
    </Button>
  </div>
</template>
