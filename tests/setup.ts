import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { server } from './mocks/server'

import './mocks/matrix'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  setActivePinia(createPinia())
})

const i18n = createI18n({
  locale: 'zh',
  legacy: false,
  messages: { zh: {}, en: {} },
})

config.global.plugins = [i18n]

vi.mock('@tauri-apps/api/tray', () => ({
  TrayIcon: { new: vi.fn() },
}))

vi.mock('@tauri-apps/api/menu', () => ({
  Menu: { new: vi.fn() },
  MenuItem: { new: vi.fn() },
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    show: vi.fn(),
    setFocus: vi.fn(),
    destroy: vi.fn(),
  })),
}))

vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: vi.fn(),
  isPermissionGranted: vi.fn().mockResolvedValue(true),
  requestPermission: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}))
