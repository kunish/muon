import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import WorkspaceAppRail from '@/app/components/workspace/WorkspaceAppRail.vue'
import { useGlobalUiStore } from '@/app/stores/globalUiStore'

const push = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/contacts' }),
  useRouter: () => ({ push }),
}))

describe('workspaceAppRail', () => {
  beforeEach(() => {
    localStorage.clear()
    push.mockReset()
  })

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

  it('shows app labels when expanded and keeps them accessible when collapsed', async () => {
    const wrapper = mount(WorkspaceAppRail)

    expect(wrapper.get('[data-testid="workspace-app-label-messages"]').classes()).not.toContain('sr-only')
    expect(wrapper.get('[data-testid="workspace-app-label-contacts"]').classes()).not.toContain('sr-only')
    expect(wrapper.get('[data-testid="workspace-app-label-settings"]').classes()).not.toContain('sr-only')

    await wrapper.get('[data-testid="workspace-rail-toggle"]').trigger('click')

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

  it('supports resizing the app rail with the mouse', async () => {
    const wrapper = mount(WorkspaceAppRail)
    const rail = wrapper.get('[data-testid="workspace-app-rail"]')
    const handle = wrapper.get('[data-testid="workspace-rail-resize-handle"]')

    expect(rail.attributes('style')).toContain('width: 148px')

    handle.element.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 148,
    }))
    await nextTick()

    expect(document.body.style.cursor).toBe('col-resize')

    window.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 170,
    }))
    await nextTick()

    expect(rail.attributes('style')).toContain('width: 170px')
    expect(handle.attributes('aria-valuenow')).toBe('170')
    expect(localStorage.getItem('muon_workspace_rail_width')).toBe('170')

    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    await nextTick()

    expect(document.body.style.cursor).toBe('')
  })

  it('collapses to icon-only mode and expands the app rail from the edge control', async () => {
    const wrapper = mount(WorkspaceAppRail)
    const rail = wrapper.get('[data-testid="workspace-app-rail"]')

    await wrapper.get('[data-testid="workspace-rail-toggle"]').trigger('click')

    expect(rail.attributes('style')).toContain('width: 72px')
    expect(rail.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('[data-testid="workspace-app-rail-content"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="workspace-app-label-messages"]').classes()).toContain('sr-only')
    expect(wrapper.find('[data-testid="workspace-rail-resize-handle"]').exists()).toBe(true)
    expect(localStorage.getItem('muon_workspace_rail_collapsed')).toBe('true')

    await wrapper.get('[data-testid="workspace-rail-toggle"]').trigger('click')

    expect(rail.attributes('style')).toContain('width: 148px')
    expect(rail.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-testid="workspace-app-label-messages"]').classes()).not.toContain('sr-only')
    expect(wrapper.find('[data-testid="workspace-rail-resize-handle"]').exists()).toBe(true)
    expect(localStorage.getItem('muon_workspace_rail_collapsed')).toBe('false')
  })

  it('collapses to icon-only mode when dragging below the rail threshold', async () => {
    const wrapper = mount(WorkspaceAppRail)
    const rail = wrapper.get('[data-testid="workspace-app-rail"]')
    const handle = wrapper.get('[data-testid="workspace-rail-resize-handle"]')

    handle.element.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 148,
    }))
    await nextTick()

    window.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 92,
    }))
    await nextTick()

    expect(rail.attributes('style')).toContain('width: 72px')
    expect(rail.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('[data-testid="workspace-app-label-messages"]').classes()).toContain('sr-only')
    expect(localStorage.getItem('muon_workspace_rail_collapsed')).toBe('true')

    window.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 158,
    }))
    await nextTick()

    expect(rail.attributes('style')).toContain('width: 158px')
    expect(rail.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-testid="workspace-app-label-messages"]').classes()).not.toContain('sr-only')
    expect(localStorage.getItem('muon_workspace_rail_collapsed')).toBe('false')

    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
  })

  it('expands from icon-only mode when dragging the app rail edge', async () => {
    const wrapper = mount(WorkspaceAppRail)
    const rail = wrapper.get('[data-testid="workspace-app-rail"]')

    await wrapper.get('[data-testid="workspace-rail-toggle"]').trigger('click')
    expect(rail.attributes('style')).toContain('width: 72px')

    const handle = wrapper.get('[data-testid="workspace-rail-resize-handle"]')
    handle.element.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 72,
    }))
    await nextTick()

    expect(rail.attributes('style')).toContain('width: 72px')
    expect(rail.attributes('aria-expanded')).toBe('false')

    window.dispatchEvent(new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 158,
    }))
    await nextTick()

    expect(rail.attributes('style')).toContain('width: 158px')
    expect(rail.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-testid="workspace-app-label-messages"]').classes()).not.toContain('sr-only')
    expect(localStorage.getItem('muon_workspace_rail_collapsed')).toBe('false')

    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
  })

  it('restores the app rail default width on double click', async () => {
    const wrapper = mount(WorkspaceAppRail)
    const rail = wrapper.get('[data-testid="workspace-app-rail"]')
    const handle = wrapper.get('[data-testid="workspace-rail-resize-handle"]')

    await handle.trigger('keydown', { key: 'End' })
    expect(rail.attributes('style')).toContain('width: 188px')

    await handle.trigger('dblclick')

    expect(rail.attributes('style')).toContain('width: 148px')
    expect(rail.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-testid="workspace-app-label-messages"]').classes()).not.toContain('sr-only')
    expect(localStorage.getItem('muon_workspace_rail_width')).toBe('148')
  })
})
