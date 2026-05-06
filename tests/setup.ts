import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import en from '../src/locales/en.json'
import zh from '../src/locales/zh.json'
import { server } from './mocks/server'

import './mocks/matrix'

function createMemoryStorage(): Storage {
  const items = new Map<string, string>()

  return {
    get length() {
      return items.size
    },
    clear() {
      items.clear()
    },
    getItem(key: string) {
      return items.has(key) ? items.get(key)! : null
    },
    key(index: number) {
      return [...items.keys()][index] ?? null
    },
    removeItem(key: string) {
      items.delete(key)
    },
    setItem(key: string, value: string) {
      items.set(key, String(value))
    },
  }
}

function ensureLocalStorage(): void {
  if (
    typeof globalThis.localStorage?.getItem === 'function'
    && typeof globalThis.localStorage?.setItem === 'function'
    && typeof globalThis.localStorage?.clear === 'function'
  ) {
    return
  }

  const storage = createMemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  })

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    })
  }
}

ensureLocalStorage()

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  setActivePinia(createPinia())
})

const i18n = createI18n({
  locale: 'zh',
  fallbackLocale: 'en',
  legacy: false,
  messages: { zh, en },
})

config.global.plugins = [i18n]

vi.mock('@/electron/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    show: vi.fn(),
    setFocus: vi.fn(),
    hide: vi.fn(),
  })),
}))
