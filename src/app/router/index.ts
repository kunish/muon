import { createRouter, createWebHistory } from 'vue-router'

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
          path: 'projects',
          name: 'projects',
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

function isAuthenticated(): boolean {
  try {
    const stored = localStorage.getItem('muon_auth')
    if (!stored)
      return false
    const data = JSON.parse(stored)
    return !!(data.accessToken && data.serverUrl && data.userId)
  }
  catch {
    return false
  }
}

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isAuthenticated())
    return '/login'
})

export default router
