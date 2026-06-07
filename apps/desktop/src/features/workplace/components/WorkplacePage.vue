<script setup lang="ts">
import type { Component } from 'vue';
import { useSelector } from '@tanstack/vue-store';
import {
  AppWindow,
  BriefcaseBusiness,
  Brush,
  CalendarClock,
  ClipboardList,
  Code2,
  DoorOpen,
  FileBarChart,
  Fingerprint,
  Grid3X3,
  ListTree,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Search,
  Table2,
  UsersRound,
  Video,
} from 'lucide-vue-next';
import { computed, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue';
import { bitableStore, selectTables } from '@/features/bitable/stores/bitableStore';
import { selectTasksByStatus, taskStore } from '@/features/chat/stores/taskStore';
import { minuteStore, selectMinutes } from '@/features/minutes/stores/minuteStore';
import { okrStore, selectObjectives } from '@/features/okr/stores/okrStore';
import { currentPeriod } from '@/features/okr/types/okr';
import { reportStore, selectReports } from '@/features/reports/stores/reportStore';
import { isSubmitted } from '@/features/reports/types/report';
import { roomStore, selectBookings } from '@/features/rooms/stores/roomStore';
import { todayKey } from '@/features/rooms/types/room';
import {
  addCustomApp as storeAddCustomApp,
  hideApp as storeHideApp,
  setOrder as storeSetOrder,
  updateCustomApp as storeUpdateCustomApp,
  workplaceStore,
} from '@/features/workplace/stores/workplaceStore';

const { t } = useI18n();
const router = useRouter();

const customApps = useSelector(workplaceStore, (s) => s.customApps);
const appOrder = useSelector(workplaceStore, (s) => s.appOrder);
const hiddenAppIds = useSelector(workplaceStore, (s) => s.hiddenAppIds);

// ── 数据概览：聚合各功能模块的真实 store（飞书工作台呈现的是真实跨应用数据，而非占位） ──
const taskGroups = useSelector(taskStore, selectTasksByStatus);
const okrObjectives = useSelector(okrStore, selectObjectives);
const bitableTables = useSelector(bitableStore, selectTables);
const minutesList = useSelector(minuteStore, selectMinutes);
const roomBookings = useSelector(roomStore, selectBookings);
const reportsList = useSelector(reportStore, selectReports);

const overviewStats = computed(() => {
  const today = todayKey(Date.now());
  const period = currentPeriod(Date.now());
  return [
    {
      id: 'tasks',
      label: '待办任务',
      value: taskGroups.value.todo.length + taskGroups.value.doing.length,
      path: '/tasks',
    },
    {
      id: 'okr',
      label: '本季 OKR',
      value: okrObjectives.value.filter((objective) => objective.period === period).length,
      path: '/okr',
    },
    { id: 'bitable', label: '多维表格', value: bitableTables.value.length, path: '/bitable' },
    { id: 'minutes', label: '会议纪要', value: minutesList.value.length, path: '/minutes' },
    {
      id: 'rooms',
      label: '今日预定',
      value: roomBookings.value.filter((booking) => booking.date === today).length,
      path: '/rooms',
    },
    {
      id: 'reports',
      label: '汇报草稿',
      value: reportsList.value.filter((report) => !isSubmitted(report)).length,
      path: '/reports',
    },
  ];
});

const WORKPLACE_WIDTH_STORAGE_KEY = 'muon_workplace_sidebar_width';
const DEFAULT_WORKPLACE_WIDTH = 240;
const MIN_WORKPLACE_WIDTH = 220;
const MAX_WORKPLACE_WIDTH = 360;

const activeCategory = shallowRef('all');
const searchQuery = shallowRef('');
const quickAction = shallowRef('工作台快捷操作已就绪');
const manageMode = shallowRef(false);
const selectedAppId = shallowRef('calendar');
const appEditorOpen = shallowRef(false);
const appDraftId = shallowRef('');
const appDraftName = shallowRef('自定义流程');
const appDraftDesc = shallowRef('连接团队审批、自动化和数据看板');
const baseFilter = shallowRef<'all' | 'risks'>('all');
const projectFilter = shallowRef<'all' | 'risks'>('all');
const projectStage = shallowRef('设计联调');
const okrProgress = shallowRef(68);
const okrConfidence = shallowRef<'中' | '高'>('中');
const okrLastUpdate = shallowRef('等待本周更新');
const resizeLabel = computed(() => t('sidebar.resize_workplace'));

interface WorkplaceAppEntry {
  id: string;
  name: string;
  desc: string;
  category: string;
  icon: Component;
  accent: string;
  moduleLabel: string;
  path: string;
  actionLabel: string;
}

const categories = [
  { id: 'all', label: '全部应用', icon: Grid3X3 },
  { id: 'productivity', label: '协作效率', icon: BriefcaseBusiness },
  { id: 'operations', label: '人事行政', icon: UsersRound },
  { id: 'engineering', label: '工程研发', icon: Code2 },
  { id: 'design', label: '设计协作', icon: Brush },
];

const builtInApps: WorkplaceAppEntry[] = [
  {
    id: 'calendar',
    name: '日历',
    desc: '团队日程、专注时间和会议安排',
    category: 'productivity',
    icon: CalendarClock,
    accent: 'text-warning',
    moduleLabel: '日历',
    path: '/calendar',
    actionLabel: '打开日历',
  },
  {
    id: 'meet',
    name: '视频会议',
    desc: '一键发起加密团队通话',
    category: 'productivity',
    icon: Video,
    accent: 'text-primary',
    moduleLabel: '通话',
    path: '/calls',
    actionLabel: '发起会议',
  },
  {
    id: 'base',
    name: '多维表格',
    desc: '结构化追踪业务风险、负责人和状态',
    category: 'operations',
    icon: Table2,
    accent: 'text-success',
    moduleLabel: '多维表格',
    path: '/bitable',
    actionLabel: '打开表格',
  },
  {
    id: 'project',
    name: '项目管理',
    desc: '跟进跨端项目里程碑、风险和负责人',
    category: 'productivity',
    icon: BriefcaseBusiness,
    accent: 'text-primary',
    moduleLabel: '工作台',
    path: '/workplace',
    actionLabel: '查看项目',
  },
  {
    id: 'okr',
    name: 'OKR',
    desc: '团队目标、关键结果和信心度 check-in',
    category: 'operations',
    icon: AppWindow,
    accent: 'text-warning',
    moduleLabel: 'OKR',
    path: '/okr',
    actionLabel: '查看 OKR',
  },
  {
    id: 'tasks',
    name: '任务中心',
    desc: '个人待办与团队执行看板',
    category: 'operations',
    icon: AppWindow,
    accent: 'text-secondary',
    moduleLabel: '任务',
    path: '/tasks',
    actionLabel: '查看待办',
  },
  {
    id: 'standup',
    name: '站会机器人',
    desc: '工程团队异步同步进展',
    category: 'engineering',
    icon: MessageSquare,
    accent: 'text-success',
    moduleLabel: '消息',
    path: '/dm',
    actionLabel: '进入消息',
  },
  {
    id: 'minutes',
    name: '妙记',
    desc: '会议纪要与行动项',
    category: 'productivity',
    icon: NotebookPen,
    accent: 'text-primary',
    moduleLabel: '妙记',
    path: '/minutes',
    actionLabel: '查看纪要',
  },
  {
    id: 'rooms',
    name: '会议室',
    desc: '预定会议室与查看排期',
    category: 'operations',
    icon: DoorOpen,
    accent: 'text-success',
    moduleLabel: '会议室',
    path: '/rooms',
    actionLabel: '预定会议室',
  },
  {
    id: 'survey',
    name: '问卷',
    desc: '收集反馈与统计结果',
    category: 'operations',
    icon: ClipboardList,
    accent: 'text-secondary',
    moduleLabel: '问卷',
    path: '/survey',
    actionLabel: '查看问卷',
  },
  {
    id: 'reports',
    name: '汇报',
    desc: '日报与周报',
    category: 'productivity',
    icon: FileBarChart,
    accent: 'text-primary',
    moduleLabel: '汇报',
    path: '/reports',
    actionLabel: '写汇报',
  },
  {
    id: 'attendance',
    name: '考勤',
    desc: '上下班打卡与统计',
    category: 'operations',
    icon: Fingerprint,
    accent: 'text-warning',
    moduleLabel: '考勤',
    path: '/attendance',
    actionLabel: '去打卡',
  },
  {
    id: 'announcements',
    name: '公告',
    desc: '组织通知与全员公告',
    category: 'operations',
    icon: Megaphone,
    accent: 'text-warning',
    moduleLabel: '公告',
    path: '/announcements',
    actionLabel: '看公告',
  },
  {
    id: 'mindmap',
    name: '思维笔记',
    desc: '层级化整理想法与大纲',
    category: 'productivity',
    icon: ListTree,
    accent: 'text-primary',
    moduleLabel: '思维笔记',
    path: '/mindmap',
    actionLabel: '打开笔记',
  },
];

// 自定义应用的默认外观/路由（图标等不可序列化部分由此补齐）
function customAppToEntry(app: { id: string; name: string; desc: string; category: string }): WorkplaceAppEntry {
  return {
    id: app.id,
    name: app.name,
    desc: app.desc,
    category: app.category,
    icon: AppWindow,
    accent: 'text-primary',
    moduleLabel: '工作台',
    path: '/workplace',
    actionLabel: '配置流程',
  };
}

// 展示用应用列表 = 自定义应用（置顶）+ 内置目录，按持久化的排序重排
const apps = computed<WorkplaceAppEntry[]>(() => {
  const combined = [...customApps.value.map(customAppToEntry), ...builtInApps];
  const order = appOrder.value;
  if (order.length === 0) return combined;

  const byId = new Map(combined.map((app) => [app.id, app]));
  const ordered: WorkplaceAppEntry[] = [];
  for (const id of order) {
    const app = byId.get(id);
    if (app) {
      ordered.push(app);
      byId.delete(id);
    }
  }
  // 排序保存之后新增的应用，保持默认顺序追加在末尾
  for (const app of combined) {
    if (byId.has(app.id)) ordered.push(app);
  }
  return ordered;
});

const workItems = [
  { id: 'item-1', title: '工作台信息架构评审', owner: '设计团队', time: '10:30', status: '评审中', appId: 'calendar' },
  { id: 'item-2', title: '发布准备同步', owner: '工程团队', time: '13:00', status: '今日', appId: 'meet' },
  { id: 'item-3', title: '安全文档审批', owner: '运营团队', time: '15:45', status: '受阻', appId: 'tasks' },
];

const baseRecords = shallowRef([
  { id: 'base-1', title: '权限回收', owner: '安全团队', status: '风险项' },
  { id: 'base-2', title: '上线检查', owner: '发布团队', status: '进行中' },
  { id: 'base-3', title: '体验走查', owner: '设计团队', status: '已完成' },
]);

const projectRecords = computed(() => [
  { id: 'project-1', title: '跨端体验对齐', owner: '客户端团队', stage: projectStage.value, status: '进行中' },
  { id: 'project-2', title: '权限模型补齐', owner: '安全团队', stage: '风险评审', status: '风险项' },
  { id: 'project-3', title: '通知中心改版', owner: '增长团队', stage: '灰度验证', status: '已完成' },
]);

const filteredApps = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return apps.value.filter((app) => {
    const matchesCategory = activeCategory.value === 'all' || app.category === activeCategory.value;
    const matchesQuery = !query || [app.name, app.desc].some((value) => value.toLowerCase().includes(query));
    const isVisible = !hiddenAppIds.value.includes(app.id);
    return isVisible && matchesCategory && matchesQuery;
  });
});

const selectedApp = computed(() => apps.value.find((app) => app.id === selectedAppId.value) ?? apps.value[0]);
const filteredBaseRecords = computed(() => {
  if (baseFilter.value === 'risks') return baseRecords.value.filter((record) => record.status === '风险项');
  return baseRecords.value;
});
const filteredProjectRecords = computed(() => {
  if (projectFilter.value === 'risks') return projectRecords.value.filter((record) => record.status === '风险项');
  return projectRecords.value;
});
const enabledAppsCount = computed(() => apps.value.filter((app) => !hiddenAppIds.value.includes(app.id)).length);
const todayUsedAppCount = computed(
  () => new Set(workItems.map((item) => item.appId).filter((appId) => !hiddenAppIds.value.includes(appId))).size,
);
const blockedWorkItemCount = computed(() => workItems.filter((item) => item.status === '受阻').length);
const calendarWorkItemCount = computed(() => workItems.filter((item) => item.appId === 'calendar').length);
const meetingWorkItemCount = computed(() => workItems.filter((item) => item.appId === 'meet').length);
const meetingScheduleCount = computed(() => calendarWorkItemCount.value + meetingWorkItemCount.value);

function selectCategory(categoryId: string): void {
  activeCategory.value = categoryId;
}

function addCustomApp(): void {
  const appId = `custom-${Date.now()}`;
  appEditorOpen.value = true;
  appDraftId.value = appId;
  appDraftName.value = '自定义流程';
  appDraftDesc.value = '连接团队审批、自动化和数据看板';
  searchQuery.value = '';
  activeCategory.value = 'all';
  storeAddCustomApp({
    id: appId,
    name: '自定义流程',
    desc: '连接团队审批、自动化和数据看板',
    category: 'operations',
  });
  selectedAppId.value = appId;
  quickAction.value = '已添加：自定义流程';
}

function saveDraftApp(): void {
  if (!appEditorOpen.value) return;

  const appId = appDraftId.value;
  const name = appDraftName.value.trim() || '自定义流程';
  const desc = appDraftDesc.value.trim() || '连接团队审批、自动化和数据看板';

  storeUpdateCustomApp(appId, { name, desc });
  selectedAppId.value = appId;
  quickAction.value = `已添加：${name}`;
  appEditorOpen.value = false;
}

function openApp(app: WorkplaceAppEntry): void {
  selectedAppId.value = app.id;
  quickAction.value = `已打开：${app.name}`;
  if (app.path) router.push(app.path);
}

function openWorkItem(item: { title: string; appId: string }): void {
  selectedAppId.value = item.appId;
  quickAction.value = `已打开重点：${item.title}`;
  const app = apps.value.find((entry) => entry.id === item.appId);
  if (app?.path) router.push(app.path);
}

function showBaseRisks(): void {
  baseFilter.value = 'risks';
}

function addBaseRecord(): void {
  const record = { id: `base-${Date.now()}`, title: '新建业务记录', owner: '我', status: '风险项' };
  baseRecords.value = [record, ...baseRecords.value];
  baseFilter.value = 'risks';
}

function showProjectRisks(): void {
  projectFilter.value = 'risks';
}

function advanceProject(): void {
  projectStage.value = '联调验收';
  quickAction.value = '已推进：跨端体验对齐';
}

function checkInOkr(): void {
  okrProgress.value = 76;
  okrConfidence.value = '高';
  okrLastUpdate.value = 'OKR 已更新：提升桌面端协作效率';
  quickAction.value = okrLastUpdate.value;
}

function launchSelectedApp(): void {
  const app = selectedApp.value;
  if (!app) return;
  quickAction.value = `正在打开：${app.name}`;
  router.push(app.path);
}

function launchMeetingShortcut(): void {
  const app = apps.value.find((item) => item.id === 'meet');
  if (!app) return;
  selectedAppId.value = app.id;
  quickAction.value = `正在打开：${app.name}`;
  router.push(app.path);
}

function toggleManageMode(): void {
  manageMode.value = !manageMode.value;
  quickAction.value = manageMode.value ? '应用管理已开启' : '应用管理已关闭';
}

function moveAppDown(appId: string): void {
  const orderedIds = apps.value.map((app) => app.id);
  const currentIndex = orderedIds.indexOf(appId);
  if (currentIndex < 0 || currentIndex >= orderedIds.length - 1) return;

  const app = apps.value[currentIndex];
  const [id] = orderedIds.splice(currentIndex, 1);
  orderedIds.splice(currentIndex + 1, 0, id);
  storeSetOrder(orderedIds);
  quickAction.value = `已下移：${app.name}`;
}

function hideAppEntry(appId: string): void {
  const app = apps.value.find((item) => item.id === appId);
  if (!app) return;

  storeHideApp(appId);
  if (selectedAppId.value === appId) selectedAppId.value = filteredApps.value[0]?.id ?? apps.value[0]?.id ?? '';
  quickAction.value = `已隐藏：${app.name}`;
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
        <p class="mt-1 text-[13px] leading-[18px] text-muted-foreground">应用与流程中心</p>
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
        <label
          class="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border bg-input px-3 text-muted-foreground focus-within:border-primary"
        >
          <Search :size="18" />
          <input
            v-model="searchQuery"
            data-testid="workplace-search-input"
            type="text"
            placeholder="搜索应用、文档或成员..."
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div class="ml-4 flex items-center gap-3">
          <span class="hidden text-[13px] font-semibold text-foreground md:inline">Muon 工作区</span>
          <div class="hidden h-6 w-px bg-border md:block" />
          <button
            data-testid="workplace-meeting-shortcut"
            class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="视频会议"
            @click="launchMeetingShortcut"
          >
            <Video :size="18" />
          </button>
          <button
            data-testid="workplace-more-shortcut"
            class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="更多"
            @click="toggleManageMode"
          >
            <MoreHorizontal :size="18" />
          </button>
        </div>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto grid w-full max-w-[1180px] gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section class="flex min-w-0 flex-col gap-5">
            <div data-testid="workplace-overview">
              <h2 class="mb-3 text-[15px] font-semibold">数据概览</h2>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <button
                  v-for="stat in overviewStats"
                  :key="stat.id"
                  type="button"
                  class="workspace-surface flex flex-col items-start rounded-lg p-3 text-left transition hover:border-primary/40"
                  :data-testid="`workplace-overview-${stat.id}`"
                  @click="router.push(stat.path)"
                >
                  <span class="text-[12px] text-muted-foreground">{{ stat.label }}</span>
                  <span class="mt-1 text-[20px] font-semibold leading-7 text-foreground">{{ stat.value }}</span>
                </button>
              </div>
            </div>

            <div class="grid gap-3 md:grid-cols-3">
              <div class="workspace-surface rounded-lg p-4">
                <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                  已启用应用
                </div>
                <div class="mt-3 text-2xl font-semibold leading-8" data-testid="workplace-stat-enabled-apps">
                  {{ enabledAppsCount }}
                </div>
                <p class="mt-1 text-[13px] text-muted-foreground" data-testid="workplace-stat-used-apps">
                  今日使用 {{ todayUsedAppCount }} 个
                </p>
              </div>
              <div class="workspace-surface rounded-lg p-4">
                <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                  待办事项
                </div>
                <div class="mt-3 text-2xl font-semibold leading-8" data-testid="workplace-stat-priority-items">
                  {{ workItems.length }}
                </div>
                <p class="mt-1 text-[13px] text-muted-foreground" data-testid="workplace-stat-blocked-items">
                  {{ blockedWorkItemCount }} 项需跟进
                </p>
              </div>
              <div class="workspace-surface rounded-lg p-4">
                <div class="text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
                  会议安排
                </div>
                <div class="mt-3 text-2xl font-semibold leading-8" data-testid="workplace-stat-meetings">
                  {{ meetingScheduleCount }}
                </div>
                <p class="mt-1 text-[13px] text-muted-foreground" data-testid="workplace-stat-meeting-breakdown">
                  日程 {{ calendarWorkItemCount }} 个 · 通话 {{ meetingWorkItemCount }} 个
                </p>
              </div>
            </div>

            <div>
              <div class="mb-3 flex items-center justify-between">
                <h2 class="text-[15px] font-semibold">推荐应用</h2>
                <button
                  data-testid="workplace-manage-apps"
                  class="text-[12px] font-semibold text-primary"
                  @click="toggleManageMode"
                >
                  管理
                </button>
              </div>
              <p class="mb-3 text-[12px] text-muted-foreground">
                当前分类：{{ categories.find((category) => category.id === activeCategory)?.label }} · {{ quickAction }}
                <span v-if="manageMode"> · 可管理应用排序与入口</span>
              </p>
              <div
                v-if="appEditorOpen"
                class="mb-3 grid gap-2 rounded-lg border border-border bg-background p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <input
                  v-model="appDraftName"
                  data-testid="workplace-new-app-name"
                  type="text"
                  placeholder="应用名称"
                  class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
                />
                <input
                  v-model="appDraftDesc"
                  data-testid="workplace-new-app-desc"
                  type="text"
                  placeholder="应用描述"
                  class="h-8 rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary"
                />
                <button
                  data-testid="workplace-save-new-app"
                  class="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  @click="saveDraftApp"
                >
                  保存应用
                </button>
              </div>
              <div v-if="manageMode" class="mb-3 grid gap-2 md:grid-cols-2">
                <div
                  v-for="app in filteredApps"
                  :key="app.id"
                  class="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1"
                >
                  <span class="min-w-0 truncate text-[12px] font-semibold text-foreground">{{ app.name }}</span>
                  <span class="flex shrink-0 gap-1">
                    <button
                      :data-testid="`workplace-move-down-${app.id}`"
                      class="h-7 rounded-md border border-border px-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
                      @click="moveAppDown(app.id)"
                    >
                      下移
                    </button>
                    <button
                      :data-testid="`workplace-hide-${app.id}`"
                      class="h-7 rounded-md border border-border px-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
                      @click="hideAppEntry(app.id)"
                    >
                      隐藏
                    </button>
                  </span>
                </div>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <button
                  v-for="app in filteredApps"
                  :key="app.id"
                  :data-testid="`workplace-app-${app.id}`"
                  class="workspace-surface flex items-start gap-3 rounded-lg p-4 text-left transition-colors hover:bg-accent"
                  @click="openApp(app)"
                >
                  <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted"
                    :class="app.accent"
                  >
                    <component :is="app.icon" :size="20" />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-[14px] font-semibold">{{ app.name }}</span>
                    <span class="mt-1 block text-[12px] leading-[18px] text-muted-foreground">{{ app.desc }}</span>
                  </span>
                </button>
              </div>
              <div
                v-if="filteredApps.length === 0"
                class="px-4 py-12 text-center text-[13px] text-muted-foreground"
                data-testid="workplace-apps-empty"
              >
                {{ t('workplace.no_apps') }}
              </div>
            </div>
          </section>

          <aside class="workspace-surface h-fit overflow-hidden rounded-lg">
            <div class="flex h-11 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">应用详情：{{ selectedApp.name }}</h2>
              <span class="text-[12px] text-muted-foreground">关联模块：{{ selectedApp.moduleLabel }}</span>
            </div>
            <div class="border-b border-border p-4">
              <div class="flex items-start gap-3">
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted"
                  :class="selectedApp.accent"
                >
                  <component :is="selectedApp.icon" :size="20" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-[13px] font-semibold">{{ selectedApp.name }}</span>
                  <span class="mt-1 block text-[12px] leading-[18px] text-muted-foreground">{{
                    selectedApp.desc
                  }}</span>
                </span>
              </div>
              <button
                data-testid="workplace-open-selected-app"
                class="mt-4 flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                @click="launchSelectedApp"
              >
                {{ selectedApp.actionLabel }}
              </button>
              <div v-if="selectedApp.id === 'base'" class="mt-4 rounded-lg border border-border">
                <div class="flex items-center justify-between border-b border-border px-3 py-2">
                  <span class="text-[13px] font-semibold">业务表：上线风险表</span>
                  <span class="text-[11px] text-muted-foreground">
                    当前表格：{{ baseFilter === 'risks' ? '仅风险项' : '全部记录' }}
                  </span>
                </div>
                <div class="flex gap-2 border-b border-border p-3">
                  <button
                    data-testid="workplace-base-filter-risks"
                    class="h-8 rounded-md border border-border px-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
                    @click="showBaseRisks"
                  >
                    只看风险
                  </button>
                  <button
                    data-testid="workplace-base-add-record"
                    class="h-8 rounded-md bg-primary px-2 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    @click="addBaseRecord"
                  >
                    新增记录
                  </button>
                </div>
                <div class="divide-y divide-border">
                  <div v-for="record in filteredBaseRecords" :key="record.id" class="grid gap-1 px-3 py-2 text-[12px]">
                    <span class="font-semibold text-foreground">{{ record.title }}</span>
                    <span class="text-muted-foreground">{{ record.owner }} · {{ record.status }}</span>
                  </div>
                </div>
              </div>
              <div v-if="selectedApp.id === 'project'" class="mt-4 rounded-lg border border-border">
                <div class="flex items-center justify-between border-b border-border px-3 py-2">
                  <span class="text-[13px] font-semibold">项目看板：跨端体验对齐</span>
                  <span class="text-[11px] text-muted-foreground">
                    当前项目：{{ projectFilter === 'risks' ? '仅风险项目' : '全部项目' }}
                  </span>
                </div>
                <div class="flex gap-2 border-b border-border p-3">
                  <button
                    data-testid="workplace-project-filter-risks"
                    class="h-8 rounded-md border border-border px-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent"
                    @click="showProjectRisks"
                  >
                    只看风险
                  </button>
                  <button
                    data-testid="workplace-project-advance"
                    class="h-8 rounded-md bg-primary px-2 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    @click="advanceProject"
                  >
                    推进阶段
                  </button>
                </div>
                <div class="border-b border-border px-3 py-2 text-[12px] text-muted-foreground">
                  当前阶段：{{ projectStage }}
                </div>
                <div class="divide-y divide-border">
                  <div
                    v-for="record in filteredProjectRecords"
                    :key="record.id"
                    class="grid gap-1 px-3 py-2 text-[12px]"
                  >
                    <span class="font-semibold text-foreground">{{ record.title }}</span>
                    <span class="text-muted-foreground"
                      >{{ record.owner }} · {{ record.stage }} · {{ record.status }}</span
                    >
                  </div>
                </div>
              </div>
              <div v-if="selectedApp.id === 'okr'" class="mt-4 rounded-lg border border-border">
                <div class="flex items-center justify-between border-b border-border px-3 py-2">
                  <span class="text-[13px] font-semibold">OKR：团队目标</span>
                  <span class="text-[11px] text-muted-foreground">进度：{{ okrProgress }}%</span>
                </div>
                <div class="grid gap-2 border-b border-border p-3 text-[12px]">
                  <span class="font-semibold text-foreground">提升桌面端协作效率</span>
                  <span class="text-muted-foreground">关键结果：二级页面核心操作覆盖率达到 80%</span>
                  <span class="text-muted-foreground">信心指数：{{ okrConfidence }}</span>
                  <span class="text-muted-foreground">{{ okrLastUpdate }}</span>
                </div>
                <div class="p-3">
                  <button
                    data-testid="workplace-okr-checkin"
                    class="h-8 w-full rounded-md bg-primary px-2 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    @click="checkInOkr"
                  >
                    提交本周进展
                  </button>
                </div>
              </div>
            </div>

            <div class="flex h-11 items-center justify-between border-b border-border px-4">
              <h2 class="text-[15px] font-semibold">今日重点</h2>
              <span class="text-[12px] text-muted-foreground">3 项优先事项</span>
            </div>
            <div class="divide-y divide-border">
              <button
                v-for="item in workItems"
                :key="item.id"
                :data-testid="`workplace-priority-${item.id}`"
                class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                @click="openWorkItem(item)"
              >
                <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[13px] font-semibold">{{ item.title }}</span>
                  <span class="mt-1 block text-[12px] text-muted-foreground">{{ item.owner }} - {{ item.time }}</span>
                </span>
                <span
                  class="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground"
                >
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
