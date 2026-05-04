<script setup lang="ts">
import { Clock3, FilePlus2, FileText, FolderOpen, Grid3X3, MessageSquare, MoreHorizontal, Search, Share2, SlidersHorizontal, Star, Users } from 'lucide-vue-next'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue'

const { t } = useI18n()

const DOCS_WIDTH_STORAGE_KEY = 'muon_docs_sidebar_width'
const DEFAULT_DOCS_WIDTH = 240
const MIN_DOCS_WIDTH = 220
const MAX_DOCS_WIDTH = 360

type DocumentSectionId = 'recent' | 'starred' | 'shared'

interface DocumentEntry {
  id: string
  title: string
  owner: string
  updated: string
  type: string
  status: string
  folder: string
  sectionIds: DocumentSectionId[]
}

const activeSection = shallowRef<DocumentSectionId>('recent')
const activeFolder = shallowRef('全部文档')
const searchQuery = shallowRef('')
const viewMode = shallowRef<'list' | 'grid'>('list')
const reviewOnly = shallowRef(false)
const moreMenuOpen = shallowRef(false)
const selectedDocumentId = shallowRef('doc-1')
const knowledgeQuestion = shallowRef('')
const knowledgeAnswer = shallowRef<{ question: string, title: string, owner: string, status: string } | null>(null)
const collaborationNotices = shallowRef<Record<string, string>>({})
const shareStatusByDocument = shallowRef<Record<string, string>>({})
const commentDraft = shallowRef('')
const commentsByDocument = shallowRef<Record<string, string[]>>({})
const documentEditorOpen = shallowRef(false)
const documentDraftId = shallowRef('')
const documentDraftTitle = shallowRef('新建协作文档')
const documentDraftOwner = shallowRef('我')
const documentDraftType = shallowRef('文档')
const resizeLabel = computed(() => t('sidebar.resize_docs'))

const sections = [
  { id: 'recent', label: '最近更新', icon: Clock3 },
  { id: 'starred', label: '已收藏', icon: Star },
  { id: 'shared', label: '共享给我', icon: Users },
] satisfies Array<{ id: DocumentSectionId, label: string, icon: typeof Clock3 }>

const folders = [
  '全部文档',
  '产品规划',
  '设计资产',
  '工程文档',
  '发布复盘',
]

const documents = shallowRef<DocumentEntry[]>([
  { id: 'doc-1', title: '知识库迁移计划', owner: '产品团队', updated: '10:42', type: '方案', status: '进行中', folder: '产品规划', sectionIds: ['recent'] },
  { id: 'doc-2', title: '桌面聊天体验走查', owner: '设计团队', updated: '昨天', type: '纪要', status: '评审中', folder: '设计资产', sectionIds: ['recent', 'starred'] },
  { id: 'doc-3', title: 'Matrix 同步排障手册', owner: '工程团队', updated: '周一', type: '手册', status: '稳定', folder: '工程文档', sectionIds: ['recent', 'shared'] },
  { id: 'doc-4', title: '发布准备检查清单', owner: '运营团队', updated: '4月28日', type: '清单', status: '草稿', folder: '发布复盘', sectionIds: ['recent'] },
])

const activeSectionLabel = computed(() => sections.find(section => section.id === activeSection.value)?.label ?? '最近更新')

const filteredDocuments = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return documents.value.filter((doc) => {
    const matchesQuery = !query || [doc.title, doc.owner, doc.type, doc.status]
      .some(value => value.toLowerCase().includes(query))
    const matchesSection = doc.sectionIds.includes(activeSection.value)
    const matchesFolder = activeFolder.value === '全部文档' || doc.folder === activeFolder.value
    const matchesReview = !reviewOnly.value || doc.status === '评审中'
    return matchesSection && matchesFolder && matchesQuery && matchesReview
  })
})

const selectedDocument = computed(() => filteredDocuments.value.find(doc => doc.id === selectedDocumentId.value) ?? filteredDocuments.value[0])
const selectedDocumentComments = computed(() => {
  const document = selectedDocument.value
  if (!document)
    return []
  return commentsByDocument.value[document.id] ?? []
})
const selectedDocumentShareStatus = computed(() => {
  const document = selectedDocument.value
  if (!document)
    return '仅团队可见'
  return shareStatusByDocument.value[document.id] ?? '仅团队可见'
})
const selectedDocumentCollaborationNotice = computed(() => {
  const document = selectedDocument.value
  if (!document)
    return '等待共享当前文档'
  return collaborationNotices.value[document.id] ?? '等待共享当前文档'
})

function createDocument(): void {
  const documentId = `doc-${Date.now()}`
  documentEditorOpen.value = true
  documentDraftId.value = documentId
  documentDraftTitle.value = '新建协作文档'
  documentDraftOwner.value = '我'
  documentDraftType.value = '文档'
  searchQuery.value = ''
  reviewOnly.value = false
  documents.value = [
    {
      id: documentId,
      title: '新建协作文档',
      owner: '我',
      updated: '刚刚',
      type: '文档',
      status: '草稿',
      folder: activeFolder.value === '全部文档' ? '产品规划' : activeFolder.value,
      sectionIds: ['recent'],
    },
    ...documents.value,
  ]
  selectedDocumentId.value = documentId
}

function toggleViewMode(): void {
  viewMode.value = viewMode.value === 'list' ? 'grid' : 'list'
}

function selectFolder(folder: string): void {
  activeFolder.value = folder
  searchQuery.value = ''
  selectedDocumentId.value = documents.value.find(doc =>
    doc.sectionIds.includes(activeSection.value)
    && (folder === '全部文档' || doc.folder === folder),
  )?.id ?? ''
}

function selectSection(sectionId: DocumentSectionId): void {
  activeSection.value = sectionId
  searchQuery.value = ''
  selectedDocumentId.value = documents.value.find(doc => doc.sectionIds.includes(sectionId))?.id ?? ''
}

function selectDocument(documentId: string): void {
  selectedDocumentId.value = documentId
}

function askKnowledgeQuestion(): void {
  const question = knowledgeQuestion.value.trim()
  if (!question)
    return

  const tokens = question
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const matchedDocument = documents.value.find(doc =>
    tokens.some(token => [doc.title, doc.owner, doc.type, doc.status].some(value => value.toLowerCase().includes(token))),
  ) ?? documents.value[0]

  knowledgeAnswer.value = {
    question,
    title: matchedDocument.title,
    owner: matchedDocument.owner,
    status: matchedDocument.status,
  }
  selectedDocumentId.value = matchedDocument.id
}

function shareSelectedDocument(): void {
  const document = selectedDocument.value
  if (!document)
    return

  shareStatusByDocument.value = {
    ...shareStatusByDocument.value,
    [document.id]: '团队可编辑',
  }
  collaborationNotices.value = {
    ...collaborationNotices.value,
    [document.id]: `已共享给设计评审群：${document.title}`,
  }
}

function markSelectedDocumentForReview(): void {
  const document = selectedDocument.value
  if (!document)
    return

  documents.value = documents.value.map(item => item.id === document.id
    ? { ...item, status: '评审中' }
    : item)
  collaborationNotices.value = {
    ...collaborationNotices.value,
    [document.id]: `已标记待审阅：${document.title}`,
  }
  moreMenuOpen.value = false
}

function saveDraftDocument(): void {
  if (!documentEditorOpen.value)
    return

  const documentId = documentDraftId.value
  const title = documentDraftTitle.value.trim() || '新建协作文档'
  const owner = documentDraftOwner.value.trim() || '我'
  const type = documentDraftType.value.trim() || '文档'

  documents.value = documents.value.map(item => item.id === documentId
    ? {
        ...item,
        title,
        owner,
        type,
      }
    : item)
  selectedDocumentId.value = documentId
  collaborationNotices.value = {
    ...collaborationNotices.value,
    [documentId]: `已创建文档：${title}`,
  }
  documentEditorOpen.value = false
}

function addCollaborationComment(): void {
  const comment = commentDraft.value.trim()
  const document = selectedDocument.value
  if (!comment || !document)
    return

  commentsByDocument.value = {
    ...commentsByDocument.value,
    [document.id]: [`评论：${comment}`, ...(commentsByDocument.value[document.id] ?? [])],
  }
  commentDraft.value = ''
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
          :data-testid="`docs-section-${section.id}`"
          class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
          :class="activeSection === section.id ? 'workspace-row-active' : ''"
          @click="selectSection(section.id)"
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
          :data-testid="`docs-folder-${folder}`"
          class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
          :class="activeFolder === folder ? 'workspace-row-active' : ''"
          @click="selectFolder(folder)"
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
        <div class="relative ml-4 flex items-center gap-1">
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
          <div
            v-if="moreMenuOpen"
            class="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-md border border-border bg-popover py-1 shadow-lg"
          >
            <button
              data-testid="docs-more-mark-review"
              class="flex h-8 w-full items-center px-3 text-left text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
              @click="markSelectedDocumentForReview"
            >
              标记待审阅
            </button>
          </div>
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

          <section class="workspace-surface overflow-hidden rounded-lg">
            <div class="flex h-11 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">
                知识问答
              </h2>
              <span class="text-[12px] text-muted-foreground">基于团队文档</span>
            </div>
            <div class="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                v-model="knowledgeQuestion"
                data-testid="docs-knowledge-question"
                type="text"
                class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
                placeholder="向知识库提问..."
                @keyup.enter="askKnowledgeQuestion"
              >
              <button
                data-testid="docs-knowledge-ask"
                class="h-9 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                @click="askKnowledgeQuestion"
              >
                提问
              </button>
            </div>
            <div class="border-t border-border px-4 py-3">
              <template v-if="knowledgeAnswer">
                <h3 class="text-[14px] font-semibold">
                  知识问答：{{ knowledgeAnswer.question }}
                </h3>
                <p class="mt-2 text-[13px] leading-5 text-muted-foreground">
                  建议查看 {{ knowledgeAnswer.title }}，该文档当前状态为 {{ knowledgeAnswer.status }}。
                </p>
                <p class="mt-2 text-[12px] font-semibold text-muted-foreground">
                  来源：{{ knowledgeAnswer.owner }}
                </p>
              </template>
              <p v-else class="text-[13px] leading-5 text-muted-foreground">
                输入问题后，Muon 会从本地团队文档中匹配最相关的来源。
              </p>
            </div>
          </section>

          <div class="workspace-surface overflow-hidden rounded-lg">
            <div class="flex h-11 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">
                最近文档
              </h2>
              <span class="text-[12px] text-muted-foreground">
                当前视图：{{ viewMode === 'list' ? '列表' : '网格' }}
                <span> · 当前分区：{{ activeSectionLabel }}</span>
                <span> · 当前文件夹：{{ activeFolder }}</span>
                <span v-if="selectedDocument"> · 当前文档：{{ selectedDocument.title }}</span>
                <span v-if="reviewOnly"> · 仅显示待审阅</span>
                <span v-if="moreMenuOpen"> · 已打开更多操作</span>
              </span>
            </div>
            <div class="divide-y divide-border">
              <button
                v-for="doc in filteredDocuments"
                :key="doc.id"
                :data-testid="`docs-document-${doc.id}`"
                class="grid w-full grid-cols-[minmax(0,1fr)_120px_110px_90px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
                :class="selectedDocument?.id === doc.id ? 'bg-primary/8' : ''"
                @click="selectDocument(doc.id)"
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

          <section class="workspace-surface overflow-hidden rounded-lg">
            <div class="flex h-11 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">
                协作动态
              </h2>
              <span class="text-[12px] text-muted-foreground">共享状态：{{ selectedDocumentShareStatus }}</span>
            </div>
            <div class="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div class="grid gap-2 text-[13px] leading-5">
                <span class="font-semibold text-foreground">{{ selectedDocumentCollaborationNotice }}</span>
                <span v-if="selectedDocument" class="text-muted-foreground">当前协作：{{ selectedDocument.title }} · {{ selectedDocument.owner }}</span>
              </div>
              <button
                data-testid="docs-share-selected"
                class="flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                @click="shareSelectedDocument"
              >
                <Share2 :size="15" />
                <span>共享文档</span>
              </button>
            </div>
            <div v-if="documentEditorOpen" class="grid gap-3 border-t border-border p-4 md:grid-cols-[minmax(0,1fr)_160px_120px_auto]">
              <input
                v-model="documentDraftTitle"
                data-testid="docs-new-title"
                type="text"
                placeholder="文档标题"
                class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              >
              <input
                v-model="documentDraftOwner"
                data-testid="docs-new-owner"
                type="text"
                placeholder="所有者"
                class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              >
              <input
                v-model="documentDraftType"
                data-testid="docs-new-type"
                type="text"
                placeholder="类型"
                class="h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              >
              <button
                data-testid="docs-save-new-document"
                class="h-9 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                @click="saveDraftDocument"
              >
                保存文档
              </button>
            </div>
            <div class="grid gap-3 border-t border-border p-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <label class="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-muted-foreground focus-within:border-primary">
                <MessageSquare :size="15" />
                <input
                  v-model="commentDraft"
                  data-testid="docs-comment-input"
                  type="text"
                  placeholder="添加协作评论..."
                  class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                >
              </label>
              <button
                data-testid="docs-add-comment"
                class="h-9 rounded-md border border-border px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent"
                @click="addCollaborationComment"
              >
                添加评论
              </button>
            </div>
            <div class="border-t border-border px-4 py-3">
              <div v-if="selectedDocumentComments.length" class="grid gap-2 text-[13px] leading-5">
                <span v-for="comment in selectedDocumentComments" :key="comment" class="text-muted-foreground">{{ comment }}</span>
              </div>
              <p v-else class="text-[13px] leading-5 text-muted-foreground">
                暂无评论，添加后会在当前文档协作动态中展示。
              </p>
            </div>
          </section>
        </div>
      </main>
    </section>
  </div>
</template>
