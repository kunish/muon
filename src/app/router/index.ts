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
        { path: '', redirect: '/chat' },
        {
          path: 'chat/:roomId?',
          name: 'chat',
          component: () => import('@features/chat/components/ChatPage.vue'),
        },
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
