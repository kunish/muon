import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import WorkspaceAppRail from '@/app/components/workspace/WorkspaceAppRail.vue'
import { useGlobalUiStore } from '@/app/stores/globalUiStore'

const push = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/contacts' }),
  useRouter: () => ({ push }),
}))

describe('workspaceAppRail', () => {
  it('renders the Muon brand logo in the rail header', () => {
    const wrapper = mount(WorkspaceAppRail)
    const logo = wrapper.get('[data-testid="workspace-brand-logo"]')

    expect(logo.attributes('alt')).toBe('Muon')
    expect(logo.attributes('src')).toContain('muon-logo')
  })

  it('renders app-first navigation and marks the active app', () => {
    const wrapper = mount(WorkspaceAppRail)
    expect(wrapper.text()).toContain('消息')
    expect(wrapper.text()).toContain('联系人')
    expect(wrapper.find('[aria-current="page"]').text()).toContain('联系人')
  })

  it('keeps app labels accessible without showing them as large rail text', () => {
    const wrapper = mount(WorkspaceAppRail)
    expect(wrapper.get('[data-testid="workspace-app-label-messages"]').classes()).toContain('sr-only')
    expect(wrapper.get('[data-testid="workspace-app-label-contacts"]').classes()).toContain('sr-only')
    expect(wrapper.get('[data-testid="workspace-app-label-settings"]').classes()).toContain('sr-only')
  })

  it('does not render retired secondary app entries', () => {
    const wrapper = mount(WorkspaceAppRail)
    expect(wrapper.text()).not.toContain('日历')
    expect(wrapper.text()).not.toContain('文档')
    expect(wrapper.text()).not.toContain('审批')
    expect(wrapper.text()).not.toContain('邮件')
    expect(wrapper.text()).not.toContain('视频会议')
  })

  it('renders injected message unread count', () => {
    const wrapper = mount(WorkspaceAppRail, {
      props: { messageUnreadCount: 3 },
    })
    expect(wrapper.find('[data-testid="workspace-app-messages"]').text()).toContain('3')
  })

  it('navigates when an app entry is clicked', async () => {
    const wrapper = mount(WorkspaceAppRail)
    await wrapper.find('[data-testid="workspace-app-messages"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/dm')
  })

  it('opens global search from the rail action', async () => {
    const wrapper = mount(WorkspaceAppRail)
    const globalUi = useGlobalUiStore()

    await wrapper.find('[data-testid="workspace-global-search"]').trigger('click')

    expect(globalUi.globalSearchOpen).toBe(true)
  })
})
