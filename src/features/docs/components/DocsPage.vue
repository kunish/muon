<script setup lang="ts">
import { Clock3, FilePlus2, FileText, FolderOpen, Grid3X3, MoreHorizontal, Search, SlidersHorizontal, Star, Users } from 'lucide-vue-next'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue'

const { t } = useI18n()

const DOCS_WIDTH_STORAGE_KEY = 'muon_docs_sidebar_width'
const DEFAULT_DOCS_WIDTH = 240
const MIN_DOCS_WIDTH = 220
const MAX_DOCS_WIDTH = 360

const activeSection = shallowRef('recent')
const resizeLabel = computed(() => t('sidebar.resize_docs'))

const sections = [
  { id: 'recent', label: 'Recent', icon: Clock3 },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'shared', label: 'Shared', icon: Users },
]

const folders = [
  'Q3 Planning',
  'Design Assets',
  'Engineering Specs',
  'Launch Reviews',
]

const documents = [
  { id: 'doc-1', title: 'Dashboard IA Review', owner: 'Design Team', updated: '10:42 AM', type: 'Spec', status: 'Active' },
  { id: 'doc-2', title: 'Desktop Chat Polish Notes', owner: 'Product', updated: 'Yesterday', type: 'Notes', status: 'Review' },
  { id: 'doc-3', title: 'Matrix Sync Runbook', owner: 'Engineering', updated: 'Mon', type: 'Runbook', status: 'Stable' },
  { id: 'doc-4', title: 'Release Readiness Checklist', owner: 'Operations', updated: 'Apr 28', type: 'Checklist', status: 'Draft' },
]
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 bg-background text-foreground">
    <WorkspaceResizablePane
      as="nav"
      pane-test-id="docs-sidebar"
      content-test-id="docs-sidebar-content"
      handle-test-id="docs-sidebar-resize-handle"
      content-class="flex h-full min-h-0 flex-col overflow-hidden px-2 py-6"
      :width-storage-key="DOCS_WIDTH_STORAGE_KEY"
      :default-width="DEFAULT_DOCS_WIDTH"
      :min-width="MIN_DOCS_WIDTH"
      :max-width="MAX_DOCS_WIDTH"
      :resize-label="resizeLabel"
    >
      <div class="mb-6 px-3">
        <h1 class="text-[18px] font-semibold leading-6 text-foreground">
          Docs
        </h1>
        <p class="mt-1 text-[13px] leading-[18px] text-muted-foreground">
          Workspace files
        </p>
      </div>

      <button class="mx-2 mb-4 flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">
        <FilePlus2 :size="16" />
        <span>New Document</span>
      </button>

      <div class="flex flex-col gap-1">
        <button
          v-for="section in sections"
          :key="section.id"
          class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
          :class="activeSection === section.id ? 'workspace-row-active' : ''"
          @click="activeSection = section.id"
        >
          <component :is="section.icon" :size="18" />
          <span class="text-[13px] font-semibold">{{ section.label }}</span>
        </button>
      </div>

      <div class="mt-6 px-3 pb-2 text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
        Folders
      </div>
      <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <button
          v-for="folder in folders"
          :key="folder"
          class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
        >
          <FolderOpen :size="18" />
          <span class="truncate text-[13px]">{{ folder }}</span>
        </button>
      </div>
    </WorkspaceResizablePane>

    <section class="flex min-w-0 flex-1 flex-col bg-background">
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4">
        <label class="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border bg-input px-3 text-muted-foreground focus-within:border-primary">
          <Search :size="18" />
          <input
            type="text"
            placeholder="Search documents..."
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          >
        </label>
        <div class="ml-4 flex items-center gap-1">
          <button class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="Grid view">
            <Grid3X3 :size="18" />
          </button>
          <button class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="Filter">
            <SlidersHorizontal :size="18" />
          </button>
          <button class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="More">
            <MoreHorizontal :size="18" />
          </button>
        </div>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto flex w-full max-w-[1120px] flex-col gap-5">
          <div class="grid gap-3 md:grid-cols-3">
            <div class="workspace-surface rounded-lg p-4">
              <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                Total docs
              </div>
              <div class="mt-3 text-2xl font-semibold leading-8">
                128
              </div>
              <p class="mt-1 text-[13px] text-muted-foreground">
                18 updated this week
              </p>
            </div>
            <div class="workspace-surface rounded-lg p-4">
              <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                Shared
              </div>
              <div class="mt-3 text-2xl font-semibold leading-8">
                42
              </div>
              <p class="mt-1 text-[13px] text-muted-foreground">
                Across 6 teams
              </p>
            </div>
            <div class="workspace-surface rounded-lg p-4">
              <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                Reviews
              </div>
              <div class="mt-3 text-2xl font-semibold leading-8">
                9
              </div>
              <p class="mt-1 text-[13px] text-muted-foreground">
                Waiting for action
              </p>
            </div>
          </div>

          <div class="workspace-surface overflow-hidden rounded-lg">
            <div class="flex h-11 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">
                Recent documents
              </h2>
              <span class="text-[12px] text-muted-foreground">Updated live</span>
            </div>
            <div class="divide-y divide-border">
              <button
                v-for="doc in documents"
                :key="doc.id"
                class="grid w-full grid-cols-[minmax(0,1fr)_120px_110px_90px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <span class="flex min-w-0 items-center gap-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-primary">
                    <FileText :size="16" />
                  </span>
                  <span class="min-w-0">
                    <span class="block truncate text-[13px] font-semibold">{{ doc.title }}</span>
                    <span class="block truncate text-[12px] text-muted-foreground">{{ doc.owner }}</span>
                  </span>
                </span>
                <span class="text-[12px] text-muted-foreground">{{ doc.updated }}</span>
                <span class="text-[12px] text-muted-foreground">{{ doc.type }}</span>
                <span class="justify-self-start rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  {{ doc.status }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </section>
  </div>
</template>
