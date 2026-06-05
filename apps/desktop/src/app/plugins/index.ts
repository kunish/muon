import type { App } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createAppQueryClient } from '@/shared/query/queryClient'
import router from '../router'
import { syncDesktopSettingsWithStore } from './desktopSettings'
import { i18n, syncI18nLocaleWithSettings } from './i18n'
import { pinia } from './pinia'

export function setupPlugins(app: App) {
  app.use(pinia)
  syncDesktopSettingsWithStore()
  syncI18nLocaleWithSettings()
  app.use(VueQueryPlugin, { queryClient: createAppQueryClient() })
  app.use(i18n)
  app.use(router)
}
