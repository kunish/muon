<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '../stores/taskStore'
import type { TaskItem } from '../types/task'

const { t } = useI18n()
const taskStore = useTaskStore()

const taskGroups = computed(() => taskStore.tasksByStatus)

const statusMeta: Record<'todo' | 'doing' | 'done', { label: string }> = {
  todo: { label: t('chat.task_status_todo') },
  doing: { label: t('chat.task_status_doing') },
  done: { label: t('chat.task_status_done') },
}

function transitionTask(task: TaskItem, to: 'todo' | 'doing' | 'done') {
  taskStore.transitionStatus(task.id, to)
}
</script>

<template>
  <section class="h-full flex flex-col" data-testid="task-panel">
    <header class="flex items-center justify-between border-b border-border px-4 py-3">
      <h3 class="text-sm font-semibold">
        {{ t('chat.tasks') }}
      </h3>
      <span class="text-xs text-muted-foreground">
        {{ taskStore.tasks.length }}
      </span>
    </header>

    <div class="flex-1 overflow-y-auto p-3 space-y-3">
      <section
        v-for="status in ['todo', 'doing', 'done'] as const"
        :key="status"
        class="rounded-md border border-border/70"
        :data-testid="`task-column-${status}`"
      >
        <div class="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {{ statusMeta[status].label }}
          </span>
          <span class="text-xs text-muted-foreground">{{ taskGroups[status].length }}</span>
        </div>

        <div v-if="taskGroups[status].length" class="space-y-2 p-2">
          <article
            v-for="task in taskGroups[status]"
            :key="task.id"
            class="rounded-md border border-border/60 p-2"
            :data-testid="`task-item-${task.id}`"
          >
            <div class="text-sm font-medium text-foreground">
              {{ task.title }}
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              {{ task.assignee }}
            </div>

            <div class="mt-2 flex flex-wrap gap-1">
              <button
                v-if="status !== 'todo'"
                class="rounded border border-border px-2 py-1 text-xs"
                :data-testid="`task-move-todo-${task.id}`"
                @click="transitionTask(task, 'todo')"
              >
                {{ t('chat.task_move_todo') }}
              </button>
              <button
                v-if="status !== 'doing'"
                class="rounded border border-border px-2 py-1 text-xs"
                :data-testid="`task-move-doing-${task.id}`"
                @click="transitionTask(task, 'doing')"
              >
                {{ t('chat.task_move_doing') }}
              </button>
              <button
                v-if="status !== 'done'"
                class="rounded border border-border px-2 py-1 text-xs"
                :data-testid="`task-move-done-${task.id}`"
                @click="transitionTask(task, 'done')"
              >
                {{ t('chat.task_move_done') }}
              </button>
            </div>
          </article>
        </div>
        <p v-else class="px-3 py-4 text-xs text-muted-foreground">
          {{ t('chat.task_empty') }}
        </p>
      </section>
    </div>
  </section>
</template>
