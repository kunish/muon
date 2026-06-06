import type { App } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { config } from '@vue/test-utils'
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
    typeof globalThis.localStorage?.getItem === 'function' &&
    typeof globalThis.localStorage?.setItem === 'function' &&
    typeof globalThis.localStorage?.clear === 'function'
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

// A fresh QueryClient per test keeps the vue-query cache isolated (no cross-test
// leakage), mirroring how the real app installs one client at startup.
let testQueryClient: QueryClient

beforeEach(() => {
  testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
})

const i18n = createI18n({
  locale: 'zh',
  fallbackLocale: 'en',
  legacy: false,
  messages: { zh, en },
})

// Install vue-query on every mounted component so composables that call useQuery
// (e.g. the contacts facade) work without per-test plugin wiring. Tests that need
// to assert on cache contents still install their own client via mount options,
// which is applied after this global one and therefore wins.
const globalVueQueryPlugin = {
  install(app: App) {
    VueQueryPlugin.install?.(app, { queryClient: testQueryClient })
  },
}

config.global.plugins = [i18n, globalVueQueryPlugin]

vi.mock('@/desktop/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    show: vi.fn(),
    setFocus: vi.fn(),
    hide: vi.fn(),
  })),
}))
