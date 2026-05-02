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
const searchQuery = shallowRef('')
const viewMode = shallowRef<'list' | 'grid'>('list')
const reviewOnly = shallowRef(false)
const moreMenuOpen = shallowRef(false)
const resizeLabel = computed(() => t('sidebar.resize_docs'))

const sections = [
  { id: 'recent', label: '最近更新', icon: Clock3 },
  { id: 'starred', label: '已收藏', icon: Star },
  { id: 'shared', label: '共享给我', icon: Users },
]

const folders = [
  '产品规划',
  '设计资产',
  '工程文档',
  '发布复盘',
]

const documents = shallowRef([
  { id: 'doc-1', title: '知识库迁移计划', owner: '产品团队', updated: '10:42', type: '方案', status: '进行中' },
  { id: 'doc-2', title: '桌面聊天体验走查', owner: '设计团队', updated: '昨天', type: '纪要', status: '评审中' },
  { id: 'doc-3', title: 'Matrix 同步排障手册', owner: '工程团队', updated: '周一', type: '手册', status: '稳定' },
  { id: 'doc-4', title: '发布准备检查清单', owner: '运营团队', updated: '4月28日', type: '清单', status: '草稿' },
])

const filteredDocuments = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return documents.value.filter((doc) => {
    const matchesQuery = !query || [doc.title, doc.owner, doc.type, doc.status]
      .some(value => value.toLowerCase().includes(query))
    const matchesReview = !reviewOnly.value || doc.status === '评审中'
    return matchesQuery && matchesReview
  })
})

function createDocument(): void {
  searchQuery.value = ''
  reviewOnly.value = false
  documents.value = [
    { id: `doc-${Date.now()}`, title: '新建协作文档', owner: '我', updated: '刚刚', type: '文档', status: '草稿' },
    ...documents.value,
  ]
}

function toggleViewMode(): void {
  viewMode.value = viewMode.value === 'list' ? 'grid' : 'list'
}
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
          {{ t('sidebar.docs') }}
        </h1>
        <p class="mt-1 text-[13px] leading-[18px] text-muted-foreground">
          团队资料与项目文档
        </p>
      </div>

      <button
        data-testid="docs-new-button"
        class="mx-2 mb-4 flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        @click="createDocument"
      >
        <FilePlus2 :size="16" />
        <span>新建文档</span>
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
        文件夹
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
            v-model="searchQuery"
            data-testid="docs-search-input"
            type="text"
            placeholder="搜索文档、所有者或标签..."
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          >
        </label>
        <div class="ml-4 flex items-center gap-1">
          <button
            data-testid="docs-view-toggle"
            class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            :title="viewMode === 'list' ? '切换为网格视图' : '切换为列表视图'"
            @click="toggleViewMode"
          >
            <Grid3X3 :size="18" />
          </button>
          <button
            data-testid="docs-filter-toggle"
            class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="筛选"
            @click="reviewOnly = !reviewOnly"
          >
            <SlidersHorizontal :size="18" />
          </button>
          <button
            data-testid="docs-more-toggle"
            class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="更多"
            @click="moreMenuOpen = !moreMenuOpen"
          >
            <MoreHorizontal :size="18" />
          </button>
        </div>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto flex w-full max-w-[1120px] flex-col gap-5">
          <div class="grid gap-3 md:grid-cols-3">
            <div class="workspace-surface rounded-lg p-4">
              <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                文档总数
              </div>
              <div class="mt-3 text-2xl font-semibold leading-8">
                128
              </div>
              <p class="mt-1 text-[13px] text-muted-foreground">
                本周更新 18 篇
              </p>
            </div>
            <div class="workspace-surface rounded-lg p-4">
              <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                共享协作
              </div>
              <div class="mt-3 text-2xl font-semibold leading-8">
                42
              </div>
              <p class="mt-1 text-[13px] text-muted-foreground">
                覆盖 6 个团队
              </p>
            </div>
            <div class="workspace-surface rounded-lg p-4">
              <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                待审阅
              </div>
              <div class="mt-3 text-2xl font-semibold leading-8">
                9
              </div>
              <p class="mt-1 text-[13px] text-muted-foreground">
                需要跟进处理
              </p>
            </div>
          </div>

          <div class="workspace-surface overflow-hidden rounded-lg">
            <div class="flex h-11 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">
                最近文档
              </h2>
              <span class="text-[12px] text-muted-foreground">
                当前视图：{{ viewMode === 'list' ? '列表' : '网格' }}
                <span v-if="reviewOnly"> · 仅显示待审阅</span>
                <span v-if="moreMenuOpen"> · 已打开更多操作</span>
              </span>
            </div>
            <div class="divide-y divide-border">
              <button
                v-for="doc in filteredDocuments"
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
