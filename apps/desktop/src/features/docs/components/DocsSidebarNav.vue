<script setup lang="ts">
import type { DocSectionId } from '../types/doc';

defineProps<{
  sections: Array<{ id: DocSectionId; label: string; icon: Component }>;
  activeSection: DocSectionId;
}>();

const emit = defineEmits<{ select: [id: DocSectionId] }>();
</script>

<template>
  <div class="flex flex-col gap-1">
    <button
      v-for="section in sections"
      :key="section.id"
      class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
      :class="{ 'workspace-row-active': activeSection === section.id }"
      @click="emit('select', section.id)"
    >
      <component :is="section.icon" :size="18" />
      <span class="text-[13px] font-semibold">{{ section.label }}</span>
    </button>
  </div>
</template>
