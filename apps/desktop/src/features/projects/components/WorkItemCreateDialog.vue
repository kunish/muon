<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@muon/ui/dialog';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@muon/ui/select';
import { Textarea } from '@muon/ui/textarea';
import { useForm } from '@tanstack/vue-form';
import { z } from 'zod';
import { createItem } from '../composables/useWorkItemStore';
import { PRIORITIES, WORK_ITEM_TYPES } from '../types';
import WorkItemAssigneePicker from './WorkItemAssigneePicker.vue';

const props = defineProps<{
  open: boolean;
  projectId: string;
  defaultStatus: string;
  initialTitle?: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  created: [];
}>();

const { t } = useI18n();

const priorityOptions = PRIORITIES;
const typeOptions = WORK_ITEM_TYPES;

const workItemFormSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string(),
  assignee: z.string(),
  priority: z.enum(PRIORITIES),
  type: z.enum(WORK_ITEM_TYPES),
  dueDate: z.string(),
});

const form = useForm({
  defaultValues: {
    title: props.initialTitle ?? '',
    description: '',
    assignee: '',
    priority: 'none' as (typeof PRIORITIES)[number],
    type: 'task' as (typeof WORK_ITEM_TYPES)[number],
    dueDate: '',
  },
  validators: { onMount: workItemFormSchema, onChange: workItemFormSchema },
  onSubmit: async ({ value }) => {
    await createItem(props.projectId, {
      title: value.title.trim(),
      description: value.description.trim(),
      assignee: value.assignee || undefined,
      priority: value.priority,
      type: value.type,
      dueDate: value.dueDate ? new Date(value.dueDate).getTime() : undefined,
      status: props.defaultStatus,
    });
    emit('created');
    emit('update:open', false);
    form.reset();
  },
});
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
          <form.Field v-slot="{ field }" name="title">
            <Input
              id="task-title"
              data-testid="project-task-title-input"
              :model-value="field.state.value"
              :placeholder="t('projects.task_title_placeholder')"
              @update:model-value="(value) => field.handleChange(String(value))"
              @blur="field.handleBlur"
              @keyup.enter="form.handleSubmit"
            />
          </form.Field>
        </div>
        <div class="grid gap-2">
          <Label for="task-desc">{{ t('projects.project_description') }}</Label>
          <form.Field v-slot="{ field }" name="description">
            <Textarea
              id="task-desc"
              data-testid="project-task-description-input"
              :model-value="field.state.value"
              :rows="3"
              @update:model-value="field.handleChange"
            />
          </form.Field>
        </div>
        <div class="grid gap-2">
          <Label>{{ t('projects.assignee') }}</Label>
          <form.Field v-slot="{ field }" name="assignee">
            <WorkItemAssigneePicker
              data-testid="project-task-assignee-picker"
              :model-value="field.state.value"
              @update:model-value="(value) => field.handleChange(value ?? '')"
            />
          </form.Field>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label>{{ t('projects.type') }}</Label>
            <form.Field v-slot="{ field }" name="type">
              <Select
                data-testid="project-task-type-select"
                :model-value="field.state.value"
                @update:model-value="(value) => field.handleChange(value as (typeof WORK_ITEM_TYPES)[number])"
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
            </form.Field>
          </div>
          <div class="grid gap-2">
            <Label>{{ t('projects.priority') }}</Label>
            <form.Field v-slot="{ field }" name="priority">
              <Select
                data-testid="project-task-priority-select"
                :model-value="field.state.value"
                @update:model-value="(value) => field.handleChange(value as (typeof PRIORITIES)[number])"
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
            </form.Field>
          </div>
        </div>
        <div class="grid gap-2">
          <Label for="task-due-date">{{ t('projects.due_date') }}</Label>
          <form.Field v-slot="{ field }" name="dueDate">
            <Input
              id="task-due-date"
              data-testid="project-task-due-date-input"
              type="date"
              :model-value="field.state.value"
              @update:model-value="(value) => field.handleChange(String(value))"
            />
          </form.Field>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" @click="emit('update:open', false)">
          {{ t('common.cancel') }}
        </Button>
        <form.Subscribe v-slot="{ canSubmit, isSubmitting }">
          <Button type="button" :disabled="!canSubmit" :loading="isSubmitting" @click="form.handleSubmit">
            {{ t('common.confirm') }}
          </Button>
        </form.Subscribe>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
