import type { RouteRecordRaw, RouterHistory } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'

export type AdminSection = 'audit' | 'organizations' | 'users'
export type AdminRouteName = 'admin-audit' | 'admin-organizations' | 'admin-users'

export const defaultAdminSection: AdminSection = 'organizations'

export const adminSections: Array<{
  id: AdminSection
  label: string
  routeName: AdminRouteName
}> = [
  { id: 'organizations', label: '组织管理', routeName: 'admin-organizations' },
  { id: 'users', label: '用户管理', routeName: 'admin-users' },
  { id: 'audit', label: '审计日志', routeName: 'admin-audit' },
]

const AdminRoutePlaceholder = {
  name: 'AdminRoutePlaceholder',
  render: () => null,
}

export function isAdminSection(value: unknown): value is AdminSection {
  return adminSections.some((section) => section.id === value)
}

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: 'admin-organizations' },
  },
  ...adminSections.map((section) => ({
    path: `/${section.id}`,
    name: section.routeName,
    component: AdminRoutePlaceholder,
    meta: { adminSection: section.id },
  })),
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'admin-organizations' },
  },
]

export function normalizeLegacyAdminHash() {
  if (typeof window === 'undefined') return

  const section = window.location.hash.replace(/^#/, '')
  if (!isAdminSection(section)) return

  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}#/${section}`,
  )
}

export function createAdminRouter(history: RouterHistory = createWebHashHistory()) {
  return createRouter({
    history,
    routes: adminRoutes,
  })
}
