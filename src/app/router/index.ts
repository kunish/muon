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
      component: () => import('@shared/components/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        // Default: redirect to DM view
        { path: '', redirect: '/dm' },

        // Discord-style server/channel routes
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

        // Legacy route redirect
        {
          path: 'chat/:roomId?',
          redirect: (to) => {
            const roomId = to.params.roomId as string
            if (roomId)
              return `/dm/${roomId}`
            return '/dm'
          },
        },

        // Feature pages (accessible from user settings or special navigation)
        {
          path: 'contacts',
          name: 'contacts',
          component: () => import('@features/contacts/components/ContactsPage.vue'),
        },
        {
          path: 'calls',
          name: 'calls',
          component: () => import('@features/calls/components/CallsPage.vue'),
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
          path: 'settings',
          name: 'settings',
          component: () => import('@features/settings/components/SettingsPage.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const hasToken = !!localStorage.getItem('muon_auth')
  if (to.meta.requiresAuth && !hasToken)
    return '/login'
})

export default router
