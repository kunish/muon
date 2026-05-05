import type { Component } from 'vue'
import { Building2, CalendarDays, CheckSquare, FileText, FolderKanban, Grid3X3, Mail, MessageCircle, Phone, Settings, Users } from 'lucide-vue-next'

export type WorkspaceAppId = 'messages' | 'contacts' | 'organization' | 'calendar' | 'docs' | 'workplace' | 'approvals' | 'email' | 'calls' | 'projects' | 'settings'

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
  return prefixes.some(prefix => matchesPrefix(path, prefix))
}

export const workspaceApps: WorkspaceApp[] = [
  { id: 'messages', labelKey: 'sidebar.messages', path: '/dm', icon: MessageCircle, match: path => path === '/' || matchesAnyPrefix(path, ['/dm', '/server']) },
  { id: 'contacts', labelKey: 'sidebar.contacts', path: '/contacts', icon: Users, match: path => matchesPrefix(path, '/contacts') },
  { id: 'organization', labelKey: 'sidebar.organization', path: '/organization', icon: Building2, match: path => matchesPrefix(path, '/organization') },
  { id: 'calendar', labelKey: 'sidebar.calendar', path: '/calendar', icon: CalendarDays, match: path => matchesPrefix(path, '/calendar') },
  { id: 'docs', labelKey: 'sidebar.docs', path: '/docs', icon: FileText, match: path => matchesPrefix(path, '/docs') },
  { id: 'workplace', labelKey: 'sidebar.workplace', path: '/workplace', icon: Grid3X3, match: path => matchesPrefix(path, '/workplace') },
  { id: 'approvals', labelKey: 'sidebar.approvals', path: '/approvals', icon: CheckSquare, match: path => matchesPrefix(path, '/approvals') },
  { id: 'email', labelKey: 'sidebar.email', path: '/email', icon: Mail, match: path => matchesPrefix(path, '/email') },
  { id: 'calls', labelKey: 'sidebar.calls', path: '/calls', icon: Phone, match: path => matchesPrefix(path, '/calls') },
  { id: 'projects', labelKey: 'sidebar.projects', path: '/projects', icon: FolderKanban, match: path => matchesPrefix(path, '/projects') },
  { id: 'settings', labelKey: 'sidebar.settings', path: '/settings', icon: Settings, match: path => matchesPrefix(path, '/settings') },
]

export const primaryWorkspaceApps = workspaceApps.filter(app => app.id !== 'settings')
export const footerWorkspaceApps = workspaceApps.filter(app => app.id === 'settings')

export function getWorkspaceAppForPath(path: string): WorkspaceApp {
  return workspaceApps.find(app => app.match(path)) ?? workspaceApps[0]
}
