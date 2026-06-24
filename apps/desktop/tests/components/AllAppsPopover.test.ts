import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import AllAppsPopover from '@/app/components/workspace/AllAppsPopover.vue'
import { primaryWorkspaceApps } from '@/app/components/workspace/navigation'
import { resetSettingsStore, settingsStore } from '@/shared/stores/settingsStore'

describe('allAppsPopover', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSettingsStore()
  })

  it('renders a tile for every primary app and excludes settings', () => {
    const wrapper = mount(AllAppsPopover)

    expect(wrapper.findAll('[data-testid^="all-apps-open-"]')).toHaveLength(primaryWorkspaceApps.length)
    expect(wrapper.find('[data-testid="all-apps-open-settings"]').exists()).toBe(false)
  })

  it('emits open with the app when a tile is clicked', async () => {
    const wrapper = mount(AllAppsPopover)

    await wrapper.get('[data-testid="all-apps-open-email"]').trigger('click')

    expect(wrapper.emitted('open')).toBeTruthy()
    expect(wrapper.emitted('open')![0][0]).toMatchObject({ id: 'email' })
  })

  it('pins an unpinned app without emitting open', async () => {
    const wrapper = mount(AllAppsPopover)

    await wrapper.get('[data-testid="all-apps-pin-email"]').trigger('click')

    expect(settingsStore.state.pinnedApps).toContain('email')
    expect(wrapper.emitted('open')).toBeFalsy()
  })

  it('unpins a pinned app', async () => {
    const wrapper = mount(AllAppsPopover)

    await wrapper.get('[data-testid="all-apps-pin-messages"]').trigger('click')

    expect(settingsStore.state.pinnedApps).not.toContain('messages')
  })

  it('labels the pin button according to pinned state', () => {
    const wrapper = mount(AllAppsPopover)

    // messages is pinned by default, email is not
    expect(wrapper.get('[data-testid="all-apps-pin-messages"]').attributes('aria-label')).toBe('取消固定')
    expect(wrapper.get('[data-testid="all-apps-pin-email"]').attributes('aria-label')).toBe('固定到鸭栏')
  })
})
