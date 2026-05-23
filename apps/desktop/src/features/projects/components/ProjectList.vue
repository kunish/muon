<script setup lang="ts">
import { Button } from '@muon/ui/button';
import { Plus } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useProjectStore } from '../composables/useProjectStore';
import ProjectCreateDialog from './ProjectCreateDialog.vue';

const { t } = useI18n();
const router = useRouter();
const store = useProjectStore();
const showCreateDialog = ref(false);

onMounted(() => {
  store.loadProjects();
});

function openProject(id: string) {
  store.setCurrentProject(id);
  router.push(`/projects/${id}`);
}
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <div class="flex shrink-0 items-center justify-between border-b px-6 py-4">
      <h1 class="text-xl font-semibold">
        {{ t('sidebar.projects') }}
      </h1>
      <Button size="sm" @click="showCreateDialog = true">
        <Plus class="mr-1 h-4 w-4" />
        {{ t('projects.create_project') }}
      </Button>
    </div>

    <div v-if="store.loading" class="flex min-h-0 flex-1 items-center justify-center text-muted-foreground">
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="store.projects.length === 0"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <p>{{ t('projects.empty') }}</p>
      <Button variant="outline" @click="showCreateDialog = true">
        {{ t('projects.create_first') }}
      </Button>
    </div>

    <div
      v-else
      class="grid min-h-0 flex-1 auto-rows-[10rem] gap-4 overflow-auto p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <button
        v-for="project in store.projects"
        :key="project.id"
        class="flex h-40 flex-col justify-between rounded-xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
        @click="openProject(project.id)"
      >
        <div>
          <h3 class="font-semibold text-foreground">
            {{ project.name }}
          </h3>
          <p v-if="project.description" class="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {{ project.description }}
          </p>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{{ t(`projects.template_${project.template}`) }}</span>
          <span>·</span>
          <span>{{ new Date(project.updatedAt).toLocaleDateString() }}</span>
        </div>
      </button>
    </div>

    <ProjectCreateDialog v-model:open="showCreateDialog" />
  </div>
</template>
