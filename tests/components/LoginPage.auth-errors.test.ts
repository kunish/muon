import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '@/features/auth/components/LoginPage.vue'

const mocks = vi.hoisted(() => ({
  bindClientEvents: vi.fn(),
  isEnterpriseAuthConfigured: vi.fn(() => false),
  push: vi.fn(),
  register: vi.fn(),
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
    push: mocks.push,
  }),
}))

describe('login page auth errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('explains user-in-use registration failures in actionable language', async () => {
    mocks.register.mockRejectedValueOnce(new Error('M_USER_IN_USE: Desired user ID is already taken.'))

    const wrapper = mount(LoginPage)
    const vm = wrapper.vm as unknown as { tab: 'login' | 'register' }
    vm.tab = 'register'

    const inputs = wrapper.findAll('input')
    await inputs[1].setValue('kunish')
    await inputs[2].setValue('test1234')
    await wrapper.get('form').trigger('submit')
    await vi.dynamicImportSettled()

    expect(wrapper.text()).toContain('该用户 ID 已存在。请切换到登录并使用已有密码，或换一个用户名注册。')
    expect(wrapper.text()).not.toContain('Desired user ID is already taken')
  })
})
