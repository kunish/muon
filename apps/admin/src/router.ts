import type { Router, RouteRecordRaw, RouterHistory } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'
import { sessionStore } from '@/stores/sessionStore'

export type AdminSection = 'audit' | 'departments' | 'organizations' | 'users'
export type AdminRouteName = 'admin-audit' | 'admin-departments' | 'admin-organizations' | 'admin-users'

export const defaultAdminSection: AdminSection = 'organizations'

export const adminSections: Array<{
  id: AdminSection
  label: string
  routeName: AdminRouteName
}> = [
  { id: 'organizations', label: '组织管理', routeName: 'admin-organizations' },
  { id: 'users', label: '用户管理', routeName: 'admin-users' },
  { id: 'departments', label: '部门管理', routeName: 'admin-departments' },
  { id: 'audit', label: '审计日志', routeName: 'admin-audit' },
]

const adminSectionComponents: Record<AdminSection, () => Promise<unknown>> = {
  organizations: () => import('@/pages/OrganizationsPage.vue'),
  users: () => import('@/pages/UsersPage.vue'),
  departments: () => import('@/pages/DepartmentsPage.vue'),
  audit: () => import('@/pages/AuditPage.vue'),
}

export function isAdminSection(value: unknown): value is AdminSection {
  return adminSections.some((section) => section.id === value)
}

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/install',
    name: 'admin-install',
    component: () => import('@/pages/InstallPage.vue'),
    meta: { gate: 'install' },
  },
  {
    path: '/login',
    name: 'admin-login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { gate: 'login' },
  },
  {
    path: '/change-password',
    name: 'admin-change-password',
    component: () => import('@/pages/ChangePasswordPage.vue'),
    meta: { gate: 'change-password' },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppShell.vue'),
    children: [
      {
        path: '',
        redirect: { name: 'admin-organizations' },
      },
      ...adminSections.map((section) => ({
        path: section.id,
        name: section.routeName,
        component: adminSectionComponents[section.id],
        meta: { adminSection: section.id },
      })),
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'admin-organizations' },
  },
]

/** 守卫派生：当前路由属于哪种 gate（install/login/change-password），否则是受保护的 section。 */
function gateOf(meta: Record<string, unknown>): 'change-password' | 'install' | 'login' | null {
  const gate = meta.gate
  return gate === 'install' || gate === 'login' || gate === 'change-password' ? gate : null
}

/**
 * 鉴权守卫：依据 sessionStore 把请求导向正确的 gate 或放行到 section。
 * 优先级：未安装 → install；未登录 → login；需改密 → change-password；否则放行。
 * 反向重定向：已满足条件却停留在某个 gate 时，跳回组织页，避免卡在 gate。
 */
export function installAdminGuards(router: Router): void {
  router.beforeEach((to) => {
    const { installed, adminToken, mustChangePassword } = sessionStore.state
    const loggedIn = Boolean(adminToken)
    const gate = gateOf(to.meta)

    if (!installed) {
      return gate === 'install' ? true : { name: 'admin-install' }
    }
    if (!loggedIn) {
      return gate === 'login' ? true : { name: 'admin-login' }
    }
    if (mustChangePassword) {
      return gate === 'change-password' ? true : { name: 'admin-change-password' }
    }
    // 已安装、已登录、无需改密：gate 页面无需再访问，统一回组织页。
    return gate ? { name: 'admin-organizations' } : true
  })
}

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
  const router = createRouter({
    history,
    routes: adminRoutes,
  })
  installAdminGuards(router)
  return router
}
