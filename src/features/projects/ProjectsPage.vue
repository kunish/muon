<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ProjectDetail from './components/ProjectDetail.vue'
import ProjectList from './components/ProjectList.vue'
import ProjectSettings from './components/ProjectSettings.vue'

const route = useRoute()

const projectId = computed(() => route.params.projectId as string | undefined)
const showSettings = computed(() => route.path.endsWith('/settings'))
</script>

<template>
  <div class="flex h-full flex-col">
    <ProjectSettings v-if="showSettings && projectId" :project-id="projectId" />
    <ProjectDetail v-else-if="projectId" :project-id="projectId" />
    <ProjectList v-else />
  </div>
</template>
