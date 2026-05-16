import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import LoginPage from '@/features/auth/components/LoginPage.vue'
import en from '@/locales/en.json'
import zh from '@/locales/zh.json'

const mocks = vi.hoisted(() => ({
  bindClientEvents: vi.fn(),
  desktopCallbacks: [] as Array<(url: string) => void>,
  desktopUnsubscribe: vi.fn(),
  isEnterpriseAuthConfigured: vi.fn(() => true),
  register: vi.fn(),
  routerPush: vi.fn(),
  signInWithEnterprise: vi.fn(),
  signInWithPassword: vi.fn(),
  startEnterpriseSignIn: vi.fn(),
  startSync: vi.fn(),
}))

vi.mock('@matrix/index', () => ({
  bindClientEvents: mocks.bindClientEvents,
  register: mocks.register,
  startSync: mocks.startSync,
}))

vi.mock('@/auth/lifecycle', () => ({
  isEnterpriseAuthConfigured: mocks.isEnterpriseAuthConfigured,
  signInWithEnterprise: mocks.signInWithEnterprise,
  signInWithPassword: mocks.signInWithPassword,
  startEnterpriseSignIn: mocks.startEnterpriseSignIn,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.routerPush,
  }),
}))

vi.mock('@/electron/bridge', () => ({
  getDesktopBridge: () => ({
    auth: {
      onCallback: vi.fn((callback: (url: string) => void) => {
        mocks.desktopCallbacks.push(callback)
        return mocks.desktopUnsubscribe
      }),
    },
  }),
}))

describe('loginPage enterprise login', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    mocks.desktopCallbacks.length = 0
  })

  it('shows enterprise login when an API URL is configured', () => {
    vi.stubEnv('VITE_MUON_API_BASE_URL', 'http://127.0.0.1:8787')
    const wrapper = mount(LoginPage)

    expect(wrapper.text()).toContain('企业登录')
  })

  it('localizes the enterprise login button for English users', () => {
    vi.stubEnv('VITE_MUON_API_BASE_URL', 'http://127.0.0.1:8787')
    const wrapper = mount(LoginPage, {
      global: {
        plugins: [
          createI18n({
            fallbackLocale: 'zh',
            legacy: false,
            locale: 'en',
            messages: { en, zh },
          }),
        ],
      },
    })

    expect(wrapper.text()).toContain('Enterprise login')
    expect(wrapper.text()).not.toContain('企业登录')
  })

  it('starts enterprise login from the SSO button', async () => {
    vi.stubEnv('VITE_MUON_API_BASE_URL', 'http://127.0.0.1:8787')
    const wrapper = mount(LoginPage)

    await wrapper.get('button[type="button"]').trigger('click')

    expect(mocks.startEnterpriseSignIn).toHaveBeenCalledOnce()
  })

  it('completes enterprise login from a desktop deeplink callback', async () => {
    vi.stubEnv('VITE_MUON_API_BASE_URL', 'http://127.0.0.1:8787')
    mocks.signInWithEnterprise.mockResolvedValue(undefined)
    mount(LoginPage)

    mocks.desktopCallbacks[0]('muon://auth/callback?code=oauth-code&state=oauth-state')

    await vi.waitFor(() => {
      expect(mocks.signInWithEnterprise).toHaveBeenCalledWith('muon://auth/callback?code=oauth-code&state=oauth-state')
    })
    expect(mocks.routerPush).toHaveBeenCalledWith('/dm')
  })

  it('localizes enterprise callback errors instead of exposing internal English strings', async () => {
    vi.stubEnv('VITE_MUON_API_BASE_URL', 'http://127.0.0.1:8787')
    mocks.signInWithEnterprise.mockRejectedValueOnce(new Error('Enterprise login state does not match this device'))
    const wrapper = mount(LoginPage)

    mocks.desktopCallbacks[0]('muon://auth/callback?code=oauth-code&state=wrong-state')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('企业登录状态已过期，请重新发起登录。')
    })
    expect(wrapper.text()).not.toContain('Enterprise login state does not match this device')
  })

  it('unsubscribes from desktop deeplink callbacks on unmount', () => {
    vi.stubEnv('VITE_MUON_API_BASE_URL', 'http://127.0.0.1:8787')
    const wrapper = mount(LoginPage)

    wrapper.unmount()

    expect(mocks.desktopUnsubscribe).toHaveBeenCalledOnce()
  })
})
