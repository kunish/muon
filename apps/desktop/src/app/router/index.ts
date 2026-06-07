import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { createRouter, createWebHistory } from 'vue-router'
import { readMatrixSessionFromStore } from '@/matrix/auth'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@features/auth/components/LoginPage.vue'),
    },
    {
      path: '/',
      component: () => import('@/app/components/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        // Default: redirect to DM view
        { path: '', redirect: '/dm' },

        // Server/channel routes
        {
          path: 'server/:serverId/channel/:channelId',
          name: 'channel',
          component: () => import('@features/chat/components/ChatPage.vue'),
        },

        // DM routes
        {
          path: 'dm',
          name: 'dm-list',
          component: () => import('@features/chat/components/ChatPage.vue'),
        },
        {
          path: 'dm/:roomId',
          name: 'dm',
          component: () => import('@features/chat/components/ChatPage.vue'),
        },

        {
          path: 'contacts',
          name: 'contacts',
          component: () => import('@features/contacts/components/ContactsPage.vue'),
        },
        {
          path: 'organization',
          name: 'organization',
          component: () => import('@features/organization/components/OrganizationPage.vue'),
        },
        {
          path: 'organization/:section(members|groups)',
          name: 'organization-section',
          component: () => import('@features/organization/components/OrganizationPage.vue'),
        },
        {
          path: 'announcements',
          name: 'announcements',
          component: () => import('@features/announcements/components/AnnouncementsPage.vue'),
        },
        {
          path: 'calendar',
          name: 'calendar',
          component: () => import('@features/calendar/components/CalendarPage.vue'),
        },
        {
          path: 'docs',
          name: 'docs',
          component: () => import('@features/docs/components/DocsPage.vue'),
        },
        {
          path: 'bitable',
          name: 'bitable',
          component: () => import('@features/bitable/components/BitablePage.vue'),
        },
        {
          path: 'mindmap',
          name: 'mindmap',
          component: () => import('@features/mindmap/components/MindmapPage.vue'),
        },
        {
          path: 'docs/:docId',
          name: 'doc-editor',
          component: () => import('@features/docs/components/DocsPage.vue'),
        },
        {
          path: 'workplace',
          name: 'workplace',
          component: () => import('@features/workplace/components/WorkplacePage.vue'),
        },
        {
          path: 'approvals',
          name: 'approvals',
          component: () => import('@features/approvals/components/ApprovalsPage.vue'),
        },
        {
          path: 'survey',
          name: 'survey',
          component: () => import('@features/survey/components/SurveyPage.vue'),
        },
        {
          path: 'reports',
          name: 'reports',
          component: () => import('@features/reports/components/ReportsPage.vue'),
        },
        {
          path: 'email',
          name: 'email',
          component: () => import('@features/email/components/EmailPage.vue'),
        },
        {
          path: 'calls',
          name: 'calls',
          component: () => import('@features/calls/components/CallsPage.vue'),
        },
        {
          path: 'minutes',
          name: 'minutes',
          component: () => import('@features/minutes/components/MinutesPage.vue'),
        },
        {
          path: 'rooms',
          name: 'rooms',
          component: () => import('@features/rooms/components/RoomsPage.vue'),
        },
        {
          path: 'okr',
          name: 'okr',
          component: () => import('@features/okr/components/OkrPage.vue'),
        },
        {
          path: 'attendance',
          name: 'attendance',
          component: () => import('@features/attendance/components/AttendancePage.vue'),
        },
        {
          path: 'tasks',
          name: 'tasks',
          component: () => import('@features/tasks/components/TasksPage.vue'),
        },
        {
          path: 'projects',
          name: 'projects',
          component: () => import('@features/projects/ProjectsPage.vue'),
        },
        {
          path: 'projects/:projectId',
          name: 'project-detail',
          component: () => import('@features/projects/ProjectsPage.vue'),
        },
        {
          path: 'projects/:projectId/settings',
          name: 'project-settings',
          component: () => import('@features/projects/ProjectsPage.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@features/settings/components/SettingsPage.vue'),
        },
      ],
    },
  ],
})

function isAuthenticatedEffect(): DesktopEffect<boolean> {
  return Effect.gen(function* () {
    const session = yield* fromPromise(() => readMatrixSessionFromStore())
    return session !== null
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))
}

function isAuthenticated(): Promise<boolean> {
  return runDesktopEffect(isAuthenticatedEffect())
}

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return undefined
  return isAuthenticated().then((authenticated) => (authenticated ? undefined : '/login'))
})

export default router
