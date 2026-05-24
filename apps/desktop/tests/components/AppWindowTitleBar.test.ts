import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from '@/app/App.vue'

const routerReplace = vi.fn()
const routerIsReady = vi.fn()
const lifecycleMocks = vi.hoisted(() => ({
  bootstrap: vi.fn(async () => ({ restored: false })),
}))
const matrixMocks = vi.hoisted(() => ({
  syncState: undefined as { value: string } | undefined,
}))
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

function createColorSchemeQuery(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  return {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === 'change') listeners.add(listener)
    }),
    removeEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === 'change') listeners.delete(listener)
    }),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    dispatchEvent: vi.fn(),
  } satisfies MediaQueryList
}

vi.mock('@matrix/index', async () => {
  const { ref } = await import('vue')
  matrixMocks.syncState = ref('STOPPED')
  return {
    syncState: matrixMocks.syncState,
  }
})

vi.mock('@/auth/lifecycle', () => ({
  bootstrap: lifecycleMocks.bootstrap,
}))

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({
    replace: routerReplace,
    isReady: routerIsReady,
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
    routerIsReady.mockReset()
    routerIsReady.mockResolvedValue(undefined)
    lifecycleMocks.bootstrap.mockReset()
    lifecycleMocks.bootstrap.mockResolvedValue({ restored: false })
    matrixMocks.syncState!.value = 'STOPPED'
    toastMocks.error.mockClear()
    delete window.muonDesktop
    localStorage.removeItem('muon_theme')
    document.documentElement.classList.remove('dark')
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createColorSchemeQuery(false)))
  })

  afterEach(() => {
    delete window.muonDesktop
    localStorage.removeItem('muon_theme')
    document.documentElement.classList.remove('dark')
    vi.unstubAllGlobals()
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
    lifecycleMocks.bootstrap.mockRejectedValueOnce(new TypeError('fetch failed'))

    mountApp()
    await flushPromises()

    expect(toastMocks.error).toHaveBeenCalledWith('网络异常，请检查连接')
  })

  it('renders the startup skeleton while bootstrapping local session data', async () => {
    let resolveBootstrap!: (value: { restored: false }) => void
    lifecycleMocks.bootstrap.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBootstrap = resolve
      }),
    )

    const wrapper = mountApp()
    await nextTick()

    expect(wrapper.find('[data-testid="startup-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="startup-sidebar-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="startup-chat-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(false)

    resolveBootstrap({ restored: false })
    await flushPromises()
  })

  it('applies the saved dark theme before rendering the startup skeleton', async () => {
    localStorage.setItem('muon_theme', 'dark')
    let resolveBootstrap!: (value: { restored: false }) => void
    lifecycleMocks.bootstrap.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBootstrap = resolve
      }),
    )

    const wrapper = mountApp()
    await nextTick()

    expect(wrapper.find('[data-testid="startup-skeleton"]').exists()).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    resolveBootstrap({ restored: false })
    await flushPromises()
  })

  it('keeps restored chat sessions hidden until the first Matrix sync is ready', async () => {
    lifecycleMocks.bootstrap.mockResolvedValueOnce({ restored: 'matrix-only' })
    matrixMocks.syncState!.value = 'STOPPED'

    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-connecting"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="startup-skeleton"]').exists()).toBe(true)

    matrixMocks.syncState!.value = 'PREPARED'
    await nextTick()

    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="startup-skeleton"]').exists()).toBe(false)
  })

  it('still renders the login route immediately when no session is restored', async () => {
    lifecycleMocks.bootstrap.mockResolvedValueOnce({ restored: false })
    matrixMocks.syncState!.value = 'STOPPED'

    const wrapper = mountApp()
    await flushPromises()

    expect(routerReplace).toHaveBeenCalledWith('/login')
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(true)
  })

  it('keeps the startup skeleton visible until login navigation finishes', async () => {
    let resolveNavigation!: () => void
    lifecycleMocks.bootstrap.mockResolvedValueOnce({ restored: false })
    routerReplace.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveNavigation = resolve
      }),
    )

    const wrapper = mountApp()
    await flushPromises()

    expect(routerReplace).toHaveBeenCalledWith('/login')
    expect(wrapper.find('[data-testid="startup-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(false)

    resolveNavigation()
    await flushPromises()

    expect(wrapper.find('[data-testid="startup-skeleton"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(true)
  })

  it('keeps the startup skeleton visible until the initial route is ready', async () => {
    let resolveRouteReady!: () => void
    lifecycleMocks.bootstrap.mockResolvedValueOnce({ restored: false })
    routerReplace.mockResolvedValueOnce(undefined)
    routerIsReady.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveRouteReady = resolve
      }),
    )

    const wrapper = mountApp()
    await flushPromises()

    expect(routerReplace).toHaveBeenCalledWith('/login')
    expect(wrapper.find('[data-testid="startup-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(false)

    resolveRouteReady()
    await flushPromises()

    expect(wrapper.find('[data-testid="startup-skeleton"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(true)
  })
})
