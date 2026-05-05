<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ProjectList from './components/ProjectList.vue'
import ProjectDetail from './components/ProjectDetail.vue'

const ProjectSettings = defineAsyncComponent(() => import('./components/ProjectSettings.vue'))

const route = useRoute()
const { t } = useI18n()

const projectId = computed(() => route.params.projectId as string | undefined)
const showSettings = computed(() => route.path.endsWith('/settings'))

const pageTitle = computed(() => {
  if (showSettings.value) return t('projects.settings')
  if (projectId.value) return '' // ProjectDetail sets its own title
  return t('sidebar.projects')
})
</script>

<template>
  <div class="flex h-full flex-col">
    <ProjectSettings v-if="showSettings && projectId" :project-id="projectId" />
    <ProjectDetail v-else-if="projectId" :project-id="projectId" />
    <ProjectList v-else />
  </div>
</template>
