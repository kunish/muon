<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { useDocsStore } from '../stores/docsStore'
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue'
import DocsSidebar from './DocsSidebar.vue'
import DocEditor from './editor/DocEditor.vue'
import DocPreviewCard from './DocPreviewCard.vue'

const { t } = useI18n()
const route = useRoute()
const store = useDocsStore()

const selectedDocId = computed(() =>
  (route.params?.docId as string) ?? (store.filteredDocuments[0]?.id ?? ''),
)
const selectedDoc = computed(() =>
  selectedDocId.value ? store.filteredDocuments.find(d => d.id === selectedDocId.value) : undefined,
)

store.loadDocuments()

const resizeLabel = computed(() => t('sidebar.resize_docs'))

const DOCS_WIDTH_STORAGE_KEY = 'muon_docs_sidebar_width'
const DEFAULT_DOCS_WIDTH = 240
const MIN_DOCS_WIDTH = 220
const MAX_DOCS_WIDTH = 360
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 bg-background text-foreground">
    <WorkspaceResizablePane
      as="nav"
      pane-test-id="docs-sidebar"
      content-test-id="docs-sidebar-content"
      handle-test-id="docs-sidebar-resize-handle"
      content-class="flex h-full min-h-0 flex-col overflow-hidden px-0 py-0"
      :width-storage-key="DOCS_WIDTH_STORAGE_KEY"
      :default-width="DEFAULT_DOCS_WIDTH"
      :min-width="MIN_DOCS_WIDTH"
      :max-width="MAX_DOCS_WIDTH"
      :resize-label="resizeLabel"
    >
      <DocsSidebar />
    </WorkspaceResizablePane>

    <!-- No document selected: show list -->
    <section v-if="!selectedDocId" class="flex min-w-0 flex-1 flex-col bg-background">
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4">
        <label class="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border bg-input px-3 text-muted-foreground focus-within:border-primary">
          <Search :size="18" />
          <input
            v-model="store.searchQuery"
            type="text"
            placeholder="搜索文档..."
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          >
        </label>
      </header>
      <main class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="divide-y divide-border rounded-lg border border-border">
          <DocPreviewCard
            v-for="doc in store.filteredDocuments"
            :key="doc.id"
            :doc="doc"
            :is-selected="false"
            @select="id => $router.push(`/docs/${id}`)"
          />
        </div>
      </main>
    </section>

    <!-- Document selected: show editor -->
    <DocEditor
      v-else-if="selectedDocId"
      :key="selectedDocId"
      :doc-id="selectedDocId"
    />
  </div>
</template>
