<script setup lang="ts">
import { computed, ref } from 'vue'
import type { KnowledgeTab } from '../types/knowledge'

const props = withDefaults(defineProps<{
  initialTab?: KnowledgeTab
}>(), {
  initialTab: 'digest',
})

defineSlots<{
  digest?: () => any
  decision?: () => any
  qa?: () => any
}>()

const activeTab = ref<KnowledgeTab>(props.initialTab)

const tabs = computed<Array<{ id: KnowledgeTab, label: string }>>(() => [
  { id: 'digest', label: 'Digest' },
  { id: 'decision', label: 'Decision' },
  { id: 'qa', label: 'Q&A' },
])

function setActiveTab(tab: KnowledgeTab) {
  activeTab.value = tab
}
</script>

<template>
  <section class="flex h-full flex-col" data-testid="knowledge-capture-panel">
    <header class="border-b border-border px-4 py-3">
      <div class="text-sm font-semibold text-foreground">
        Knowledge
      </div>
      <div class="mt-3 flex gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="rounded-md border px-3 py-1.5 text-xs"
          :class="activeTab === tab.id ? 'border-primary text-primary' : 'border-border text-muted-foreground'"
          :data-testid="`knowledge-tab-${tab.id}`"
          @click="setActiveTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-3">
      <div v-if="activeTab === 'digest'" data-testid="knowledge-panel-digest">
        <slot name="digest">
          <p class="text-sm text-muted-foreground">
            Digest panel placeholder.
          </p>
        </slot>
      </div>

      <div v-else-if="activeTab === 'decision'" data-testid="knowledge-panel-decision">
        <slot name="decision">
          <p class="text-sm text-muted-foreground">
            Decision panel placeholder.
          </p>
        </slot>
      </div>

      <div v-else data-testid="knowledge-panel-qa">
        <slot name="qa">
          <p class="text-sm text-muted-foreground">
            Q&amp;A panel placeholder.
          </p>
        </slot>
      </div>
    </div>
  </section>
</template>
