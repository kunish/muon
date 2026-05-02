import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '@/features/auth/components/LoginPage.vue'

const mocks = vi.hoisted(() => ({
  bindClientEvents: vi.fn(),
  completeEnterpriseLogin: vi.fn(),
  isEnterpriseAuthConfigured: vi.fn(() => true),
  login: vi.fn(),
  register: vi.fn(),
  startEnterpriseLogin: vi.fn(),
  startSync: vi.fn(),
}))

vi.mock('@matrix/index', () => ({
  bindClientEvents: mocks.bindClientEvents,
  completeEnterpriseLogin: mocks.completeEnterpriseLogin,
  isEnterpriseAuthConfigured: mocks.isEnterpriseAuthConfigured,
  login: mocks.login,
  register: mocks.register,
  startEnterpriseLogin: mocks.startEnterpriseLogin,
  startSync: mocks.startSync,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('loginPage enterprise login', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('shows enterprise login when an API URL is configured', () => {
    vi.stubEnv('VITE_MUON_API_BASE_URL', 'http://127.0.0.1:8787')
    const wrapper = mount(LoginPage)

    expect(wrapper.text()).toContain('企业登录')
  })
})
