<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import ProjectDetail from './components/ProjectDetail.vue';
import ProjectList from './components/ProjectList.vue';
import ProjectSettings from './components/ProjectSettings.vue';
import { subscribeToRemoteSync, unsubscribeFromRemoteSync } from './composables/useWorkItemStore';

const route = useRoute();

const projectId = computed(() => route.params.projectId as string | undefined);
const showSettings = computed(() => route.path.endsWith('/settings'));

// 消费其他端通过 Matrix 广播的工作项变更，使协同真正生效
onMounted(() => subscribeToRemoteSync());
onUnmounted(() => unsubscribeFromRemoteSync());
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <ProjectSettings v-if="showSettings && projectId" :project-id="projectId" />
    <ProjectDetail v-else-if="projectId" :project-id="projectId" />
    <ProjectList v-else />
  </div>
</template>
