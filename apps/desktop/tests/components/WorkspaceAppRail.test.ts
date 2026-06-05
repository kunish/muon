import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkspaceAppRail from '@/app/components/workspace/WorkspaceAppRail.vue'
import { globalUiStore, resetGlobalUiStore } from '@/app/stores/globalUiStore'

const push = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({
  fullPath: '/contacts',
  path: '/contacts',
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push }),
}))

describe('workspaceAppRail', () => {
  beforeEach(() => {
    localStorage.clear()
    route.fullPath = '/contacts'
    route.path = '/contacts'
    push.mockReset()
    resetGlobalUiStore()
  })

  it('renders the Muon brand logo in the rail header', () => {
    const wrapper = mount(WorkspaceAppRail)
    const logo = wrapper.get('[data-testid="workspace-brand-logo"]')

    expect(logo.attributes('alt')).toBe('Muon')
    expect(logo.attributes('src')).toContain('muon-logo')
  })

  it('renders the Nexus-style icon rail and marks the active app', () => {
    const wrapper = mount(WorkspaceAppRail)

    expect(wrapper.get('[data-testid="workspace-app-messages"]').attributes('aria-label')).toBe('消息')
    expect(wrapper.get('[data-testid="workspace-app-contacts"]').attributes('aria-current')).toBe('page')
    expect(wrapper.get('[data-testid="workspace-app-contacts"]').attributes('aria-label')).toBe('联系人')
    expect(wrapper.get('[data-testid="workspace-app-organization"]').attributes('aria-label')).toBe('组织')
    expect(wrapper.get('[data-testid="workspace-app-calendar"]').attributes('aria-label')).toBe('日历')
    expect(wrapper.get('[data-testid="workspace-app-docs"]').attributes('aria-label')).toBe('文档')
    expect(wrapper.get('[data-testid="workspace-app-workplace"]').attributes('aria-label')).toBe('工作台')
    expect(wrapper.get('[data-testid="workspace-app-approvals"]').attributes('aria-label')).toBe('审批')
    expect(wrapper.get('[data-testid="workspace-app-email"]').attributes('aria-label')).toBe('邮件')
    expect(wrapper.get('[data-testid="workspace-app-calls"]').attributes('aria-label')).toBe('通话')
  })

  it('renders injected message unread count', () => {
    const wrapper = mount(WorkspaceAppRail, {
      props: { messageUnreadCount: 3 },
    })

    expect(wrapper.find('[data-testid="workspace-app-messages"]').text()).toContain('3')
  })

  it('navigates when an app entry is clicked', async () => {
    const wrapper = mount(WorkspaceAppRail)

    await wrapper.find('[data-testid="workspace-app-docs"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/docs')
  })

  it('returns to the last concrete message route instead of dropping the active conversation', async () => {
    route.fullPath = '/dm/!alice%3Alocalhost'
    route.path = '/dm/!alice:localhost'

    const wrapper = mount(WorkspaceAppRail)
    route.fullPath = '/settings'
    route.path = '/settings'

    await wrapper.find('[data-testid="workspace-app-messages"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/dm/!alice%3Alocalhost')
  })

  it('navigates to the organization hub entry', async () => {
    const wrapper = mount(WorkspaceAppRail)

    await wrapper.find('[data-testid="workspace-app-organization"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/organization')
  })

  it('navigates to a missing Feishu secondary app entry', async () => {
    const wrapper = mount(WorkspaceAppRail)

    await wrapper.find('[data-testid="workspace-app-calendar"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/calendar')
  })

  it('opens global search from the rail action', async () => {
    const wrapper = mount(WorkspaceAppRail)

    await wrapper.find('[data-testid="workspace-global-search"]').trigger('click')

    expect(globalUiStore.state.globalSearchOpen).toBe(true)
  })
})
