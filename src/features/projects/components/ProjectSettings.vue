<script setup lang="ts">
import { Button } from '@muon/ui/button'
import { ArrowLeft } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../composables/useProjectStore'
import CustomFieldEditor from './settings/CustomFieldEditor.vue'
import WorkflowEditor from './settings/WorkflowEditor.vue'

const props = defineProps<{ projectId: string }>()

const { t } = useI18n()
const router = useRouter()
const store = useProjectStore()
const project = computed(() => store.projects.find(p => p.id === props.projectId))

const activeTab = ref<'general' | 'workflow' | 'fields'>('general')

watch(
  () => props.projectId,
  async (projectId) => {
    store.setCurrentProject(projectId)
    if (!project.value)
      await store.loadProjects()
  },
  { immediate: true },
)

function goBack() {
  router.push(`/projects/${props.projectId}`)
}
</script>

<template>
  <div v-if="project" class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <div class="flex items-center gap-3 border-b px-6 py-3">
      <Button variant="ghost" size="icon" @click="goBack()">
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <h1 class="text-lg font-semibold">
        {{ project.name }} — {{ t('projects.settings') }}
      </h1>
    </div>

    <div class="flex border-b">
      <button
        v-for="tab in (['general', 'workflow', 'fields'] as const)"
        :key="tab"
        class="border-b-2 px-4 py-2 text-sm font-medium"
        :class="activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'"
        @click="activeTab = tab"
      >
        {{ tab === 'general' ? t('common.edit') : t(`projects.${tab === 'workflow' ? 'workflow' : 'custom_fields'}`) }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="activeTab === 'general'" class="max-w-md space-y-4 p-6">
        <p class="text-sm text-muted-foreground">
          {{ t('projects.project_name') }}: {{ project.name }}
        </p>
      </div>
      <WorkflowEditor v-else-if="activeTab === 'workflow'" :project-id="projectId" />
      <CustomFieldEditor v-else :project-id="projectId" />
    </div>
  </div>
</template>
