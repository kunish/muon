<script setup lang="ts">
import type { TaskStatus } from '../types/task'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  open: boolean
  initialTitle?: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { title: string, assignee: string, dueAt: string, status: TaskStatus }]
}>()

const { t } = useI18n()

const title = ref('')
const assignee = ref('')
const dueAt = ref('')
const status = ref<TaskStatus>('todo')

const canSubmit = computed(() => {
  return !!title.value.trim()
    && !!assignee.value.trim()
    && !!dueAt.value
    && !props.submitting
})

function resetForm() {
  title.value = props.initialTitle?.trim() || ''
  assignee.value = ''
  dueAt.value = ''
  status.value = 'todo'
}

watch(
  () => props.open,
  (open) => {
    if (open)
      resetForm()
  },
)

function onSubmit() {
  if (!canSubmit.value)
    return

  emit('submit', {
    title: title.value.trim(),
    assignee: assignee.value.trim(),
    dueAt: dueAt.value,
    status: status.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="emit('close')">
      <div class="w-[360px] rounded-xl border border-border bg-background p-4 shadow-xl" data-testid="task-composer-dialog">
        <h3 class="text-sm font-semibold">
          {{ t('chat.convert_to_task') }}
        </h3>

        <div class="mt-3 space-y-3">
          <label class="block">
            <span class="mb-1 block text-xs text-muted-foreground">{{ t('chat.task_title') }}</span>
            <input
              v-model="title"
              type="text"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
              data-testid="task-title-input"
            >
          </label>

          <label class="block">
            <span class="mb-1 block text-xs text-muted-foreground">{{ t('chat.task_assignee') }}</span>
            <input
              v-model="assignee"
              type="text"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
              data-testid="task-assignee-input"
            >
          </label>

          <label class="block">
            <span class="mb-1 block text-xs text-muted-foreground">{{ t('chat.task_due_at') }}</span>
            <input
              v-model="dueAt"
              type="datetime-local"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
              data-testid="task-due-at-input"
            >
          </label>

          <label class="block">
            <span class="mb-1 block text-xs text-muted-foreground">{{ t('chat.task_status') }}</span>
            <select
              v-model="status"
              class="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
              data-testid="task-status-select"
            >
              <option value="todo">
                {{ t('chat.task_status_todo') }}
              </option>
              <option value="doing">
                {{ t('chat.task_status_doing') }}
              </option>
              <option value="done">
                {{ t('chat.task_status_done') }}
              </option>
            </select>
          </label>
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
          <button
            class="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            data-testid="task-submit"
            :disabled="!canSubmit"
            @click="onSubmit"
          >
            {{ t('chat.task_create') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
