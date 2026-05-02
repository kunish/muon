<script setup lang="ts">
import { AppWindow, BriefcaseBusiness, Brush, CalendarClock, Code2, Grid3X3, MessageSquare, MoreHorizontal, Plus, Search, UsersRound, Video } from 'lucide-vue-next'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue'

const { t } = useI18n()

const WORKPLACE_WIDTH_STORAGE_KEY = 'muon_workplace_sidebar_width'
const DEFAULT_WORKPLACE_WIDTH = 240
const MIN_WORKPLACE_WIDTH = 220
const MAX_WORKPLACE_WIDTH = 360

const activeCategory = shallowRef('all')
const searchQuery = shallowRef('')
const quickAction = shallowRef('工作台快捷操作已就绪')
const resizeLabel = computed(() => t('sidebar.resize_workplace'))

const categories = [
  { id: 'all', label: '全部应用', icon: Grid3X3 },
  { id: 'productivity', label: '协作效率', icon: BriefcaseBusiness },
  { id: 'operations', label: '人事行政', icon: UsersRound },
  { id: 'engineering', label: '工程研发', icon: Code2 },
  { id: 'design', label: '设计协作', icon: Brush },
]

const apps = shallowRef([
  { id: 'calendar', name: '日历', desc: '团队日程、专注时间和会议安排', category: 'productivity', icon: CalendarClock, accent: 'text-warning' },
  { id: 'meet', name: '视频会议', desc: '一键发起加密团队通话', category: 'productivity', icon: Video, accent: 'text-primary' },
  { id: 'tasks', name: '任务中心', desc: '个人待办与团队执行看板', category: 'operations', icon: AppWindow, accent: 'text-secondary' },
  { id: 'standup', name: '站会机器人', desc: '工程团队异步同步进展', category: 'engineering', icon: MessageSquare, accent: 'text-success' },
])

const workItems = [
  { id: 'item-1', title: '工作台信息架构评审', owner: '设计团队', time: '10:30', status: '评审中' },
  { id: 'item-2', title: '发布准备同步', owner: '工程团队', time: '13:00', status: '今日' },
  { id: 'item-3', title: '安全文档审批', owner: '运营团队', time: '15:45', status: '受阻' },
]

const filteredApps = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return apps.value.filter((app) => {
    const matchesCategory = activeCategory.value === 'all' || app.category === activeCategory.value
    const matchesQuery = !query || [app.name, app.desc].some(value => value.toLowerCase().includes(query))
    return matchesCategory && matchesQuery
  })
})

function selectCategory(categoryId: string): void {
  activeCategory.value = categoryId
}

function addCustomApp(): void {
  searchQuery.value = ''
  activeCategory.value = 'all'
  apps.value = [
    { id: `custom-${Date.now()}`, name: '自定义流程', desc: '用于补齐团队内部审批和自动化入口', category: 'operations', icon: AppWindow, accent: 'text-primary' },
    ...apps.value,
  ]
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 bg-background text-foreground">
    <WorkspaceResizablePane
      as="nav"
      pane-test-id="workplace-sidebar"
      content-test-id="workplace-sidebar-content"
      handle-test-id="workplace-sidebar-resize-handle"
      content-class="flex h-full min-h-0 flex-col overflow-hidden px-2 py-6"
      :width-storage-key="WORKPLACE_WIDTH_STORAGE_KEY"
      :default-width="DEFAULT_WORKPLACE_WIDTH"
      :min-width="MIN_WORKPLACE_WIDTH"
      :max-width="MAX_WORKPLACE_WIDTH"
      :resize-label="resizeLabel"
    >
      <div class="mb-6 px-3">
        <h1 class="text-[18px] font-semibold leading-6 text-foreground">
          {{ t('sidebar.workplace') }}
        </h1>
        <p class="mt-1 text-[13px] leading-[18px] text-muted-foreground">
          应用与流程中心
        </p>
      </div>

      <div class="flex flex-col gap-1">
        <button
          v-for="category in categories"
          :key="category.id"
          :data-testid="`workplace-category-${category.id}`"
          class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
          :class="activeCategory === category.id ? 'workspace-row-active' : ''"
          @click="selectCategory(category.id)"
        >
          <component :is="category.icon" :size="18" />
          <span class="truncate text-[13px] font-semibold">{{ category.label }}</span>
        </button>
      </div>

      <div class="mt-auto px-2 pb-1">
        <button
          data-testid="workplace-add-app"
          class="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-accent px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
          @click="addCustomApp"
        >
          <Plus :size="16" />
          <span>添加应用</span>
        </button>
      </div>
    </WorkspaceResizablePane>

    <section class="flex min-w-0 flex-1 flex-col bg-background">
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4">
        <label class="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border bg-input px-3 text-muted-foreground focus-within:border-primary">
          <Search :size="18" />
          <input
            v-model="searchQuery"
            data-testid="workplace-search-input"
            type="text"
            placeholder="搜索应用、文档或成员..."
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          >
        </label>
        <div class="ml-4 flex items-center gap-3">
          <span class="hidden text-[13px] font-semibold text-foreground md:inline">Muon 工作区</span>
          <div class="hidden h-6 w-px bg-border md:block" />
          <button
            class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="视频会议"
            @click="quickAction = '视频会议准备中'"
          >
            <Video :size="18" />
          </button>
          <button
            class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="更多"
            @click="quickAction = '已打开快捷操作'"
          >
            <MoreHorizontal :size="18" />
          </button>
        </div>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto grid w-full max-w-[1180px] gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section class="flex min-w-0 flex-col gap-5">
            <div class="grid gap-3 md:grid-cols-3">
              <div class="workspace-surface rounded-lg p-4">
                <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                  已启用应用
                </div>
                <div class="mt-3 text-2xl font-semibold leading-8">
                  24
                </div>
                <p class="mt-1 text-[13px] text-muted-foreground">
                  今日使用 6 个
                </p>
              </div>
              <div class="workspace-surface rounded-lg p-4">
                <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                  待办事项
                </div>
                <div class="mt-3 text-2xl font-semibold leading-8">
                  17
                </div>
                <p class="mt-1 text-[13px] text-muted-foreground">
                  4 项周五前到期
                </p>
              </div>
              <div class="workspace-surface rounded-lg p-4">
                <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                  会议安排
                </div>
                <div class="mt-3 text-2xl font-semibold leading-8">
                  5
                </div>
                <p class="mt-1 text-[13px] text-muted-foreground">
                  已保护 2 段专注时间
                </p>
              </div>
            </div>

            <div>
              <div class="mb-3 flex items-center justify-between">
                <h2 class="text-[15px] font-semibold">
                  推荐应用
                </h2>
                <button class="text-[12px] font-semibold text-primary">
                  管理
                </button>
              </div>
              <p class="mb-3 text-[12px] text-muted-foreground">
                当前分类：{{ categories.find(category => category.id === activeCategory)?.label }} · {{ quickAction }}
              </p>
              <div class="grid gap-3 md:grid-cols-2">
                <button
                  v-for="app in filteredApps"
                  :key="app.id"
                  class="workspace-surface flex items-start gap-3 rounded-lg p-4 text-left transition-colors hover:bg-accent"
                >
                  <span class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted" :class="app.accent">
                    <component :is="app.icon" :size="20" />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-[14px] font-semibold">{{ app.name }}</span>
                    <span class="mt-1 block text-[12px] leading-[18px] text-muted-foreground">{{ app.desc }}</span>
                  </span>
                </button>
              </div>
            </div>
          </section>

          <aside class="workspace-surface h-fit rounded-lg">
            <div class="flex h-11 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">
                今日重点
              </h2>
              <span class="text-[12px] text-muted-foreground">3 项优先事项</span>
            </div>
            <div class="divide-y divide-border">
              <button
                v-for="item in workItems"
                :key="item.id"
                class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[13px] font-semibold">{{ item.title }}</span>
                  <span class="mt-1 block text-[12px] text-muted-foreground">{{ item.owner }} - {{ item.time }}</span>
                </span>
                <span class="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  {{ item.status }}
                </span>
              </button>
            </div>
          </aside>
        </div>
      </main>
    </section>
  </div>
</template>
