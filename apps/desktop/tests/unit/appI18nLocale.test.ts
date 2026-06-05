import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

describe('app i18n locale', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('initializes from the persisted settings locale', async () => {
    localStorage.setItem('muon_locale', JSON.stringify('en'))

    const { i18n } = await import('@/app/plugins/i18n')

    expect(i18n.global.locale.value).toBe('en')
  })

  it('syncs runtime settings locale changes to vue-i18n', async () => {
    const { i18n, syncI18nLocaleWithSettings } = await import('@/app/plugins/i18n')
    const { setLocale } = await import('@/features/settings/stores/settingsStore')
    const stopSync = syncI18nLocaleWithSettings()

    setLocale('en')
    await nextTick()

    expect(i18n.global.locale.value).toBe('en')
    stopSync()
  })
})
