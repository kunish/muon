import type { Component } from 'vue'
import { MessageCircle, Settings, Users } from 'lucide-vue-next'

export type WorkspaceAppId = 'messages' | 'contacts' | 'settings'

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
  { id: 'settings', labelKey: 'sidebar.settings', path: '/settings', icon: Settings, match: path => matchesPrefix(path, '/settings') },
]

export function getWorkspaceAppForPath(path: string): WorkspaceApp {
  return workspaceApps.find(app => app.match(path)) ?? workspaceApps[0]
}
