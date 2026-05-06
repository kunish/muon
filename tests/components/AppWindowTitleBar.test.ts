import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import App from '@/app/App.vue'

const routerReplace = vi.fn()
const matrixMocks = vi.hoisted(() => ({
  restoreSession: vi.fn(() => false),
}))
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('@matrix/index', () => ({
  bindClientEvents: vi.fn(),
  restoreSession: matrixMocks.restoreSession,
  startSync: vi.fn(),
  syncState: ref('STOPPED'),
}))

vi.mock('vue-router', async importOriginal => ({
  ...await importOriginal<typeof import('vue-router')>(),
  useRouter: () => ({
    replace: routerReplace,
  }),
}))

vi.mock('vue-sonner', () => ({
  Toaster: {
    name: 'VueSonnerToaster',
    template: '<div data-testid="vue-sonner-toaster" />',
  },
  toast: {
    error: toastMocks.error,
  },
}))

function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        RouterView: { template: '<main data-testid="router-view" />' },
        Toaster: { template: '<div data-testid="toaster" />' },
      },
    },
  })
}

describe('app native window frame runtime', () => {
  beforeEach(() => {
    routerReplace.mockClear()
    matrixMocks.restoreSession.mockReset()
    matrixMocks.restoreSession.mockResolvedValue(false)
    toastMocks.error.mockClear()
    delete window.muonDesktop
  })

  afterEach(() => {
    delete window.muonDesktop
  })

  it('does not render the custom window title bar in a browser tab', () => {
    const wrapper = mountApp()

    expect(wrapper.find('[data-testid="window-titlebar"]').exists()).toBe(false)
  })

  it('keeps the custom title bar style in Electron without custom window controls', () => {
    window.muonDesktop = { isElectron: true, platform: 'darwin' } as never

    const wrapper = mountApp()

    expect(wrapper.find('[data-testid="window-titlebar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="window-close"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="window-minimize"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="window-maximize"]').exists()).toBe(false)
  })

  it('shows a localized network error when session restore cannot reach the server', async () => {
    matrixMocks.restoreSession.mockRejectedValueOnce(new TypeError('fetch failed'))

    mountApp()
    await flushPromises()

    expect(toastMocks.error).toHaveBeenCalledWith('网络异常，请检查连接')
  })
})
