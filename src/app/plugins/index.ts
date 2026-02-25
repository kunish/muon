import type { App } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import zh from '@/locales/zh.json'
import router from '../router'

export function setupPlugins(app: App) {
  app.use(createPinia())
  app.use(VueQueryPlugin)
  app.use(createI18n({
    legacy: false,
    locale: 'zh',
    fallbackLocale: 'en',
    messages: { zh, en },
  }))
  app.use(router)
}
