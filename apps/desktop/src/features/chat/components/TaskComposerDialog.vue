<script setup lang="ts">
import type { TaskStatus } from '../types/task';
import { Label } from '@muon/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@muon/ui/select';
import { useForm } from '@tanstack/vue-form';
import { z } from 'zod';
import GroupMemberPicker from '@/features/contacts/components/GroupMemberPicker.vue';

const props = defineProps<{
  open: boolean;
  initialTitle?: string;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { title: string; assignee: string; dueAt: string; status: TaskStatus }];
}>();

const { t } = useI18n();

const taskFormSchema = z.object({
  title: z.string().trim().min(1),
  assigneeIds: z.array(z.string()).min(1),
  dueAt: z.string().min(1),
  status: z.enum(['todo', 'doing', 'done']),
});

const form = useForm({
  defaultValues: {
    title: props.initialTitle?.trim() || '',
    assigneeIds: [] as string[],
    dueAt: '',
    status: 'todo' as TaskStatus,
  },
  validators: { onMount: taskFormSchema, onChange: taskFormSchema },
  onSubmit: ({ value }) => {
    emitTask(value);
  },
});

function emitTask(value: { title: string; assigneeIds: string[]; dueAt: string; status: TaskStatus }) {
  emit('submit', {
    title: value.title.trim(),
    assignee: value.assigneeIds[0] ?? '',
    dueAt: value.dueAt,
    status: value.status,
  });
}

function handleSubmitClick() {
  if (props.submitting || !form.state.canSubmit) return;
  emitTask(form.state.values);
}

function resetForm() {
  form.reset({
    title: props.initialTitle?.trim() || '',
    assigneeIds: [],
    dueAt: '',
    status: 'todo',
  });
}

watch(
  () => props.open,
  (open) => {
    if (open) resetForm();
  },
  { immediate: true },
);

function selectSingleAssignee(ids: string[]) {
  form.setFieldValue('assigneeIds', ids.length > 1 ? [ids[ids.length - 1]!] : ids);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="emit('close')"
    >
      <div
        class="w-[360px] rounded-xl border border-border bg-background p-4 shadow-xl"
        data-testid="task-composer-dialog"
      >
        <h3 class="text-sm font-semibold">
          {{ t('chat.convert_to_task') }}
        </h3>

        <div class="mt-3 space-y-3">
          <Label class="block">
            <span class="mb-1 block text-xs text-muted-foreground">{{ t('chat.task_title') }}</span>
            <form.Field v-slot="{ field }" name="title">
              <input
                :value="field.state.value"
                type="text"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                data-testid="task-title-input"
                @input="(e) => field.handleChange((e.target as HTMLInputElement).value)"
                @blur="field.handleBlur"
              />
            </form.Field>
          </Label>

          <div class="block">
            <span class="mb-1 block text-xs text-muted-foreground">{{ t('chat.task_assignee') }}</span>
            <form.Field v-slot="{ field }" name="assigneeIds">
              <GroupMemberPicker
                :model-value="field.state.value"
                :label="t('chat.task_assignee')"
                @update:model-value="selectSingleAssignee"
              />
            </form.Field>
          </div>

          <Label class="block">
            <span class="mb-1 block text-xs text-muted-foreground">{{ t('chat.task_due_at') }}</span>
            <form.Field v-slot="{ field }" name="dueAt">
              <input
                :value="field.state.value"
                type="datetime-local"
                class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                data-testid="task-due-at-input"
                @input="(e) => field.handleChange((e.target as HTMLInputElement).value)"
              />
            </form.Field>
          </Label>

          <div class="block">
            <span class="mb-1 block text-xs text-muted-foreground">{{ t('chat.task_status') }}</span>
            <form.Field v-slot="{ field }" name="status">
              <Select
                :model-value="field.state.value"
                data-testid="task-status-select"
                @update:model-value="(value) => field.handleChange(value as TaskStatus)"
              >
                <SelectTrigger
                  class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">
                    {{ t('chat.task_status_todo') }}
                  </SelectItem>
                  <SelectItem value="doing">
                    {{ t('chat.task_status_doing') }}
                  </SelectItem>
                  <SelectItem value="done">
                    {{ t('chat.task_status_done') }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </form.Field>
          </div>
        </div>

        <div class="mt-4 flex justify-end gap-2">
          <button
            class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
            data-testid="task-cancel"
            :disabled="submitting"
            @click="emit('close')"
          >
            {{ t('common.cancel') }}
          </button>
          <form.Subscribe v-slot="{ canSubmit }">
            <button
              class="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
              data-testid="task-submit"
              type="button"
              :disabled="!canSubmit || submitting"
              @click="handleSubmitClick"
            >
              {{ t('chat.task_create') }}
            </button>
          </form.Subscribe>
        </div>
      </div>
    </div>
  </Teleport>
</template>
