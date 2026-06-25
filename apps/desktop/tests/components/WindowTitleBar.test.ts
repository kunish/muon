import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WindowTitleBar from '@/app/components/window/WindowTitleBar.vue'

function mockPlatform(platform: string) {
  vi.stubGlobal('window', Object.assign(window, { muonDesktop: { isElectron: true, runtime: 'electron', platform } }))
}

describe('windowTitleBar', () => {
  beforeEach(() => {
    delete window.muonDesktop
  })

  afterEach(() => {
    delete window.muonDesktop
  })

  it('renders the custom title bar brand without custom window controls', () => {
    const wrapper = mount(WindowTitleBar)

    expect(wrapper.get('[data-testid="window-titlebar"]').text()).toContain('Muon')
    expect(wrapper.get('[data-testid="window-titlebar-logo"]').attributes('src')).toContain('muon-logo')
    expect(wrapper.find('[data-testid="window-close"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="window-minimize"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="window-maximize"]').exists()).toBe(false)
  })

  it('marks the custom title region as draggable', () => {
    const wrapper = mount(WindowTitleBar)

    expect(wrapper.get('[data-testid="window-titlebar-drag-region"]').attributes()).toHaveProperty(
      'data-electron-drag-region',
    )
  })

  it('reserves the native macOS traffic light area', () => {
    window.muonDesktop = { isElectron: true, platform: 'darwin' } as never

    const wrapper = mount(WindowTitleBar)

    expect(wrapper.get('[data-testid="window-titlebar"]').classes()).toContain('window-titlebar--mac')
  })

  it('marks the titlebar as mac when platform is darwin', () => {
    mockPlatform('darwin')
    const wrapper = mount(WindowTitleBar)
    expect(wrapper.get('[data-testid="window-titlebar"]').classes()).toContain('window-titlebar--mac')
  })

  it('keeps the brand wordmark on non-mac', () => {
    mockPlatform('win32')
    const wrapper = mount(WindowTitleBar)
    expect(wrapper.get('[data-testid="window-titlebar"]').classes()).not.toContain('window-titlebar--mac')
    expect(wrapper.find('[data-testid="window-titlebar-logo"]').exists()).toBe(true)
  })
})
