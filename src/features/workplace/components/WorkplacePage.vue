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
const resizeLabel = computed(() => t('sidebar.resize_workplace'))

const categories = [
  { id: 'all', label: 'All Apps', icon: Grid3X3 },
  { id: 'productivity', label: 'Productivity', icon: BriefcaseBusiness },
  { id: 'operations', label: 'HR & Operations', icon: UsersRound },
  { id: 'engineering', label: 'Engineering', icon: Code2 },
  { id: 'design', label: 'Design', icon: Brush },
]

const apps = [
  { id: 'calendar', name: 'Calendar', desc: 'Meetings, focus time, and team schedules', icon: CalendarClock, accent: 'text-warning' },
  { id: 'meet', name: 'Meet', desc: 'Start encrypted team calls in one click', icon: Video, accent: 'text-primary' },
  { id: 'tasks', name: 'Task Center', desc: 'Personal and shared execution board', icon: AppWindow, accent: 'text-secondary' },
  { id: 'standup', name: 'Standup Bot', desc: 'Async updates for engineering teams', icon: MessageSquare, accent: 'text-success' },
]

const workItems = [
  { id: 'item-1', title: 'Dashboard IA review', owner: 'Design Team', time: '10:30', status: 'In review' },
  { id: 'item-2', title: 'Release readiness sync', owner: 'Engineering', time: '13:00', status: 'Today' },
  { id: 'item-3', title: 'Security docs approval', owner: 'Operations', time: '15:45', status: 'Blocked' },
]
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
          Workplace
        </h1>
        <p class="mt-1 text-[13px] leading-[18px] text-muted-foreground">
          App Directory
        </p>
      </div>

      <div class="flex flex-col gap-1">
        <button
          v-for="category in categories"
          :key="category.id"
          class="workspace-row gap-3 px-3 py-2 text-left text-muted-foreground"
          :class="activeCategory === category.id ? 'workspace-row-active' : ''"
          @click="activeCategory = category.id"
        >
          <component :is="category.icon" :size="18" />
          <span class="truncate text-[13px] font-semibold">{{ category.label }}</span>
        </button>
      </div>

      <div class="mt-auto px-2 pb-1">
        <button class="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-accent px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted">
          <Plus :size="16" />
          <span>Add App</span>
        </button>
      </div>
    </WorkspaceResizablePane>

    <section class="flex min-w-0 flex-1 flex-col bg-background">
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4">
        <label class="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border bg-input px-3 text-muted-foreground focus-within:border-primary">
          <Search :size="18" />
          <input
            type="text"
            placeholder="Search apps, docs, people..."
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          >
        </label>
        <div class="ml-4 flex items-center gap-3">
          <span class="hidden text-[13px] font-semibold text-foreground md:inline">Muon Workspace</span>
          <div class="hidden h-6 w-px bg-border md:block" />
          <button class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="Meet">
            <Video :size="18" />
          </button>
          <button class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="More">
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
                  Active apps
                </div>
                <div class="mt-3 text-2xl font-semibold leading-8">
                  24
                </div>
                <p class="mt-1 text-[13px] text-muted-foreground">
                  6 used today
                </p>
              </div>
              <div class="workspace-surface rounded-lg p-4">
                <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                  Open tasks
                </div>
                <div class="mt-3 text-2xl font-semibold leading-8">
                  17
                </div>
                <p class="mt-1 text-[13px] text-muted-foreground">
                  4 due before Friday
                </p>
              </div>
              <div class="workspace-surface rounded-lg p-4">
                <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                  Meetings
                </div>
                <div class="mt-3 text-2xl font-semibold leading-8">
                  5
                </div>
                <p class="mt-1 text-[13px] text-muted-foreground">
                  2 focus blocks protected
                </p>
              </div>
            </div>

            <div>
              <div class="mb-3 flex items-center justify-between">
                <h2 class="text-[15px] font-semibold">
                  Recommended apps
                </h2>
                <button class="text-[12px] font-semibold text-primary">
                  Manage
                </button>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <button
                  v-for="app in apps"
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
                Today
              </h2>
              <span class="text-[12px] text-muted-foreground">3 priorities</span>
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
