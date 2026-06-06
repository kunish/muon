<script setup lang="ts">
import type { ProjectView } from '../types';
import { Button } from '@muon/ui/button';
import { Kanban, LayoutList, Settings, Trash2 } from 'lucide-vue-next';
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ask } from '@/desktop/dialog';
import { setCurrentProject } from '../composables/useProjectStore';
import { loadItems, setCurrentProject as setWorkItemProject } from '../composables/useWorkItemStore';
import { useDeleteProject, useProjectsQuery } from '../queries/useProjects';
import BoardView from './view/BoardView.vue';
import GanttView from './view/GanttView.vue';
import ListView from './view/ListView.vue';

const props = defineProps<{ projectId: string }>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const projectsQuery = useProjectsQuery();
const deleteProjectMutation = useDeleteProject();

const project = computed(() => projectsQuery.projects.value.find((p) => p.id === props.projectId));

const currentView = computed<ProjectView>(() => {
  const v = route.query.view as string;
  if (v === 'list' || v === 'gantt') return v;
  return 'board';
});

watch(
  () => props.projectId,
  async (projectId) => {
    setCurrentProject(projectId);
    setWorkItemProject(projectId);
    if (!project.value) await projectsQuery.refetch();
    await loadItems(projectId);
  },
  { immediate: true },
);

function setView(view: ProjectView) {
  router.replace({ query: { view } });
}

function openSettings() {
  router.push(`/projects/${props.projectId}/settings`);
}

async function deleteProject() {
  const confirmed = await ask(t('projects.delete_project_confirm'), {
    title: t('projects.delete_project'),
    kind: 'warning',
  });
  if (!confirmed) return;
  await deleteProjectMutation.mutateAsync(props.projectId);
  router.push('/projects');
}
</script>

<template>
  <div v-if="project" class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
      <div class="flex min-w-0 items-center gap-3">
        <h1 class="truncate text-lg font-semibold">
          {{ project.name }}
        </h1>
        <span class="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {{ t(`projects.template_${project.template}`) }}
        </span>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <div class="flex rounded-lg border bg-muted/50 p-0.5">
          <button
            v-for="v in ['board', 'list', 'gantt'] as ProjectView[]"
            :key="v"
            class="rounded-md px-3 py-1.5 text-sm"
            :class="currentView === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            @click="setView(v)"
          >
            <Kanban v-if="v === 'board'" class="inline h-3.5 w-3.5" />
            <LayoutList v-else-if="v === 'list'" class="inline h-3.5 w-3.5" />
            <span v-else class="inline h-3.5 w-3.5">📅</span>
            <span class="ml-1">{{ t(`projects.view_${v}`) }}</span>
          </button>
        </div>
        <Button variant="ghost" size="icon" @click="openSettings()">
          <Settings class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" @click="deleteProject()">
          <Trash2 class="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>

    <div class="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <BoardView v-if="currentView === 'board'" :project-id="props.projectId" />
      <ListView v-else-if="currentView === 'list'" :project-id="props.projectId" />
      <GanttView v-else :project-id="props.projectId" />
    </div>
  </div>
  <div v-else class="flex flex-1 items-center justify-center">
    {{ t('common.loading') }}
  </div>
</template>
