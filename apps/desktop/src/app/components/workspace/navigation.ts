import type { Component } from 'vue'
import {
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  DoorOpen,
  FileBarChart,
  FileText,
  Fingerprint,
  FolderKanban,
  Grid3X3,
  ListTodo,
  ListTree,
  Mail,
  Megaphone,
  MessageCircle,
  NotebookPen,
  Phone,
  Settings,
  Table2,
  Target,
  Users,
} from 'lucide-vue-next'

export type WorkspaceAppId =
  | 'messages'
  | 'contacts'
  | 'organization'
  | 'announcements'
  | 'calendar'
  | 'docs'
  | 'bitable'
  | 'mindmap'
  | 'workplace'
  | 'approvals'
  | 'survey'
  | 'reports'
  | 'email'
  | 'calls'
  | 'minutes'
  | 'rooms'
  | 'okr'
  | 'tasks'
  | 'attendance'
  | 'projects'
  | 'settings'

export interface WorkspaceApp {
  id: WorkspaceAppId
  labelKey: string
  path: string
  match: (path: string) => boolean
  icon: Component
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

function matchesAnyPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => matchesPrefix(path, prefix))
}

// 飞书风格应用栏顺序：消息 → 日历 → 云文档 → 工作台 → 通讯录 → 视频会议 → 邮箱 → 审批 → OKR/项目
export const workspaceApps: WorkspaceApp[] = [
  {
    id: 'messages',
    labelKey: 'sidebar.messages',
    path: '/dm',
    icon: MessageCircle,
    match: (path) => path === '/' || matchesAnyPrefix(path, ['/dm', '/server']),
  },
  {
    id: 'calendar',
    labelKey: 'sidebar.calendar',
    path: '/calendar',
    icon: CalendarDays,
    match: (path) => matchesPrefix(path, '/calendar'),
  },
  {
    id: 'docs',
    labelKey: 'sidebar.docs',
    path: '/docs',
    icon: FileText,
    match: (path) => matchesPrefix(path, '/docs'),
  },
  {
    id: 'bitable',
    labelKey: 'sidebar.bitable',
    path: '/bitable',
    icon: Table2,
    match: (path) => matchesPrefix(path, '/bitable'),
  },
  {
    id: 'mindmap',
    labelKey: 'sidebar.mindmap',
    path: '/mindmap',
    icon: ListTree,
    match: (path) => matchesPrefix(path, '/mindmap'),
  },
  {
    id: 'workplace',
    labelKey: 'sidebar.workplace',
    path: '/workplace',
    icon: Grid3X3,
    match: (path) => matchesPrefix(path, '/workplace'),
  },
  {
    id: 'contacts',
    labelKey: 'sidebar.contacts',
    path: '/contacts',
    icon: Users,
    match: (path) => matchesPrefix(path, '/contacts'),
  },
  {
    id: 'organization',
    labelKey: 'sidebar.organization',
    path: '/organization',
    icon: Building2,
    match: (path) => matchesPrefix(path, '/organization'),
  },
  {
    id: 'announcements',
    labelKey: 'sidebar.announcements',
    path: '/announcements',
    icon: Megaphone,
    match: (path) => matchesPrefix(path, '/announcements'),
  },
  {
    id: 'calls',
    labelKey: 'sidebar.calls',
    path: '/calls',
    icon: Phone,
    match: (path) => matchesPrefix(path, '/calls'),
  },
  {
    id: 'minutes',
    labelKey: 'sidebar.minutes',
    path: '/minutes',
    icon: NotebookPen,
    match: (path) => matchesPrefix(path, '/minutes'),
  },
  {
    id: 'rooms',
    labelKey: 'sidebar.rooms',
    path: '/rooms',
    icon: DoorOpen,
    match: (path) => matchesPrefix(path, '/rooms'),
  },
  {
    id: 'email',
    labelKey: 'sidebar.email',
    path: '/email',
    icon: Mail,
    match: (path) => matchesPrefix(path, '/email'),
  },
  {
    id: 'approvals',
    labelKey: 'sidebar.approvals',
    path: '/approvals',
    icon: CheckSquare,
    match: (path) => matchesPrefix(path, '/approvals'),
  },
  {
    id: 'survey',
    labelKey: 'sidebar.survey',
    path: '/survey',
    icon: ClipboardList,
    match: (path) => matchesPrefix(path, '/survey'),
  },
  {
    id: 'reports',
    labelKey: 'sidebar.reports',
    path: '/reports',
    icon: FileBarChart,
    match: (path) => matchesPrefix(path, '/reports'),
  },
  {
    id: 'okr',
    labelKey: 'sidebar.okr',
    path: '/okr',
    icon: Target,
    match: (path) => matchesPrefix(path, '/okr'),
  },
  {
    id: 'tasks',
    labelKey: 'sidebar.tasks',
    path: '/tasks',
    icon: ListTodo,
    match: (path) => matchesPrefix(path, '/tasks'),
  },
  {
    id: 'attendance',
    labelKey: 'sidebar.attendance',
    path: '/attendance',
    icon: Fingerprint,
    match: (path) => matchesPrefix(path, '/attendance'),
  },
  {
    id: 'projects',
    labelKey: 'sidebar.projects',
    path: '/projects',
    icon: FolderKanban,
    match: (path) => matchesPrefix(path, '/projects'),
  },
  {
    id: 'settings',
    labelKey: 'sidebar.settings',
    path: '/settings',
    icon: Settings,
    match: (path) => matchesPrefix(path, '/settings'),
  },
]

export const primaryWorkspaceApps = workspaceApps.filter((app) => app.id !== 'settings')
export const footerWorkspaceApps = workspaceApps.filter((app) => app.id === 'settings')

export function getWorkspaceAppForPath(path: string): WorkspaceApp {
  return workspaceApps.find((app) => app.match(path)) ?? workspaceApps[0]
}
