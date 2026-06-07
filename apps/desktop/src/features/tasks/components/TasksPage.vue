<script setup lang="ts">
import type { TaskItem, TaskStatus } from '@/features/chat/types/task';
import { useSelector } from '@tanstack/vue-store';
import { CalendarClock, ListTodo, UserRound } from 'lucide-vue-next';
import { computed, onMounted, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import WorkspacePageFrame from '@/app/components/workspace/WorkspacePageFrame.vue';
import { selectTasksByStatus, taskStore, transitionStatus } from '@/features/chat/stores/taskStore';
import { canTransitionTaskStatus } from '@/features/chat/types/task';
import { preloadAndNavigate } from '@/shared/lib/contextPreload';

const { t } = useI18n();
const router = useRouter();

// 全局任务来自聊天消息派生的 follow-up（单一数据源在 features/chat）；此页只做跨房间的集中呈现。
const groups = useSelector(taskStore, selectTasksByStatus);
const allTasks = useSelector(taskStore, (state) => state.tasks);

// 全局搜索深链：?focus=<taskId> 时高亮该任务卡片。
const route = useRoute();
const highlightedId = shallowRef<string | null>(null);
onMounted(() => {
  const focus = typeof route.query.focus === 'string' ? route.query.focus : null;
  if (focus && allTasks.value.some((task) => task.id === focus)) highlightedId.value = focus;
});

const now = Date.now();

const columns: { status: TaskStatus; accent: string }[] = [
  { status: 'todo', accent: 'text-warning' },
  { status: 'doing', accent: 'text-primary' },
  { status: 'done', accent: 'text-success' },
];

const transitionLabel: Record<TaskStatus, string> = {
  todo: 'chat.task_move_todo',
  doing: 'chat.task_move_doing',
  done: 'chat.task_move_done',
};

const overdueCount = computed(() => allTasks.value.filter(isOverdue).length);

function isOverdue(task: TaskItem): boolean {
  return task.status !== 'done' && task.dueAt < now;
}

function formatDue(dueAt: number): string {
  const date = new Date(dueAt);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
}

async function jumpToSource(task: TaskItem): Promise<void> {
  await preloadAndNavigate(router, task.sourceRef.roomId, task.sourceRef.eventId, 'TasksPage');
}

function move(task: TaskItem, to: TaskStatus): void {
  transitionStatus(task.id, to);
}
</script>

<template>
  <WorkspacePageFrame :title="t('chat.tasks')" :subtitle="t('tasks.subtitle')" :icon="ListTodo">
    <template #actions>
      <span class="text-[13px] text-muted-foreground">{{ t('tasks.total', { count: allTasks.length }) }}</span>
      <span v-if="overdueCount > 0" class="text-[13px] text-destructive">{{
        t('tasks.overdue', { count: overdueCount })
      }}</span>
    </template>

    <!-- 全局空状态：任务由消息派生，引导用户去聊天创建 -->
    <div
      v-if="allTasks.length === 0"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center"
      data-testid="tasks-empty"
    >
      <ListTodo :size="28" class="text-muted-foreground" />
      <p class="text-[14px] font-medium text-foreground">{{ t('tasks.empty_title') }}</p>
      <p class="text-[13px] text-muted-foreground">{{ t('tasks.empty_hint') }}</p>
    </div>

    <!-- 三栏看板：待办 / 进行中 / 已完成 -->
    <div v-else class="grid gap-4 lg:grid-cols-3">
      <section
        v-for="column in columns"
        :key="column.status"
        class="flex flex-col rounded-xl border border-border bg-card"
        :data-testid="`tasks-column-${column.status}`"
      >
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <span class="text-[13px] font-semibold" :class="column.accent">
            {{ t(`chat.task_status_${column.status}`) }}
          </span>
          <span class="text-[12px] text-muted-foreground">{{ groups[column.status].length }}</span>
        </header>

        <div v-if="groups[column.status].length" class="flex flex-col gap-2 p-3">
          <article
            v-for="task in groups[column.status]"
            :key="task.id"
            class="rounded-lg border bg-background p-3"
            :class="highlightedId === task.id ? 'border-primary ring-1 ring-primary' : 'border-border'"
            :data-testid="`tasks-item-${task.id}`"
          >
            <p class="text-[14px] font-medium text-foreground">{{ task.title }}</p>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
              <span class="inline-flex items-center gap-1"> <UserRound :size="12" />{{ task.assignee }} </span>
              <span class="inline-flex items-center gap-1" :class="isOverdue(task) ? 'text-destructive' : ''">
                <CalendarClock :size="12" />{{ formatDue(task.dueAt) }}
              </span>
            </div>

            <div class="mt-2.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                class="rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground transition hover:bg-accent/40"
                :data-testid="`tasks-jump-${task.id}`"
                @click="jumpToSource(task)"
              >
                {{ t('chat.task_jump_source') }}
              </button>
              <button
                v-for="target in (['todo', 'doing', 'done'] as TaskStatus[]).filter((to) =>
                  canTransitionTaskStatus(task.status, to),
                )"
                :key="target"
                type="button"
                class="rounded-md border border-border px-2 py-1 text-[12px] text-foreground transition hover:bg-accent/40"
                :data-testid="`tasks-move-${target}-${task.id}`"
                @click="move(task, target)"
              >
                {{ t(transitionLabel[target]) }}
              </button>
            </div>
          </article>
        </div>
        <p v-else class="px-4 py-6 text-center text-[12px] text-muted-foreground">{{ t('chat.task_empty') }}</p>
      </section>
    </div>
  </WorkspacePageFrame>
</template>
