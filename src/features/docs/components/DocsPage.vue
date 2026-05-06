<script setup lang="ts">
import type { DocEntry, DocFolderNode } from '../types/doc'
import { Check, Plus, Search, X } from 'lucide-vue-next'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue'
import { useDocsStore } from '../stores/docsStore'
import DocPreviewCard from './DocPreviewCard.vue'
import DocsSidebar from './DocsSidebar.vue'
import DocEditor from './editor/DocEditor.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useDocsStore()

const selectedDocId = computed(() => (route.params?.docId as string | undefined) ?? '')
const renamingDocId = shallowRef('')
const renameDraft = shallowRef('')
const movingDocId = shallowRef('')
const moveDraft = shallowRef('')

store.loadDocuments()
store.loadFolders()

const resizeLabel = computed(() => t('sidebar.resize_docs'))

const DOCS_WIDTH_STORAGE_KEY = 'muon_docs_sidebar_width'
const DEFAULT_DOCS_WIDTH = 240
const MIN_DOCS_WIDTH = 220
const MAX_DOCS_WIDTH = 360

const folderOptions = computed(() => {
  const options: Array<{ id: string, label: string }> = []
  function visit(folder: DocFolderNode): void {
    options.push({
      id: folder.id,
      label: `${'  '.repeat(folder.depth)}${folder.name}`,
    })
    folder.children.forEach(visit)
  }
  visit(store.folderTree)
  return options
})

async function createDocument(): Promise<void> {
  const docId = await store.createDocument('新建协作文档', store.activeFolder)
  await router.push(`/docs/${docId}`)
}

function openDocument(id: string): void {
  void router.push(`/docs/${id}`)
}

function startRename(doc: DocEntry): void {
  movingDocId.value = ''
  renamingDocId.value = doc.id
  renameDraft.value = doc.title
}

function cancelRename(): void {
  renamingDocId.value = ''
  renameDraft.value = ''
}

async function saveRename(): Promise<void> {
  if (!renamingDocId.value)
    return
  await store.updateDocumentTitle(renamingDocId.value, renameDraft.value)
  cancelRename()
}

function startMove(doc: DocEntry): void {
  renamingDocId.value = ''
  movingDocId.value = doc.id
  moveDraft.value = doc.folder
}

function cancelMove(): void {
  movingDocId.value = ''
  moveDraft.value = ''
}

async function saveMove(): Promise<void> {
  if (!movingDocId.value)
    return
  await store.updateDocumentFolder(movingDocId.value, moveDraft.value)
  cancelMove()
}

async function deleteDocument(doc: DocEntry): Promise<void> {
  await store.deleteDocument(doc.id)
}
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
      <header class="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-sidebar px-4">
        <label class="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border bg-input px-3 text-muted-foreground focus-within:border-primary">
          <Search :size="18" />
          <input
            v-model="store.searchQuery"
            type="text"
            placeholder="搜索文档..."
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          >
        </label>
        <button
          data-testid="docs-list-create"
          class="inline-flex h-8 shrink-0 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @click="createDocument"
        >
          <Plus :size="16" />
          <span>新建文档</span>
        </button>
      </header>
      <main class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="divide-y divide-border rounded-lg border border-border">
          <div
            v-for="doc in store.filteredDocuments"
            :key="doc.id"
          >
            <DocPreviewCard
              :doc="doc"
              :is-selected="false"
              @select="openDocument"
              @rename="startRename"
              @move="startMove"
              @delete="deleteDocument"
            />
            <form
              v-if="renamingDocId === doc.id"
              data-testid="docs-rename-form"
              class="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-3"
              @submit.prevent="saveRename"
            >
              <input
                v-model="renameDraft"
                data-testid="docs-rename-input"
                class="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              >
              <button
                type="submit"
                data-testid="docs-rename-save"
                class="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                title="保存"
                aria-label="保存"
              >
                <Check :size="16" />
              </button>
              <button
                type="button"
                class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                title="取消"
                aria-label="取消"
                @click="cancelRename"
              >
                <X :size="16" />
              </button>
            </form>
            <form
              v-if="movingDocId === doc.id"
              data-testid="docs-move-form"
              class="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-3"
              @submit.prevent="saveMove"
            >
              <select
                v-model="moveDraft"
                data-testid="docs-move-select"
                class="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              >
                <option
                  v-for="folder in folderOptions"
                  :key="folder.id || 'root'"
                  :value="folder.id"
                >
                  {{ folder.label }}
                </option>
              </select>
              <button
                type="submit"
                data-testid="docs-move-save"
                class="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                title="移动"
                aria-label="移动"
              >
                <Check :size="16" />
              </button>
              <button
                type="button"
                class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                title="取消"
                aria-label="取消"
                @click="cancelMove"
              >
                <X :size="16" />
              </button>
            </form>
          </div>
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
